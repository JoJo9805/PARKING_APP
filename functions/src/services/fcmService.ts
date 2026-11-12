import * as admin from "firebase-admin";

export interface FcmPayloadData {
  type:
    | "VEHICLE_ENTERED"
    | "VEHICLE_EXITED"
    | "RESERVATION_EXPIRING"
    | "RESERVATION_EXPIRED"
    | "PLANNED_DURATION_NEAR"
    | "WALLET_CHANGED";
  [key: string]: string;
}

export class FcmService {
  /**
   * Gửi bản tin FCM Data-only tới tất cả FCM token của người dùng.
   * Đồng thời tự động dọn sạch token không hợp lệ (UNREGISTERED)
   * và lưu bản ghi vào users/{uid}/notifications.
   */
  public static async sendDataOnly(
    uid: string,
    data: FcmPayloadData,
    inboxRecord?: { title: string; body: string; refId?: string }
  ): Promise<void> {
    const db = admin.firestore();
    const userDoc = await db.collection("users").doc(uid).get();

    if (!userDoc.exists) return;
    const userData = userDoc.data() || {};
    const tokens: string[] = userData.fcmTokens || [];

    // Luôn đính kèm serverTs (milliseconds dạng String)
    const payloadData: Record<string, string> = {
      ...data,
      serverTs: String(Date.now()),
    };

    // 1. Lưu vào inbox users/{uid}/notifications
    if (inboxRecord) {
      await db
        .collection("users")
        .doc(uid)
        .collection("notifications")
        .add({
          type: data.type,
          title: inboxRecord.title,
          body: inboxRecord.body,
          refId: inboxRecord.refId || "",
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }

    if (!tokens || tokens.length === 0) return;

    // 2. Gửi FCM multicast Data-only với priority high
    const message: admin.messaging.MulticastMessage = {
      tokens,
      data: payloadData,
      android: {
        priority: "high",
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    // 3. Xoá token chết (UNREGISTERED / NOT_FOUND)
    const deadTokens: string[] = [];
    response.responses.forEach((resp, index) => {
      if (!resp.success && resp.error) {
        const errCode = resp.error.code;
        if (
          errCode === "messaging/registration-token-not-registered" ||
          errCode === "messaging/invalid-registration-token"
        ) {
          deadTokens.push(tokens[index]);
        }
      }
    });

    if (deadTokens.length > 0) {
      await db
        .collection("users")
        .doc(uid)
        .update({
          fcmTokens: admin.firestore.FieldValue.arrayRemove(...deadTokens),
        });
    }
  }
}
