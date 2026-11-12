import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { REGION } from "../config";
import { FcmService } from "../services/fcmService";

export const reservationCron = onSchedule(
  {
    schedule: "every 1 minutes",
    region: REGION,
  },
  async () => {
    const db = admin.firestore();
    const nowMs = Date.now();
    const fiveMinutesMs = 5 * 60 * 1000;

    const activeReservations = await db
      .collection("reservations")
      .where("status", "==", "active")
      .get();

    for (const doc of activeReservations.docs) {
      const data = doc.data();
      const expiresAtMs = data.expiresAt?.toMillis() || 0;
      const uid = data.uid;
      const lotName = data.lotName || "Bãi đỗ xe";
      const slotCode = data.slotId || "";
      const extendCount = Number(data.extendCount || 0);
      const maxExtendCount = Number(data.maxExtendCount || 1);
      const canExtend = extendCount < maxExtendCount;

      // 1. Quá hạn 15 phút -> Hết hạn & Tịch thu cọc
      if (nowMs >= expiresAtMs) {
        await db.runTransaction(async (transaction) => {
          transaction.update(doc.ref, {
            status: "expired",
            depositStatus: "forfeited",
            expiredAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          // Giải phóng ô đỗ
          if (data.lotId && data.slotId) {
            const slotRef = db
              .collection("lots")
              .doc(data.lotId)
              .collection("slots")
              .doc(data.slotId);
            transaction.update(slotRef, {
              status: "available",
              reservationId: null,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        });

        if (uid) {
          await FcmService.sendDataOnly(
            uid,
            {
              type: "RESERVATION_EXPIRED",
              reservationId: doc.id,
              lotName,
              slotCode,
              depositForfeited: String(data.depositAmount || 5000),
            },
            {
              title: "Hết hạn giữ chỗ",
              body: `Lượt giữ chỗ ô ${slotCode} tại ${lotName} đã hết hạn. Tiền cọc đã được chuyển thành phí phạt quá hạn.`,
              refId: doc.id,
            }
          );
        }
      }
      // 2. Nhắc trước 5 phút khi sắp hết hạn
      else if (expiresAtMs - nowMs <= fiveMinutesMs && !data.remindedExpiring) {
        await doc.ref.update({ remindedExpiring: true });

        if (uid) {
          await FcmService.sendDataOnly(
            uid,
            {
              type: "RESERVATION_EXPIRING",
              reservationId: doc.id,
              lotName,
              slotCode,
              expiresAtMs: String(expiresAtMs),
              canExtend: String(canExtend),
            },
            {
              title: "Sắp hết hạn giữ chỗ",
              body: `Lượt giữ chỗ ô ${slotCode} tại ${lotName} sẽ hết hạn trong 5 phút nữa. Hãy gia hạn hoặc đến cổng trước khi hết hạn.`,
              refId: doc.id,
            }
          );
        }
      }
    }
  }
);

