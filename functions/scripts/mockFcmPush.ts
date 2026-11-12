import * as admin from "firebase-admin";
import { FcmService } from "../src/services/fcmService";

if (!admin.apps.length) {
  admin.initializeApp();
}

async function testPush() {
  const targetUid = process.argv[2];
  const type = (process.argv[3] || "VEHICLE_ENTERED") as any;

  if (!targetUid) {
    console.log("Cách dùng: npm run mock-fcm <targetUid> [VEHICLE_ENTERED|VEHICLE_EXITED|RESERVATION_EXPIRING|RESERVATION_EXPIRED|PLANNED_DURATION_NEAR|WALLET_CHANGED]");
    return;
  }

  console.log(`Bắn thử FCM data-only: type=${type} tới user=${targetUid}...`);

  await FcmService.sendDataOnly(
    targetUid,
    {
      type,
      sessionId: "mock_session_123",
      lotName: "Bãi đỗ Live Thông Minh",
      slotCode: "A1",
      plate: "51A12345",
      entryTimeMs: String(Date.now()),
      amountPaid: "15000",
      depositRefund: "0",
      expiresAtMs: String(Date.now() + 5 * 60 * 1000),
      canExtend: "true",
      depositForfeited: "5000",
      plannedEndMs: String(Date.now() + 10 * 60 * 1000),
      delta: "+50000",
      newBalance: "150000",
      reason: "Bắn thử nghiệm thông báo",
    },
    {
      title: `[Test] Bản tin ${type}`,
      body: `Bản tin thử nghiệm tự động từ script mockFcmPush lúc ${new Date().toLocaleTimeString("vi-VN")}`,
      refId: "test_ref_123",
    }
  );

  console.log("✅ Đã gửi bản tin thành công!");
}

testPush().catch(console.error);

