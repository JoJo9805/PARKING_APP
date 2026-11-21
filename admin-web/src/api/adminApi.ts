import {
  callAdminOpenGate,
  callAdminCorrectPlate,
  callAdminDismissGateEvent,
  callAdminCloseSession,
  callAdminAdjustBalance,
  callAdminRefundDeposit,
  callAdminCreateReservation,
  callAdminCancelReservation,
} from "../firebase";

function formatError(err: any): Error {
  const code = String(err?.code || "").replace(/^functions\//, "");
  const details = err?.details || {};
  let message = err?.message || "Đã xảy ra lỗi không xác định.";

  if (code === "permission-denied") {
    message = "Bạn không có quyền thực hiện thao tác này (cần quyền Admin).";
  } else if (code === "unauthenticated") {
    message = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  } else if (code === "not-found") {
    const rawMsg = typeof err?.message === "string" ? err.message.trim() : "";
    if (rawMsg && rawMsg.toLowerCase() !== "not-found" && rawMsg.toUpperCase() !== "NOT_FOUND") {
      message = rawMsg;
    } else {
      message =
        "Không tìm thấy dữ liệu hoặc Cloud Function yêu cầu (hãy đảm bảo đã build và khởi động lại Firebase Emulator).";
    }
  } else if (code === "failed-precondition") {
    if (details.reason === "NEGATIVE_BALANCE") {
      message = "Ví của người dùng đang bị âm tiền.";
    } else if (details.reason === "INSUFFICIENT_BALANCE") {
      message = "Số dư không đủ để thực hiện thao tác.";
    } else {
      message = err.message || "Điều kiện thực hiện không hợp lệ.";
    }
  } else if (code === "invalid-argument" || code === "resource-exhausted" || code === "already-exists") {
    message = err.message || "Dữ liệu không hợp lệ hoặc không đủ tài nguyên.";
  }

  return new Error(message);
}

export const adminApi = {
  async openGate(deviceId?: string, direction?: "in" | "out", action: "OPEN_GATE" | "CLOSE_GATE" = "OPEN_GATE") {
    try {
      const res = await callAdminOpenGate({ deviceId, direction, action });
      return res.data;
    } catch (err) {
      throw formatError(err);
    }
  },

  async correctPlate(
    gateEventId: string,
    newPlateDisplay: string,
    options?: {
      sessionId?: string;
      imageUrl?: string;
      cropImageUrl?: string;
      openGate?: boolean;
    }
  ) {
    try {
      const res = await callAdminCorrectPlate({
        gateEventId,
        newPlateDisplay,
        ...(options || {}),
      });
      return res.data;
    } catch (err) {
      throw formatError(err);
    }
  },

  async dismissGateEvent(gateEventId: string, reason?: string) {
    try {
      const res = await callAdminDismissGateEvent({ gateEventId, reason });
      return res.data;
    } catch (err) {
      throw formatError(err);
    }
  },

  async recaptureGate(gateEventId: string, direction: "in" | "out"): Promise<{
    imageUrl?: string | null;
    cropImageUrl?: string | null;
    plateRaw: string;
    plateNormalized: string;
    plateDisplay: string;
    confidence: number;
    isValid: boolean;
    latencyMs: number;
  }> {
    const res = await fetch("http://127.0.0.1:8000/debug/recapture-gate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gateEventId,
        direction: direction.toUpperCase(),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || "Không thể chụp lại ảnh từ Camera IP.");
    }
    return data;
  },

  async closeSession(params: {
    sessionId: string;
    exitTimeMs?: number;
    waiveFee?: boolean;
    closeReason?: string;
  }) {
    try {
      const res = await callAdminCloseSession(params);
      return res.data;
    } catch (err) {
      throw formatError(err);
    }
  },

  async adjustBalance(targetUid: string, deltaAmount: number, reason?: string) {
    try {
      const res = await callAdminAdjustBalance({ targetUid, deltaAmount, reason });
      return res.data;
    } catch (err) {
      throw formatError(err);
    }
  },

  async refundDeposit(reservationId: string, reason?: string) {
    try {
      const res = await callAdminRefundDeposit({ reservationId, reason });
      return res.data;
    } catch (err) {
      throw formatError(err);
    }
  },

  async createReservation(params: {
    plateDisplay: string;
    lotId?: string;
    slotId?: string;
    holdMinutes?: number;
  }) {
    try {
      const res = await callAdminCreateReservation(params);
      return res.data;
    } catch (err) {
      throw formatError(err);
    }
  },

  async cancelReservation(reservationId: string, reason?: string) {
    try {
      const res = await callAdminCancelReservation({ reservationId, reason });
      return res.data;
    } catch (err) {
      throw formatError(err);
    }
  },
};

