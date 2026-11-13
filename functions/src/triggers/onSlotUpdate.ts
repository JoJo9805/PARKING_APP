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

    // Đếm số ô đỗ trống (status == "available")
    const availableSlotsSnap = await lotRef
      .collection("slots")
      .where("status", "==", "available")
      .get();

    const availableSlots = availableSlotsSnap.size;

    // Đếm tổng số ô đỗ
    const allSlotsSnap = await lotRef.collection("slots").get();
    const totalSlots = allSlotsSnap.size;

    await lotRef.update({
      availableSlots,
      ...(totalSlots > 0 ? { totalSlots } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
);

