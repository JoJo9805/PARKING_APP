import {
  callAdminOpenGate,
  callAdminCorrectPlate,
  callAdminCloseSession,
  callAdminAdjustBalance,
  callAdminRefundDeposit,
} from "../firebase";

function formatError(err: any): Error {
  const code = err?.code || "";
  const details = err?.details || {};
  let message = err?.message || "Đã xảy ra lỗi không xác định.";

  if (code === "permission-denied") {
    message = "Bạn không có quyền thực hiện thao tác này (cần quyền Admin).";
  } else if (code === "unauthenticated") {
    message = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  } else if (code === "not-found") {
    message = "Không tìm thấy dữ liệu yêu cầu trên hệ thống.";
  } else if (code === "failed-precondition") {
    if (details.reason === "NEGATIVE_BALANCE") {
      message = "Ví của người dùng đang bị âm tiền.";
    } else if (details.reason === "INSUFFICIENT_BALANCE") {
      message = "Số dư không đủ để thực hiện thao tác.";
    } else {
      message = err.message || "Điều kiện thực hiện không hợp lệ.";
    }
  } else if (code === "invalid-argument") {
    message = err.message || "Tham số gửi lên không đúng định dạng.";
  }

  return new Error(message);
}

export const adminApi = {
  async openGate(deviceId?: string, direction?: "in" | "out") {
    try {
      const res = await callAdminOpenGate({ deviceId, direction });
      return res.data;
    } catch (err) {
      throw formatError(err);
    }
  },

  async correctPlate(gateEventId: string, newPlateDisplay: string) {
    try {
      const res = await callAdminCorrectPlate({ gateEventId, newPlateDisplay });
      return res.data;
    } catch (err) {
      throw formatError(err);
    }
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
};

