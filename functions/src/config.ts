/**
 * Cấu hình hệ thống Cloud Functions (Chuẩn v1.1)
 */
export const REGION = "asia-southeast1";

export const BUSINESS_CONFIG = {
  // Thiết bị & Bãi Live mặc định (Chuẩn Repo 1)
  DEFAULT_LOT_ID: "lot_live_01",
  DEFAULT_DEVICE_ID: "ESP32_PARKING_01",

  // Bãi đỗ & Block tính phí mặc định (theo giờ: 20.000đ/giờ, chưa đủ 1h vẫn tính 1h)
  DEFAULT_PRICE_PER_BLOCK: 20000, // 20.000đ
  DEFAULT_BLOCK_MINUTES: 60,      // 60 phút/giờ
  DEFAULT_GRACE_MINUTES: 0,       // Miễn phí nếu <= graceMinutes (khi > 0)

  // Đặt chỗ & Cọc
  DEFAULT_DEPOSIT_AMOUNT: 5000,  // Cọc 5.000đ
  HOLD_DURATION_MINUTES: 15,     // Giữ chỗ 15 phút
  FREE_CANCEL_MINUTES: 2,        // Huỷ trong 2 phút hoàn 100%
  MAX_EXTEND_COUNT: 1,           // Tối đa 1 lần gia hạn (+15p)
  EXTEND_DURATION_MINUTES: 15,   // Mỗi lần gia hạn +15 phút

  // Nhắc nhở
  RESERVATION_REMINDER_MINUTES: 5, // Nhắc trước 5 phút khi sắp hết hạn đặt chỗ
  SESSION_REMINDER_MINUTES: 10,    // Nhắc trước 10 phút khi sắp hết thời gian đỗ dự kiến
  DEFAULT_PLANNED_DURATION_MINUTES: 120, // Thời gian đỗ dự kiến mặc định 2 tiếng
};

