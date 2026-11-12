import * as admin from "firebase-admin";

const projectId =
  process.env.GCLOUD_PROJECT ||
  process.env.FIREBASE_PROJECT ||
  "demo-iot-parking-smart";

process.env.GCLOUD_PROJECT = projectId;

if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
}

if (!admin.apps.length) {
  admin.initializeApp({
    projectId,
  });
}

async function setAdminClaim(email: string) {
  if (!email) {
    console.error("❌ Vui lòng cung cấp email: npx ts-node scripts/setAdminClaim.ts <email>");
    process.exit(1);
  }

  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, {
      ...user.customClaims,
      admin: true,
    });

    console.log(`✅ Đã cấp thành công quyền Admin (admin: true) cho tài khoản: ${email} (UID: ${user.uid})`);
  } catch (err: any) {
    console.error(`❌ Lỗi khi cấp quyền Admin cho ${email}:`, err.message);
    process.exit(1);
  }
}

const targetEmail = process.argv[2];
setAdminClaim(targetEmail);

