import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { REGION, BUSINESS_CONFIG } from "../config";
import { SessionService } from "../domain/sessionService";

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
    plannedEndTime: Timestamp.fromMillis(newPlannedEndMs),
    remindedLongParking: false, // Để nhắc lại khi sắp đến mốc mới
  });

  return {
    plannedEndTimeMs: newPlannedEndMs,
  };
});

/**
 * Chủ xe gửi yêu cầu ra khỏi bãi trên App Android.
 * Yêu cầu có hiệu lực trong BUSINESS_CONFIG.EXIT_REQUEST_TTL_MINUTES (5 phút).
 */
export const requestExit = onCall({ region: REGION }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Vui lòng đăng nhập.");
  }
  const uid = request.auth.uid;
  const { sessionId } = request.data || {};

  if (!sessionId) {
    throw new HttpsError("invalid-argument", "Thiếu sessionId.");
  }

  const db = admin.firestore();
  const sessionRef = db.collection("sessions").doc(String(sessionId));
  const sessionDoc = await sessionRef.get();

  if (!sessionDoc.exists) {
    throw new HttpsError("not-found", "Không tìm thấy phiên đỗ xe.");
  }

  const data = sessionDoc.data();
  if (data?.uid !== uid) {
    throw new HttpsError("permission-denied", "Không có quyền thao tác phiên đỗ này.");
  }

  if (data?.status !== "active") {
    throw new HttpsError("failed-precondition", "Phiên đỗ xe đã kết thúc.");
  }

  const nowMs = Date.now();
  const ttlMinutes = BUSINESS_CONFIG.EXIT_REQUEST_TTL_MINUTES;
  const waitTtlMs = ttlMinutes * 60 * 1000;
  const waitingAtMs = data?.waitingAtExitGateAt?.toMillis?.() || 0;
  const isWaitingAtExitGate =
    data?.waitingAtExitGate === true &&
    (waitingAtMs === 0 || nowMs - waitingAtMs <= waitTtlMs);

  // Trường hợp xe đã đến Cổng RA trước đó và đang bị giữ chờ xác nhận trên App -> Đóng phiên & Mở Cổng RA ngay lập tức
  if (isWaitingAtExitGate) {
    const closeRes = await SessionService.closeSession({
      sessionId: sessionDoc.id,
      exitTimeMs: nowMs,
      exitImageUrl: data?.waitingExitImageUrl || "",
      closedByAdmin: false,
    });

    if (data?.waitingExitGateEventId) {
      try {
        await db
          .collection("gateEvents")
          .doc(String(data.waitingExitGateEventId))
          .update({
            decision: "accepted",
            status: "processed",
            denyReason: FieldValue.delete(),
            sessionId: sessionDoc.id,
            autoOpenedAfterExitRequest: true,
            updatedAt: FieldValue.serverTimestamp(),
          });
      } catch {
        // Bỏ qua nếu gateEvent không còn tồn tại
      }
    }

    const lotId = data?.lotId || BUSINESS_CONFIG.DEFAULT_LOT_ID;
    const lotDoc = await db.collection("lots").doc(lotId).get();
    const deviceId = lotDoc.data()?.deviceId || BUSINESS_CONFIG.DEFAULT_DEVICE_ID;

    await db.collection("deviceCommands").doc().set({
      deviceId,
      action: "OPEN_GATE",
      payload: {
        direction: "out",
        plate: data?.plateDisplay || data?.plate || "",
        assignedSlot: "",
        reason: "app_exit_request_auto_open",
      },
      status: "pending",
      createdBy: uid,
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      sessionId: sessionDoc.id,
      autoOpenedGate: true,
      fee: closeRes.fee,
      amountCharged: closeRes.amountCharged,
      invoiceId: closeRes.invoiceId,
      ttlMinutes,
    };
  }

  // Trường hợp chủ xe chủ động gửi yêu cầu ra trước khi lái xe tới Cổng RA (hiệu lực 5 phút)
  const expiresAtMs = nowMs + ttlMinutes * 60 * 1000;

  await sessionRef.update({
    exitRequested: true,
    exitRequestedAt: FieldValue.serverTimestamp(),
    exitRequestExpiresAt: Timestamp.fromMillis(expiresAtMs),
    waitingAtExitGate: false,
  });

  return {
    sessionId: sessionDoc.id,
    exitRequestExpiresAtMs: expiresAtMs,
    ttlMinutes,
    autoOpenedGate: false,
  };
});

/**
 * Chủ xe hủy yêu cầu ra khỏi bãi khi đổi ý chưa ra cổng.
 */
export const cancelExitRequest = onCall({ region: REGION }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Vui lòng đăng nhập.");
  }
  const uid = request.auth.uid;
  const { sessionId } = request.data || {};

  if (!sessionId) {
    throw new HttpsError("invalid-argument", "Thiếu sessionId.");
  }

  const db = admin.firestore();
  const sessionRef = db.collection("sessions").doc(String(sessionId));
  const sessionDoc = await sessionRef.get();

  if (!sessionDoc.exists) {
    throw new HttpsError("not-found", "Không tìm thấy phiên đỗ xe.");
  }

  const data = sessionDoc.data();
  if (data?.uid !== uid) {
    throw new HttpsError("permission-denied", "Không có quyền thao tác phiên đỗ này.");
  }

  if (data?.status !== "active") {
    throw new HttpsError("failed-precondition", "Phiên đỗ xe đã kết thúc.");
  }

  await sessionRef.update({
    exitRequested: false,
    exitRequestedAt: FieldValue.delete(),
    exitRequestExpiresAt: FieldValue.delete(),
  });

  return { ok: true };
});

