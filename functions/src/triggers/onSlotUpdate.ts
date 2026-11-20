import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { REGION } from "../config";

export const onSlotUpdated = onDocumentWritten(
  {
    document: "lots/{lotId}/slots/{slotId}",
    region: REGION,
  },
  async (event) => {
    const lotId = event.params.lotId;
    if (!lotId) return;

    const db = admin.firestore();
    const lotRef = db.collection("lots").doc(lotId);

    // Đếm tổng số ô và số ô thực sự khả dụng (status == "available" và cảm biến chưa báo có xe)
    const allSlotsSnap = await lotRef.collection("slots").get();
    const totalSlots = allSlotsSnap.size;
    const availableSlots = allSlotsSnap.docs.filter((doc) => {
      const d = doc.data() || {};
      return d.status === "available" && d.sensorOccupied !== true;
    }).length;

    await lotRef.update({
      availableSlots,
      ...(totalSlots > 0 ? { totalSlots } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
);

