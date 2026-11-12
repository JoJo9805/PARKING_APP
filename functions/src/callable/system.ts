import { onCall, HttpsError } from "firebase-functions/v2/https";
import { REGION } from "../config";

/**
 * Callable getServerTime: trả về timestamp hiện tại của máy chủ (ms)
 * phục vụ đồng bộ lệch đồng hồ phía client Android.
 */
export const getServerTime = onCall({ region: REGION }, (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Vui lòng đăng nhập.");
  }
  return {
    nowMs: Date.now(),
  };
});

