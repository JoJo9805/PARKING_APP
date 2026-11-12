import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { REGION } from "../config";
import { PlateUtils } from "../domain/plateUtils";
import { FeeCalculator } from "../domain/feeCalculator";

export const adminCorrectPlate = onCall({ region: REGION }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Vui lòng đăng nhập quyền quản trị.");
  }
  const { gateEventId, newPlateDisplay } = request.data || {};

  if (!gateEventId || !newPlateDisplay) {
    throw new HttpsError("invalid-argument", "Thiếu tham số gateEventId hoặc newPlateDisplay.");
  }

  const normalized = PlateUtils.normalize(newPlateDisplay);
  if (!PlateUtils.isValid(normalized)) {
    throw new HttpsError("invalid-argument", "Biển số mới không đúng định dạng.");
  }

  const db = admin.firestore();
  const eventRef = db.collection("gateEvents").doc(gateEventId);
  const eventDoc = await eventRef.get();

  if (!eventDoc.exists) {
    throw new HttpsError("not-found", "Không tìm thấy sự kiện cổng.");
  }

  // Cập nhật gateEvent
  await eventRef.update({
    plateNormalized: normalized,
    plateRaw: newPlateDisplay,
    isManualCorrected: true,
    correctedBy: request.auth.uid,
    correctedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Tìm chủ xe trong vehicles
  let linkedUid = "";
  const vehicleDoc = await db.collection("vehicles").doc(normalized).get();
  if (vehicleDoc.exists) {
    linkedUid = vehicleDoc.data()?.ownerUid || "";
  }

  // Tìm session tương ứng để cập nhật biển số & gắn chủ xe
  let sessionId = "";
  const sessions = await db
    .collection("sessions")
    .where("status", "==", "active")
    .where("plate", "==", eventDoc.data()?.plateNormalized)
    .limit(1)
    .get();

  if (!sessions.empty) {
    const sDoc = sessions.docs[0];
    sessionId = sDoc.id;
    await sDoc.ref.update({
      plate: normalized,
      plateDisplay: PlateUtils.formatDisplay(normalized),
      ...(linkedUid ? { uid: linkedUid } : {}),
    });
  }

  return {
    sessionId,
    linkedUid,
  };
});

export const adminOpenGate = onCall({ region: REGION }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Vui lòng đăng nhập quyền quản trị.");
  }
  const { deviceId, direction } = request.data || {};

  if (!deviceId) {
    throw new HttpsError("invalid-argument", "Thiếu deviceId.");
  }

  const db = admin.firestore();
  const cmdRef = db.collection("deviceCommands").doc();

  await cmdRef.set({
    deviceId,
    action: "open_barrier",
    payload: {
      direction: direction || "in",
    },
    status: "pending",
    createdBy: request.auth.uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { commandId: cmdRef.id };
});

