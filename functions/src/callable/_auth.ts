import { CallableRequest, HttpsError } from "firebase-functions/v2/https";

/**
 * Kiểm tra xác thực và quyền Admin (Custom Claim `admin: true`).
 * Ném lỗi `unauthenticated` nếu chưa đăng nhập,
 * hoặc `permission-denied` nếu không có quyền admin.
 */
export function assertAdmin(request: CallableRequest<any>): void {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Vui lòng đăng nhập.");
  }
  if (request.auth.token?.admin !== true) {
    throw new HttpsError(
      "permission-denied",
      "Chỉ quản trị viên mới có quyền thực hiện thao tác này."
    );
  }
}

