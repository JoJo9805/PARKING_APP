import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { REGION, BUSINESS_CONFIG } from "../config";
import { PlateUtils } from "../domain/plateUtils";
import { SessionService } from "../domain/sessionService";
import { assertAdmin } from "./_auth";

/**
 * Callable adminCorrectPlate: Quản trị viên đính chính biển số xe
 * khi camera OCR nhận diện sai hoặc nhận diện thiếu.
 */
export const adminCorrectPlate = onCall({ region: REGION }, async (request) => {
  assertAdmin(request);

  const { gateEventId, newPlateDisplay } = request.data || {};

  if (!gateEventId || !newPlateDisplay) {
    throw new HttpsError(
      "invalid-argument",
      "Thiếu tham số gateEventId hoặc newPlateDisplay."
    );
  }

  const normalized = PlateUtils.normalize(newPlateDisplay);
  if (!PlateUtils.isValid(normalized)) {
    throw new HttpsError(
      "invalid-argument",
      "Biển số mới không đúng định dạng Việt Nam."
    );
  }

  const db = admin.firestore();
  const eventRef = db.collection("gateEvents").doc(gateEventId);
  const eventDoc = await eventRef.get();

  if (!eventDoc.exists) {
    throw new HttpsError("not-found", "Không tìm thấy sự kiện cổng.");
  }

  const eventData = eventDoc.data() || {};
  const oldPlate = eventData.plateNormalized || "";
  const direction = (eventData.direction || "in").toLowerCase();

  // Tìm chủ xe trong bảng vehicles
  let linkedUid = "";
  const vehicleDoc = await db.collection("vehicles").doc(normalized).get();
  if (vehicleDoc.exists) {
    linkedUid = vehicleDoc.data()?.ownerUid || "";
  }

  let sessionId = eventData.sessionId || "";

  // 1. Nếu có session đang active với biển số cũ
  if (oldPlate) {
    const sessions = await db
      .collection("sessions")
      .where("status", "==", "active")
      .where("plate", "==", oldPlate)
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
  }

  // 2. Fix B6: Nếu chưa có session và là sự kiện vào cổng (xe bị từ chối trước đó)
  if (!sessionId && direction === "in") {
    const openRes = await SessionService.openSession({
      plateNormalized: normalized,
      lotId: eventData.lotId || BUSINESS_CONFIG.DEFAULT_LOT_ID,
      imageUrl: eventData.imageUrl || eventData.cropImageUrl || "",
      assignedSlotId: eventData.assignedSlotId,
    });
    sessionId = openRes.sessionId;
    linkedUid = openRes.sessionUid || linkedUid;
  }

  // Cập nhật lại gateEvent
  await eventRef.update({
    plateNormalized: normalized,
    plateRaw: newPlateDisplay,
    plateDisplay: PlateUtils.formatDisplay(normalized),
    isManualCorrected: true,
    correctedBy: request.auth?.uid,
    correctedAt: admin.firestore.FieldValue.serverTimestamp(),
    decision: "accepted",
    sessionId: sessionId || admin.firestore.FieldValue.delete(),
    status: "processed",
  });

  return {
    sessionId,
    linkedUid,
  };
});

/**
 * Callable adminOpenGate: Quản trị viên mở barie khẩn cấp từ Web Admin.
 * Gửi lệnh deviceCommands (action: OPEN_GATE) tới Edge Server / ESP32.
 */
export const adminOpenGate = onCall({ region: REGION }, async (request) => {
  assertAdmin(request);

  let { deviceId, direction } = request.data || {};
  const db = admin.firestore();

  // Fix B2: Nếu không truyền deviceId, tự tra cứu từ lot_live_01 hoặc dùng default
  if (!deviceId) {
    const lotDoc = await db.collection("lots").doc(BUSINESS_CONFIG.DEFAULT_LOT_ID).get();
    if (lotDoc.exists) {
      deviceId = lotDoc.data()?.deviceId || BUSINESS_CONFIG.DEFAULT_DEVICE_ID;
    } else {
      deviceId = BUSINESS_CONFIG.DEFAULT_DEVICE_ID;
    }
  }

  const cmdRef = db.collection("deviceCommands").doc();

  // Fix B1: Edge Server nhận diện action "OPEN_GATE"
  await cmdRef.set({
    deviceId,
    action: "OPEN_GATE",
    payload: {
      direction: direction || "in",
      reason: "admin_manual_open",
    },
    status: "pending",
    createdBy: request.auth?.uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { commandId: cmdRef.id };
});

/**
 * Callable adminCloseSession: Quản trị viên đóng phiên đỗ thủ công từ Web Admin.
 * Sử dụng SessionService.closeSession để tính tiền, hoàn cọc dư và gửi FCM.
 */
export const adminCloseSession = onCall({ region: REGION }, async (request) => {
  assertAdmin(request);

  const { sessionId, exitTimeMs, waiveFee, closeReason } = request.data || {};

  if (!sessionId) {
    throw new HttpsError("invalid-argument", "Thiếu sessionId.");
  }

  try {
    const res = await SessionService.closeSession({
      sessionId,
      exitTimeMs: exitTimeMs ? Number(exitTimeMs) : Date.now(),
      waiveFee: Boolean(waiveFee),
      closedByAdmin: true,
      closeReason: closeReason || "Quản trị viên đóng phiên thủ công",
    });

    return {
      fee: res.fee,
      amountCharged: res.amountCharged,
      depositRefund: res.depositRefund,
      invoiceId: res.invoiceId,
    };
  } catch (err: any) {
    throw new HttpsError("failed-precondition", err.message || "Lỗi khi đóng phiên đỗ.");
  }
});

/**
 * Callable adminAdjustBalance: Quản trị viên cộng / trừ tiền ví người dùng.
 */
export const adminAdjustBalance = onCall({ region: REGION }, async (request) => {
  assertAdmin(request);

  const { targetUid, deltaAmount, reason } = request.data || {};

  const delta = Number(deltaAmount);
  if (!targetUid || isNaN(delta) || delta === 0) {
    throw new HttpsError(
      "invalid-argument",
      "Thiếu targetUid hoặc số tiền điều chỉnh không hợp lệ."
    );
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

/**
 * Callable adminRefundDeposit: Quản trị viên duyệt hoàn tiền cọc đặt chỗ bị mất.
 * Fix B5: Chống hoàn tiền 2 lần (chỉ hoàn khi depositStatus === 'forfeited').
 */
export const adminRefundDeposit = onCall({ region: REGION }, async (request) => {
  assertAdmin(request);

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

    // Fix B5: Chống hoàn cọc 2 lần
    if (data?.depositStatus !== "forfeited") {
      throw new HttpsError(
        "failed-precondition",
        `Không thể hoàn cọc vì trạng thái cọc hiện tại là '${data?.depositStatus}' (chỉ hoàn khi 'forfeited').`
      );
    }

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
