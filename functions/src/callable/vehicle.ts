import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { REGION } from "../config";
import { PlateUtils } from "../domain/plateUtils";

export const addVehicle = onCall({ region: REGION }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Vui lòng đăng nhập.");
  }
  const uid = request.auth.uid;
  const { plateDisplay, nickname, setDefault } = request.data || {};

  if (!plateDisplay) {
    throw new HttpsError("invalid-argument", "Thiếu biển số xe.");
  }

  const normalized = PlateUtils.normalize(plateDisplay);
  if (!PlateUtils.isValid(normalized)) {
    throw new HttpsError("invalid-argument", "Biển số xe không đúng định dạng Việt Nam.");
  }

  const vehicleType = "car";
  const db = getFirestore();
  const vehicleRef = db.collection("vehicles").doc(normalized);

  const existing = await vehicleRef.get();
  if (existing.exists) {
    const existingData = existing.data();
    if (existingData?.ownerUid !== uid) {
      throw new HttpsError("already-exists", "Biển số xe này đã được đăng ký trong hệ thống.");
    }
  }

  const formattedDisplay = plateDisplay.trim().toUpperCase();

  await vehicleRef.set({
    ownerUid: uid,
    plateNormalized: normalized,
    plateDisplay: formattedDisplay,
    type: vehicleType,
    nickname: nickname ? String(nickname).trim() : "",
    createdAt: existing.exists ? (existing.data()?.createdAt || FieldValue.serverTimestamp()) : FieldValue.serverTimestamp(),
  }, { merge: true });

  const userRef = db.collection("users").doc(uid);
  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    await userRef.set({
      email: request.auth.token.email || "",
      displayName: request.auth.token.name || "User",
      walletBalance: 0,
      fcmTokens: [],
      locale: "vi",
      defaultPlannedDurationMin: 60,
      defaultVehicleId: setDefault === true ? normalized : null,
      createdAt: FieldValue.serverTimestamp(),
    });
  } else if (setDefault === true) {
    await userRef.set({
      defaultVehicleId: normalized,
    }, { merge: true });
  }

  // Tự động liên kết các phiên đỗ / giữ chỗ đang hoạt động trùng biển số chưa gắn chủ xe
  const orphanSessionsSnap = await db
    .collection("sessions")
    .where("plate", "==", normalized)
    .where("status", "==", "active")
    .get();
  for (const sDoc of orphanSessionsSnap.docs) {
    if (!sDoc.data()?.uid) {
      await sDoc.ref.update({ uid });
    }
  }

  const orphanResSnap = await db
    .collection("reservations")
    .where("plate", "==", normalized)
    .where("status", "==", "active")
    .get();
  for (const rDoc of orphanResSnap.docs) {
    if (!rDoc.data()?.uid) {
      await rDoc.ref.update({ uid });
    }
  }

  return {
    plateNormalized: normalized,
    plateDisplay: formattedDisplay,
  };
});

export const removeVehicle = onCall({ region: REGION }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Vui lòng đăng nhập.");
  }
  const uid = request.auth.uid;
  const { plateNormalized } = request.data || {};

  if (!plateNormalized) {
    throw new HttpsError("invalid-argument", "Thiếu biển số xe cần xóa.");
  }

  const db = admin.firestore();
  const vehicleRef = db.collection("vehicles").doc(plateNormalized);
  const doc = await vehicleRef.get();

  if (!doc.exists) {
    throw new HttpsError("not-found", "Không tìm thấy xe.");
  }

  const data = doc.data();
  if (data?.ownerUid !== uid) {
    throw new HttpsError("permission-denied", "Bạn không sở hữu phương tiện này.");
  }

  // Kiểm tra xem xe có đang trong phiên đỗ active hay đặt chỗ active không
  const activeReservations = await db
    .collection("reservations")
    .where("plate", "==", plateNormalized)
    .where("status", "==", "active")
    .limit(1)
    .get();

  if (!activeReservations.empty) {
    throw new HttpsError(
      "failed-precondition",
      "Phương tiện đang có lượt đặt chỗ hoạt động, không thể xóa."
    );
  }

  const activeSessions = await db
    .collection("sessions")
    .where("plate", "==", plateNormalized)
    .where("status", "==", "active")
    .limit(1)
    .get();

  if (!activeSessions.empty) {
    throw new HttpsError(
      "failed-precondition",
      "Phương tiện đang trong phiên đỗ tại bãi, không thể xóa."
    );
  }

  await vehicleRef.delete();

  // Kiểm tra nếu là defaultVehicleId thì gỡ bỏ
  const userRef = db.collection("users").doc(uid);
  const userDoc = await userRef.get();
  if (userDoc.exists && userDoc.data()?.defaultVehicleId === plateNormalized) {
    await userRef.update({
      defaultVehicleId: null,
    });
  }

  return { success: true };
});

