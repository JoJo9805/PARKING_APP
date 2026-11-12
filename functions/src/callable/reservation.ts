import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
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

  const db = admin.firestore();
  const userRef = db.collection("users").doc(uid);
  const lotRef = db.collection("lots").doc(lotId);

  // 1. Kiểm tra ví người dùng
  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    throw new HttpsError("not-found", "Người dùng không tồn tại.");
  }
  const userData = userDoc.data() || {};
  const walletBalance = Number(userData.walletBalance || 0);

  if (walletBalance < 0) {
    throw new HttpsError("failed-precondition", "Ví nội bộ của bạn đang bị âm tiền.", {
      reason: "NEGATIVE_BALANCE",
    });
  }

  const depositAmount = BUSINESS_CONFIG.DEFAULT_DEPOSIT_AMOUNT;
  if (walletBalance < depositAmount) {
    throw new HttpsError(
      "failed-precondition",
      `Số dư không đủ đặt cọc (${depositAmount.toLocaleString("vi-VN")}đ).`,
      { reason: "INSUFFICIENT_BALANCE" }
    );
  }

  // 2. Quy tắc 1 hoạt động: không có reservation active và không có session active
  const activeRes = await db
    .collection("reservations")
    .where("uid", "==", uid)
    .where("status", "==", "active")
    .limit(1)
    .get();

  if (!activeRes.empty) {
    throw new HttpsError(
      "failed-precondition",
      "Bạn đang có một lượt giữ chỗ đang hoạt động.",
      { reason: "HAS_ACTIVE_RESERVATION" }
    );
  }

  const activeSessions = await db
    .collection("sessions")
    .where("uid", "==", uid)
    .where("status", "==", "active")
    .limit(1)
    .get();

  if (!activeSessions.empty) {
    throw new HttpsError(
      "failed-precondition",
      "Bạn đang có một phiên đỗ xe chưa hoàn tất tại bãi.",
      { reason: "HAS_ACTIVE_SESSION" }
    );
  }

  // 3. Kiểm tra bãi đỗ
  const lotDoc = await lotRef.get();
  if (!lotDoc.exists) {
    throw new HttpsError("not-found", "Bãi đỗ không tồn tại.");
  }
  const lotName = lotDoc.data()?.name || "Bãi đỗ xe";

  // 4. Xác định ô đỗ
  let targetSlotId = slotId;
  if (!targetSlotId) {
    const availableSlotsSnapshot = await lotRef
      .collection("slots")
      .where("status", "==", "available")
      .limit(1)
      .get();

    if (availableSlotsSnapshot.empty) {
      throw new HttpsError("resource-exhausted", "Bãi đỗ hiện đã hết chỗ trống.");
    }
    targetSlotId = availableSlotsSnapshot.docs[0].id;
  }

  const slotRef = lotRef.collection("slots").doc(targetSlotId);
  const resRef = db.collection("reservations").doc();
  const txRef = db.collection("transactions").doc();

  const nowMs = Date.now();
  const expiresAtMs = nowMs + BUSINESS_CONFIG.HOLD_DURATION_MINUTES * 60 * 1000;
  let balanceAfter = 0;

  await db.runTransaction(async (transaction) => {
    const slotDoc = await transaction.get(slotRef);
    if (!slotDoc.exists || slotDoc.data()?.status !== "available") {
      throw new HttpsError(
        "resource-exhausted",
        "Vị trí đỗ vừa được người khác chọn. Vui lòng chọn ô khác."
      );
    }

    const latestUserDoc = await transaction.get(userRef);
    const currentBalance = Number(latestUserDoc.data()?.walletBalance || 0);
    if (currentBalance < depositAmount) {
      throw new HttpsError(
        "failed-precondition",
        "Số dư không đủ đặt cọc.",
        { reason: "INSUFFICIENT_BALANCE" }
      );
    }

    balanceAfter = currentBalance - depositAmount;

    // Trừ cọc từ ví
    transaction.update(userRef, {
      walletBalance: balanceAfter,
    });

    // Tạo giao dịch cọc
    transaction.set(txRef, {
      uid,
      type: "reservation_deposit",
      amount: -depositAmount,
      balanceAfter,
      reservationId: resRef.id,
      methodLabel: "Ví nội bộ",
      invoiceNo: `DEP-${Date.now().toString().slice(-8)}`,
      description: `Đặt cọc giữ chỗ ô ${targetSlotId} tại ${lotName}`,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Tạo reservation
    transaction.set(resRef, {
      uid,
      lotId,
      lotName,
      slotId: targetSlotId,
      plate: plateNormalized,
      plateDisplay: PlateUtils.formatDisplay(plateNormalized),
      status: "active",
      createdAt: admin.firestore.Timestamp.fromMillis(nowMs),
      expiresAt: admin.firestore.Timestamp.fromMillis(expiresAtMs),
      remindedExpiring: false,
      extendCount: 0,
      maxExtendCount: BUSINESS_CONFIG.MAX_EXTEND_COUNT,
      depositAmount,
      depositStatus: "held",
    });

    // Cập nhật slot sang reserved
    transaction.update(slotRef, {
      status: "reserved",
      reservationId: resRef.id,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return {
    reservationId: resRef.id,
    slotId: targetSlotId,
    expiresAtMs,
    depositAmount,
    balanceAfter,
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
  const userRef = db.collection("users").doc(uid);

  let refunded = false;
  let refundAmount = 0;
  let balanceAfter = 0;

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

    const createdAtMs = resData.createdAt?.toMillis() || Date.now();
    const elapsedSec = (Date.now() - createdAtMs) / 1000;
    const freeCancelSec = BUSINESS_CONFIG.FREE_CANCEL_MINUTES * 60;

    const userDoc = await transaction.get(userRef);
    const currentBalance = Number(userDoc.data()?.walletBalance || 0);

    const slotRef = db
      .collection("lots")
      .doc(resData.lotId)
      .collection("slots")
      .doc(resData.slotId);

    if (elapsedSec <= freeCancelSec) {
      // Huỷ trong 2 phút -> Hoàn cọc 100%
      refunded = true;
      refundAmount = resData.depositAmount || BUSINESS_CONFIG.DEFAULT_DEPOSIT_AMOUNT;
      balanceAfter = currentBalance + refundAmount;

      transaction.update(userRef, {
        walletBalance: balanceAfter,
      });

      const txRef = db.collection("transactions").doc();
      transaction.set(txRef, {
        uid,
        type: "deposit_refund",
        amount: refundAmount,
        balanceAfter,
        reservationId,
        methodLabel: "Hoàn cọc ví",
        invoiceNo: `REF-${Date.now().toString().slice(-8)}`,
        description: `Hoàn cọc huỷ đặt chỗ trước 2 phút (${resData.lotName})`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      transaction.update(resRef, {
        status: "cancelled",
        depositStatus: "refunded",
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      // Huỷ sau 2 phút -> Mất cọc
      refunded = false;
      refundAmount = 0;
      balanceAfter = currentBalance;

      transaction.update(resRef, {
        status: "cancelled",
        depositStatus: "forfeited",
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Trả slot về available
    transaction.update(slotRef, {
      status: "available",
      reservationId: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return {
    refunded,
    refundAmount,
    balanceAfter,
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
      expiresAt: admin.firestore.Timestamp.fromMillis(newExpiresAtMs),
      extendCount: newExtendCount,
      remindedExpiring: false, // Reset để nhắc lại ở 5 phút cuối mới
    });
  });

  return {
    expiresAtMs: newExpiresAtMs,
    extendCount: newExtendCount,
  };
});