export const adminCloseSession = onCall({ region: REGION }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Vui lòng đăng nhập quyền quản trị.");
  }
  const { sessionId, exitTimeMs, waiveFee } = request.data || {};

  if (!sessionId) {
    throw new HttpsError("invalid-argument", "Thiếu sessionId.");
  }

  const db = admin.firestore();
  const sessionRef = db.collection("sessions").doc(sessionId);

  let resultFee = 0;
  let resultAmountCharged = 0;
  let resultDepositRefund = 0;

  await db.runTransaction(async (transaction) => {
    const sessionDoc = await transaction.get(sessionRef);
    if (!sessionDoc.exists) {
      throw new HttpsError("not-found", "Không tìm thấy phiên đỗ.");
    }
    const data = sessionDoc.data();
    if (data?.status !== "active") {
      throw new HttpsError("failed-precondition", "Phiên đỗ không còn hoạt động.");
    }

    const entryTimeMs = data?.entryTime?.toMillis() || Date.now();
    const effectiveExitMs = exitTimeMs ? Number(exitTimeMs) : Date.now();
    const durationMin = Math.max(0, Math.round((effectiveExitMs - entryTimeMs) / 60000));

    // Lấy cấu hình giá bãi
    let pricePerBlock = 5000;
    let blockMinutes = 30;
    let graceMinutes = 0;
    const lotRef = db.collection("lots").doc(data?.lotId || "lot_live_01");
    const lotDoc = await transaction.get(lotRef);
    if (lotDoc.exists) {
      const lotData = lotDoc.data();
      pricePerBlock = lotData?.pricePerBlock || 5000;
      blockMinutes = lotData?.blockMinutes || 30;
      graceMinutes = lotData?.graceMinutes || 0;
    }

    const depositApplied = Number(data?.depositApplied || 0);

    if (waiveFee === true) {
      resultFee = 0;
      resultAmountCharged = 0;
      resultDepositRefund = depositApplied;
    } else {
      const feeRes = FeeCalculator.calculateFee(
        durationMin,
        graceMinutes,
        blockMinutes,
        pricePerBlock,
        depositApplied
      );
      resultFee = feeRes.fee;
      resultAmountCharged = feeRes.amountCharged;
      resultDepositRefund = feeRes.depositRefund;
    }

    // Nếu có uid thì điều chỉnh ví
    const uid = data?.uid;
    if (uid) {
      const userRef = db.collection("users").doc(uid);
      const userDoc = await transaction.get(userRef);
      if (userDoc.exists) {
        const currentBal = Number(userDoc.data()?.walletBalance || 0);
        const newBal = currentBal - resultAmountCharged + resultDepositRefund;
        transaction.update(userRef, { walletBalance: newBal });
      }
    }

    // Đóng session
    transaction.update(sessionRef, {
      status: "completed",
      exitTime: admin.firestore.Timestamp.fromMillis(effectiveExitMs),
      durationMin,
      fee: resultFee,
      depositRefund: resultDepositRefund,
      amountCharged: resultAmountCharged,
      closedByAdmin: true,
    });

    // Giải phóng slot
    const slotId = data?.actualSlotId || data?.assignedSlotId;
    if (slotId && data?.lotId) {
      const slotRef = db.collection("lots").doc(data.lotId).collection("slots").doc(slotId);
      transaction.update(slotRef, {
        status: "available",
        sessionId: null,
        reservationId: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });

  return {
    fee: resultFee,
    amountCharged: resultAmountCharged,
    depositRefund: resultDepositRefund,
  };
});

export const adminAdjustBalance = onCall({ region: REGION }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Vui lòng đăng nhập quyền quản trị.");
  }
  const { targetUid, deltaAmount, reason } = request.data || {};

  const delta = Number(deltaAmount);
  if (!targetUid || isNaN(delta) || delta === 0) {
    throw new HttpsError("invalid-argument", "Thiếu targetUid hoặc số tiền điều chỉnh không hợp lệ.");
  }

  const db = admin.firestore();
  const userRef = db.collection("users").doc(targetUid);
  const txRef = db.collection("transactions").doc();

  let finalBalance = 0;

  await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) {
      throw new HttpsError("not-found", "Không tìm thấy người dùng.");
    }
    const current = Number(userDoc.data()?.walletBalance || 0);
    finalBalance = current + delta;

    transaction.update(userRef, { walletBalance: finalBalance });

    transaction.set(txRef, {
      uid: targetUid,
      type: "adjustment",
      amount: delta,
      balanceAfter: finalBalance,
      invoiceNo: `ADJ-${Date.now().toString().slice(-8)}`,
      description: reason || "Quản trị viên điều chỉnh số dư",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return {
    balanceAfter: finalBalance,
    transactionId: txRef.id,
  };
});

export const adminRefundDeposit = onCall({ region: REGION }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Vui lòng đăng nhập quyền quản trị.");
  }
  const { reservationId, reason } = request.data || {};

  if (!reservationId) {
    throw new HttpsError("invalid-argument", "Thiếu reservationId.");
  }

  const db = admin.firestore();
  const resRef = db.collection("reservations").doc(reservationId);
  const txRef = db.collection("transactions").doc();

  let finalBalance = 0;

  await db.runTransaction(async (transaction) => {
    const resDoc = await transaction.get(resRef);
    if (!resDoc.exists) {
      throw new HttpsError("not-found", "Không tìm thấy lượt đặt chỗ.");
    }
    const data = resDoc.data();
    const uid = data?.uid;
    const depositAmount = Number(data?.depositAmount || 5000);

    const userRef = db.collection("users").doc(uid);
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) {
      throw new HttpsError("not-found", "Không tìm thấy chủ lượt đặt chỗ.");
    }

    const currentBalance = Number(userDoc.data()?.walletBalance || 0);
    finalBalance = currentBalance + depositAmount;

    transaction.update(userRef, { walletBalance: finalBalance });
    transaction.update(resRef, { depositStatus: "refunded" });

    transaction.set(txRef, {
      uid,
      type: "deposit_refund",
      amount: depositAmount,
      balanceAfter: finalBalance,
      reservationId,
      description: reason || "Quản trị viên duyệt hoàn cọc đặt chỗ",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return {
    balanceAfter: finalBalance,
    transactionId: txRef.id,
  };
});

