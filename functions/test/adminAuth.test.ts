import { assertAdmin } from "../src/callable/_auth";
import { HttpsError } from "firebase-functions/v2/https";

describe("assertAdmin", () => {
  it("ném lỗi unauthenticated khi request.auth không tồn tại", () => {
    const mockRequest: any = { auth: null };
    expect(() => assertAdmin(mockRequest)).toThrow(HttpsError);
    expect(() => assertAdmin(mockRequest)).toThrow("Vui lòng đăng nhập.");
  });

  it("ném lỗi permission-denied khi request.auth.token.admin !== true", () => {
    const mockRequest: any = {
      auth: {
        uid: "user_regular_123",
        token: { admin: false },
      },
    };
    expect(() => assertAdmin(mockRequest)).toThrow(HttpsError);
    expect(() => assertAdmin(mockRequest)).toThrow("Chỉ quản trị viên mới có quyền thực hiện thao tác này.");
  });

  it("cho phép đi tiếp khi request.auth.token.admin === true", () => {
    const mockRequest: any = {
      auth: {
        uid: "admin_master_001",
        token: { admin: true },
      },
    };
    expect(() => assertAdmin(mockRequest)).not.toThrow();
  });
});

