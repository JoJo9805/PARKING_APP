import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
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
    correctedAt: FieldValue.serverTimestamp(),
    decision: "accepted",
    sessionId: sessionId || FieldValue.delete(),
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

  let { deviceId, direction, action } = request.data || {};
  const gateAction = action === "CLOSE_GATE" ? "CLOSE_GATE" : "OPEN_GATE";
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

  await cmdRef.set({
    deviceId,
    action: gateAction,
    payload: {
      direction: direction || "in",
      reason: gateAction === "CLOSE_GATE" ? "admin_manual_close" : "admin_manual_open",
    },
    status: "pending",
    createdBy: request.auth?.uid,
    createdAt: FieldValue.serverTimestamp(),
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
      createdAt: FieldValue.serverTimestamp(),
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
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  return {
    balanceAfter: finalBalance,
    transactionId: txRef.id,
  };
});

/**
 * Callable adminCreateReservation: Quản trị viên nhập biển số đặt chỗ trên Web Admin,
 * hệ thống tự động gán ô trống khả dụng (hoặc theo ô chỉ định) và khóa ô sang reserved.
 */
export const adminCreateReservation = onCall({ region: REGION }, async (request) => {
  assertAdmin(request);

  const { plateDisplay, lotId, slotId, holdMinutes } = request.data || {};
  if (!plateDisplay || typeof plateDisplay !== "string") {
    throw new HttpsError("invalid-argument", "Vui lòng nhập biển số xe.");
  }

  const normalized = PlateUtils.normalize(plateDisplay);
  if (!PlateUtils.isValid(normalized)) {
    throw new HttpsError(
      "invalid-argument",
      "Biển số xe không đúng định dạng Việt Nam (VD: 30A-123.45 hoặc 18Y-444.44)."
    );
  }

  const targetLotId = (lotId && String(lotId).trim()) || BUSINESS_CONFIG.DEFAULT_LOT_ID;
  const requestedSlotId = slotId ? String(slotId).trim() : "";
  const durationMinutes = Number(holdMinutes ?? BUSINESS_CONFIG.HOLD_DURATION_MINUTES);
  if (!Number.isFinite(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440) {
    throw new HttpsError(
      "invalid-argument",
      "Thời gian giữ chỗ phải từ 1 đến 1440 phút."
    );
  }

  const db = admin.firestore();
  const lotRef = db.collection("lots").doc(targetLotId);

  // Tìm chủ xe (nếu biển số đã đăng ký trong hệ thống) để liên kết hiển thị
  let linkedUid: string | null = null;
  const vehicleDoc = await db.collection("vehicles").doc(normalized).get();
  if (vehicleDoc.exists) {
    linkedUid = vehicleDoc.data()?.ownerUid || null;
  }

  const formattedDisplay = PlateUtils.formatDisplay(normalized);
  const resRef = db.collection("reservations").doc();
  const nowMs = Date.now();
  const expiresAtMs = nowMs + durationMinutes * 60 * 1000;
  let assignedSlotId = "";

  await db.runTransaction(async (transaction) => {
    const lotDoc = await transaction.get(lotRef);
    if (!lotDoc.exists) {
      throw new HttpsError("not-found", `Không tìm thấy bãi đỗ ${targetLotId}.`);
    }
    const lotName = lotDoc.data()?.name || "Bãi Live ESP32";

    // Chống trùng giữ chỗ hoặc xe đang đỗ active
    const dupResQuery = db
      .collection("reservations")
      .where("plate", "==", normalized)
      .where("status", "==", "active")
      .limit(1);
    const dupResSnap = await transaction.get(dupResQuery);
    if (!dupResSnap.empty) {
      const existingSlot = dupResSnap.docs[0].data()?.slotId || "";
      throw new HttpsError(
        "failed-precondition",
        `Biển số ${formattedDisplay} đang có lượt giữ chỗ hoạt động tại ô ${existingSlot}.`
      );
    }

    const activeSessQuery = db
      .collection("sessions")
      .where("plate", "==", normalized)
      .where("status", "==", "active")
      .limit(1);
    const activeSessSnap = await transaction.get(activeSessQuery);
    if (!activeSessSnap.empty) {
      throw new HttpsError(
        "failed-precondition",
        `Xe biển số ${formattedDisplay} hiện đang đỗ trong bãi.`
      );
    }

    let chosenSlotRef: FirebaseFirestore.DocumentReference | null = null;

    if (requestedSlotId) {
      const candidateRef = lotRef.collection("slots").doc(requestedSlotId);
      const slotDoc = await transaction.get(candidateRef);
      if (!slotDoc.exists) {
        throw new HttpsError("not-found", `Không tìm thấy ô đỗ ${requestedSlotId}.`);
      }
      const sData = slotDoc.data() || {};
      if (sData.status !== "available" || sData.sensorOccupied === true) {
        throw new HttpsError(
          "resource-exhausted",
          `Ô ${requestedSlotId} hiện không còn trống (trạng thái: ${sData.status}).`
        );
      }
      assignedSlotId = slotDoc.id;
      chosenSlotRef = candidateRef;
    } else {
      const slotsSnap = await transaction.get(lotRef.collection("slots"));
      const candidates = slotsSnap.docs
        .map((d) => ({ ref: d.ref, id: d.id, data: d.data() || {} }))
        .filter((s) => s.data.status === "available" && s.data.sensorOccupied !== true)
        .sort((a, b) => a.id.localeCompare(b.id));

      if (candidates.length === 0) {
        throw new HttpsError(
          "resource-exhausted",
          "Tất cả ô đỗ hiện đều đã kín hoặc đang được giữ chỗ."
        );
      }
      assignedSlotId = candidates[0].id;
      chosenSlotRef = candidates[0].ref;
    }

    transaction.set(resRef, {
      uid: linkedUid,
      lotId: targetLotId,
      lotName,
      slotId: assignedSlotId,
      plate: normalized,
      plateDisplay: formattedDisplay,
      status: "active",
      createdBy: "admin",
      createdByUid: request.auth?.uid || null,
      createdAt: Timestamp.fromMillis(nowMs),
      expiresAt: Timestamp.fromMillis(expiresAtMs),
      remindedExpiring: false,
      extendCount: 0,
      maxExtendCount: 0,
      depositAmount: 0,
      depositStatus: "none",
    });

    transaction.update(chosenSlotRef, {
      status: "reserved",
      reservationId: resRef.id,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return {
    reservationId: resRef.id,
    slotId: assignedSlotId,
    plate: normalized,
    plateDisplay: formattedDisplay,
    expiresAtMs,
  };
});

/**
 * Callable adminCancelReservation: Quản trị viên hủy lượt giữ chỗ đang active
 * và giải phóng ô đỗ về available (hoàn cọc nếu lượt đặt từ App có giữ cọc).
 */
export const adminCancelReservation = onCall({ region: REGION }, async (request) => {
  assertAdmin(request);

  const { reservationId, reason } = request.data || {};
  if (!reservationId) {
    throw new HttpsError("invalid-argument", "Thiếu reservationId.");
  }

  const db = admin.firestore();
  const resRef = db.collection("reservations").doc(reservationId);
  let freedSlotId = "";
  let refundedAmount = 0;

  await db.runTransaction(async (transaction) => {
    const resDoc = await transaction.get(resRef);
    if (!resDoc.exists) {
      throw new HttpsError("not-found", "Không tìm thấy lượt đặt chỗ.");
    }
    const data = resDoc.data() || {};
    if (data.status !== "active") {
      throw new HttpsError(
        "failed-precondition",
        `Chỉ có thể hủy lượt đặt chỗ đang giữ (trạng thái hiện tại: ${data.status}).`
      );
    }

    const uid = data.uid;
    const depositAmount = Number(data.depositAmount || 0);
    const shouldRefund = Boolean(uid && depositAmount > 0 && data.depositStatus === "held");

    let newBalance = 0;
    if (shouldRefund) {
      const userRef = db.collection("users").doc(uid);
      const userDoc = await transaction.get(userRef);
      if (userDoc.exists) {
        const currentBal = Number(userDoc.data()?.walletBalance || 0);
        newBalance = currentBal + depositAmount;
        transaction.update(userRef, { walletBalance: newBalance });

        const txRef = db.collection("transactions").doc();
        transaction.set(txRef, {
          uid,
          type: "deposit_refund",
          amount: depositAmount,
          balanceAfter: newBalance,
          reservationId,
          description: reason || "Quản trị viên hủy giữ chỗ & hoàn cọc",
          createdAt: FieldValue.serverTimestamp(),
        });
        refundedAmount = depositAmount;
      }
    }

    transaction.update(resRef, {
      status: "cancelled",
      ...(shouldRefund ? { depositStatus: "refunded" } : {}),
      cancelReason: reason || "Quản trị viên hủy giữ chỗ trên Web",
      cancelledAt: FieldValue.serverTimestamp(),
    });

    if (data.lotId && data.slotId) {
      freedSlotId = data.slotId;
      const slotRef = db
        .collection("lots")
        .doc(data.lotId)
        .collection("slots")
        .doc(data.slotId);
      const slotDoc = await transaction.get(slotRef);
      if (slotDoc.exists && slotDoc.data()?.status === "reserved") {
        transaction.update(slotRef, {
          status: "available",
          reservationId: null,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }
  });

  return {
    reservationId,
    slotId: freedSlotId,
    refundedAmount,
  };
});
