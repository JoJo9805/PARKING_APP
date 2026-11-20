import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { REGION, BUSINESS_CONFIG } from "../config";
import { PlateUtils } from "../domain/plateUtils";

export const createReservation = onCall({ region: REGION }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Vui lòng đăng nhập.");
  }
  const uid = request.auth.uid;
  const { lotId, slotId, plateNormalized } = request.data || {};

  if (!lotId || !plateNormalized) {
    throw new HttpsError("invalid-argument", "Thiếu thông tin bãi đỗ hoặc biển số xe.");
  }

  const normalizedPlate = PlateUtils.normalize(String(plateNormalized));
  if (!PlateUtils.isValid(normalizedPlate)) {
    throw new HttpsError("invalid-argument", "Biển số xe không hợp lệ.");
  }

  const db = admin.firestore();
  const lotRef = db.collection("lots").doc(lotId);

  // 1. Quy tắc 1 hoạt động: kiểm tra theo cả uid và biển số xe
  const [activeResByUid, activeSessByUid, activeResByPlate, activeSessByPlate] =
    await Promise.all([
      db
        .collection("reservations")
        .where("uid", "==", uid)
        .where("status", "==", "active")
        .limit(1)
        .get(),
      db
        .collection("sessions")
        .where("uid", "==", uid)
        .where("status", "==", "active")
        .limit(1)
        .get(),
      db
        .collection("reservations")
        .where("plate", "==", normalizedPlate)
        .where("status", "==", "active")
        .limit(1)
        .get(),
      db
        .collection("sessions")
        .where("plate", "==", normalizedPlate)
        .where("status", "==", "active")
        .limit(1)
        .get(),
    ]);

  if (!activeResByUid.empty || !activeResByPlate.empty) {
    throw new HttpsError(
      "failed-precondition",
      "Bạn hoặc biển số xe này đang có một lượt giữ chỗ đang hoạt động.",
      { reason: "HAS_ACTIVE_RESERVATION" }
    );
  }

  if (!activeSessByUid.empty || !activeSessByPlate.empty) {
    throw new HttpsError(
      "failed-precondition",
      "Bạn hoặc biển số xe này đang có một phiên đỗ xe chưa hoàn tất tại bãi.",
      { reason: "HAS_ACTIVE_SESSION" }
    );
  }

  // 2. Kiểm tra bãi đỗ
  const lotDoc = await lotRef.get();
  if (!lotDoc.exists) {
    throw new HttpsError("not-found", "Bãi đỗ không tồn tại.");
  }
  const lotName = lotDoc.data()?.name || "Bãi đỗ xe";

  const requestedSlotId = slotId ? String(slotId).trim() : "";
  const resRef = db.collection("reservations").doc();
  const nowMs = Date.now();
  const expiresAtMs = nowMs + BUSINESS_CONFIG.HOLD_DURATION_MINUTES * 60 * 1000;
  let targetSlotId = requestedSlotId;

  await db.runTransaction(async (transaction) => {
    let slotRef: FirebaseFirestore.DocumentReference;

    if (requestedSlotId) {
      slotRef = lotRef.collection("slots").doc(requestedSlotId);
      const slotDoc = await transaction.get(slotRef);
      const sData = slotDoc.data() || {};
      if (!slotDoc.exists || sData.status !== "available" || sData.sensorOccupied === true) {
        throw new HttpsError(
          "resource-exhausted",
          "Vị trí đỗ hiện không còn trống. Vui lòng chọn ô khác.",
          { reason: "RESOURCE_EXHAUSTED" }
        );
      }
      targetSlotId = slotDoc.id;
    } else {
      const slotsSnap = await transaction.get(lotRef.collection("slots"));
      const candidates = slotsSnap.docs
        .map((d) => ({ ref: d.ref, id: d.id, data: d.data() || {} }))
        .filter((s) => s.data.status === "available" && s.data.sensorOccupied !== true)
        .sort((a, b) => a.id.localeCompare(b.id));

      if (candidates.length === 0) {
        throw new HttpsError("resource-exhausted", "Bãi đỗ hiện đã hết chỗ trống.", {
          reason: "RESOURCE_EXHAUSTED",
        });
      }
      targetSlotId = candidates[0].id;
      slotRef = candidates[0].ref;
    }

    // Tạo reservation (miễn cọc)
    transaction.set(resRef, {
      uid,
      lotId,
      lotName,
      slotId: targetSlotId,
      plate: normalizedPlate,
      plateDisplay: PlateUtils.formatDisplay(normalizedPlate),
      status: "active",
      createdAt: Timestamp.fromMillis(nowMs),
      expiresAt: Timestamp.fromMillis(expiresAtMs),
      remindedExpiring: false,
      extendCount: 0,
      maxExtendCount: BUSINESS_CONFIG.MAX_EXTEND_COUNT,
      depositAmount: 0,
      depositStatus: "none",
    });

    // Cập nhật slot sang reserved
    transaction.update(slotRef, {
      status: "reserved",
      reservationId: resRef.id,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return {
    reservationId: resRef.id,
    slotId: targetSlotId,
    expiresAtMs,
    depositAmount: 0,
  };
});

export const cancelReservation = onCall({ region: REGION }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Vui lòng đăng nhập.");
  }
  const uid = request.auth.uid;
  const { reservationId } = request.data || {};

  if (!reservationId) {
    throw new HttpsError("invalid-argument", "Thiếu reservationId.");
  }

  const db = admin.firestore();
  const resRef = db.collection("reservations").doc(reservationId);

  await db.runTransaction(async (transaction) => {
    const resDoc = await transaction.get(resRef);
    if (!resDoc.exists) {
      throw new HttpsError("not-found", "Không tìm thấy lượt đặt chỗ.");
    }

    const resData = resDoc.data();
    if (resData?.uid !== uid) {
      throw new HttpsError("permission-denied", "Không có quyền huỷ lượt đặt chỗ này.");
    }

    if (resData?.status !== "active") {
      throw new HttpsError(
        "failed-precondition",
        `Không thể huỷ lượt đặt chỗ có trạng thái: ${resData?.status}`
      );
    }

    const slotRef = db
      .collection("lots")
      .doc(resData.lotId)
      .collection("slots")
      .doc(resData.slotId);
    const slotDoc = await transaction.get(slotRef);

    transaction.update(resRef, {
      status: "cancelled",
      depositStatus: "none",
      cancelledAt: FieldValue.serverTimestamp(),
    });

    if (slotDoc.exists && slotDoc.data()?.status === "reserved") {
      transaction.update(slotRef, {
        status: "available",
        reservationId: null,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  });

  return {
    refunded: false,
    refundAmount: 0,
    cancelled: true,
  };
});

export const extendReservation = onCall({ region: REGION }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Vui lòng đăng nhập.");
  }
  const uid = request.auth.uid;
  const { reservationId } = request.data || {};

  if (!reservationId) {
    throw new HttpsError("invalid-argument", "Thiếu reservationId.");
  }

  const db = admin.firestore();
  const resRef = db.collection("reservations").doc(reservationId);

  let newExpiresAtMs = 0;
  let newExtendCount = 0;

  await db.runTransaction(async (transaction) => {
    const resDoc = await transaction.get(resRef);
    if (!resDoc.exists) {
      throw new HttpsError("not-found", "Không tìm thấy lượt đặt chỗ.");
    }
    const data = resDoc.data();
    if (data?.uid !== uid) {
      throw new HttpsError("permission-denied", "Không có quyền gia hạn.");
    }
    if (data?.status !== "active") {
      throw new HttpsError("failed-precondition", "Lượt đặt chỗ không còn hoạt động.");
    }

    const extendCount = Number(data?.extendCount || 0);
    const maxExtendCount = Number(data?.maxExtendCount || BUSINESS_CONFIG.MAX_EXTEND_COUNT);
    if (extendCount >= maxExtendCount) {
      throw new HttpsError("failed-precondition", "Bạn đã đạt số lần gia hạn tối đa (1 lần).");
    }

    const currentExpiresMs = data?.expiresAt?.toMillis() || Date.now();
    if (Date.now() > currentExpiresMs) {
      throw new HttpsError("failed-precondition", "Lượt đặt chỗ đã hết hạn.");
    }

    newExpiresAtMs = currentExpiresMs + BUSINESS_CONFIG.EXTEND_DURATION_MINUTES * 60 * 1000;
    newExtendCount = extendCount + 1;

    transaction.update(resRef, {
      expiresAt: Timestamp.fromMillis(newExpiresAtMs),
      extendCount: newExtendCount,
      remindedExpiring: false, // Reset để nhắc lại ở 5 phút cuối mới
    });
  });

  return {
    expiresAtMs: newExpiresAtMs,
    extendCount: newExtendCount,
  };
});
