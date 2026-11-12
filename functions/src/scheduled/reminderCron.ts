import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { REGION } from "../config";
import { FcmService } from "../services/fcmService";

export const reminderCron = onSchedule(
  {
    schedule: "every 1 minutes",
    region: REGION,
  },
  async () => {
    const db = admin.firestore();
    const nowMs = Date.now();
    const tenMinutesMs = 10 * 60 * 1000;

    const activeSessions = await db
      .collection("sessions")
      .where("status", "==", "active")
      .get();

    for (const doc of activeSessions.docs) {
      const data = doc.data();
      const plannedEndMs = data.plannedEndTime?.toMillis() || 0;
      const uid = data.uid;

      if (!uid || data.remindedLongParking || !plannedEndMs) continue;

      // Nhắc trước 10 phút thời lượng dự kiến
      if (plannedEndMs - nowMs <= tenMinutesMs && plannedEndMs > nowMs) {
        await doc.ref.update({ remindedLongParking: true });

        const lotName = data.lotName || "Bãi đỗ xe";
        const slotCode = data.actualSlotId || data.assignedSlotId || "";

        await FcmService.sendDataOnly(
          uid,
          {
            type: "PLANNED_DURATION_NEAR",
            sessionId: doc.id,
            lotName,
            slotCode,
            plannedEndMs: String(plannedEndMs),
          },
          {
            title: "Sắp hết thời gian đỗ dự kiến",
            body: `Phiên đỗ xe tại ${lotName} sắp đến thời gian dự kiến. Bạn có thể mở app để gia hạn thêm nếu cần.`,
            refId: doc.id,
          }
        );
      }
    }
  }
);

