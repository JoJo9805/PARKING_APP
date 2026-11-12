import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { REGION } from "../config";

export const extendPlannedDuration = onCall({ region: REGION }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Vui lòng đăng nhập.");
  }
  const uid = request.auth.uid;
  const { sessionId, addMinutes } = request.data || {};

  const minutesToAdd = Number(addMinutes);
  if (!sessionId || (minutesToAdd !== 30 && minutesToAdd !== 60)) {
    throw new HttpsError("invalid-argument", "Thời gian gia hạn phải là 30 hoặc 60 phút.");
  }

  const db = admin.firestore();
  const sessionRef = db.collection("sessions").doc(sessionId);

  const sessionDoc = await sessionRef.get();
  if (!sessionDoc.exists) {
    throw new HttpsError("not-found", "Không tìm thấy phiên đỗ xe.");
  }

  const data = sessionDoc.data();
  if (data?.uid !== uid) {
    throw new HttpsError("permission-denied", "Không có quyền sửa đổi phiên đỗ này.");
  }

  if (data?.status !== "active") {
    throw new HttpsError("failed-precondition", "Phiên đỗ xe đã kết thúc.");
  }

  const currentPlannedEndMs = data?.plannedEndTime?.toMillis() || Date.now();
  const newPlannedEndMs = currentPlannedEndMs + minutesToAdd * 60 * 1000;

  await sessionRef.update({
    plannedEndTime: admin.firestore.Timestamp.fromMillis(newPlannedEndMs),
    remindedLongParking: false, // Để nhắc lại khi sắp đến mốc mới
  });

  return {
    plannedEndTimeMs: newPlannedEndMs,
  };
});

