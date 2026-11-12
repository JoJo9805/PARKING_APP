import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { REGION } from "../config";

export const mockLotsCron = onSchedule(
  {
    schedule: "every 5 minutes",
    region: REGION,
  },
  async () => {
    const db = admin.firestore();

    const mockLots = await db
      .collection("lots")
      .where("isLive", "==", false)
      .get();

    for (const doc of mockLots.docs) {
      const data = doc.data();
      const total = Number(data.totalSlots || 20);
      const minSlots = Math.max(1, Math.floor(total * 0.1));
      const maxSlots = Math.max(minSlots + 1, Math.floor(total * 0.9));

      // Biến thiên ngẫu nhiên chỗ trống
      const newAvailable = Math.floor(Math.random() * (maxSlots - minSlots + 1)) + minSlots;

      await doc.ref.update({
        availableSlots: newAvailable,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
);

