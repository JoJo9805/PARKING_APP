import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { REGION, BUSINESS_CONFIG } from "../config";
import { PlateUtils } from "../domain/plateUtils";
import { SessionService } from "../domain/sessionService";
import { FcmService } from "../services/fcmService";

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
      // Trường hợp không nhận diện được biển số: đưa về pending_manual để Web Admin duyệt & mở cổng
      if (data.status !== "offline_fallback" && data.status !== "ignored") {
        await snap.ref.update({
          decision: "pending",
          status: "pending_manual",
          denyReason: data.denyReason || "UNRECOGNIZED_PLATE",
        });
      }
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
      // Nếu Edge đã đưa về chờ duyệt thủ công (không đọc được biển hoặc biển không có trong bãi)
      if (
        data.status === "pending_manual" ||
        data.decision === "WAIT_MANUAL" ||
        data.denyReason === "PLATE_NOT_IN_LOT"
      ) {
        await snap.ref.update({
          decision: "pending",
          status: "pending_manual",
          denyReason: data.denyReason || "PLATE_NOT_IN_LOT",
        });
        return;
      }

      // Tìm phiên đỗ active của xe
      const sessionQuery = await db
        .collection("sessions")
        .where("plate", "==", plateNormalized)
        .where("status", "==", "active")
        .limit(1)
        .get();

      if (sessionQuery.empty) {
        // Biển số quét được khi ra không khớp xe nào đang đỗ -> đưa về pending_manual để Web Admin chụp lại hoặc nhập thủ công
        await snap.ref.update({
          decision: "pending",
          status: "pending_manual",
          denyReason: "PLATE_NOT_IN_LOT",
        });
        return;
      }

      // Nếu Edge đã từ chối mở cổng (vd: xe có trong bãi nhưng chưa gửi yêu cầu ra trên App) -> đánh dấu đang chờ xác nhận ra & gửi thông báo App
      if (data.decision === "DENY" || data.denyReason === "NO_EXIT_REQUEST") {
        const sDoc = sessionQuery.docs[0];
        const sData = sDoc.data() || {};

        await snap.ref.update({
          decision: "denied",
          denyReason: data.denyReason || "NO_EXIT_REQUEST",
          status: "denied",
          sessionId: sDoc.id,
        });

        await sDoc.ref.update({
          waitingAtExitGate: true,
          waitingAtExitGateAt: FieldValue.serverTimestamp(),
          waitingExitGateEventId: snap.id,
          waitingExitImageUrl: data.imageUrl || data.cropImageUrl || "",
        });

        if (sData.uid) {
          const plateDisplay = sData.plateDisplay || PlateUtils.formatDisplay(plateNormalized);
          await FcmService.sendDataOnly(
            sData.uid,
            {
              type: "EXIT_WAITING_CONFIRM",
              sessionId: sDoc.id,
              lotId,
              plate: plateNormalized,
            },
            {
              title: "Xe đang chờ tại Cổng RA",
              body: `Xe ${plateDisplay} đang ở Cổng RA nhưng chưa gửi yêu cầu ra. Mở ứng dụng và bấm Gửi yêu cầu ra để tự động mở barie ngay.`,
              refId: sDoc.id,
            }
          );
        }
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
