import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { REGION, BUSINESS_CONFIG } from "../config";
import { PlateUtils } from "../domain/plateUtils";
import { SessionService } from "../domain/sessionService";

export const onGateEventCreated = onDocumentCreated(
  {
    document: "gateEvents/{eventId}",
    region: REGION,
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    const rawPlate = data.plateNormalized || data.plateRaw || "";
    const plateNormalized = PlateUtils.normalize(rawPlate);
    const direction = (data.direction || "").toLowerCase();
    const lotId = data.lotId || BUSINESS_CONFIG.DEFAULT_LOT_ID;

    if (!plateNormalized) {
      // Trường hợp không nhận diện được biển số (unrecognized)
      return;
    }

    const db = admin.firestore();

    if (direction === "in") {
      try {
        const openResult = await SessionService.openSession({
          plateNormalized,
          lotId,
          imageUrl: data.imageUrl || data.cropImageUrl || "",
          assignedSlotId: data.assignedSlotId,
          matchedReservationId: data.matchedReservationId,
        });

        await snap.ref.update({
          decision: "accepted",
          assignedSlotId: openResult.assignedSlotId,
          matchedReservationId: openResult.matchedReservationId,
          sessionId: openResult.sessionId,
          status: "processed",
        });
      } catch (err: any) {
        await snap.ref.update({
          decision: "denied",
          denyReason: err.message || "Lỗi khi xử lý phiên đỗ vào bãi.",
          status: "error",
        });
      }
    } else if (direction === "out") {
      // Tìm phiên đỗ active của xe
      const sessionQuery = await db
        .collection("sessions")
        .where("plate", "==", plateNormalized)
        .where("status", "==", "active")
        .limit(1)
        .get();

      if (sessionQuery.empty) {
        await snap.ref.update({
          decision: "denied",
          denyReason: "Không tìm thấy phiên đỗ đang hoạt động cho biển số này.",
          status: "error",
        });
        return;
      }

      const sDoc = sessionQuery.docs[0];

      try {
        await SessionService.closeSession({
          sessionId: sDoc.id,
          exitTimeMs: Date.now(),
          exitImageUrl: data.imageUrl || data.cropImageUrl || "",
          closedByAdmin: false,
        });

        await snap.ref.update({
          decision: "accepted",
          sessionId: sDoc.id,
          status: "processed",
        });
      } catch (err: any) {
        await snap.ref.update({
          decision: "denied",
          denyReason: err.message || "Lỗi khi đóng phiên đỗ xe ra.",
          status: "error",
        });
      }
    }
  }
);
