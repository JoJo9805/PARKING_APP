import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "@firebase/functions";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getStorage, connectStorageEmulator } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDummyKeyForDevelopment123456789",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "demo-iot-parking-smart.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo-iot-parking-smart",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "demo-iot-parking-smart.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789012",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789012:web:abcdef0123456789",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, "asia-southeast1");

// Tự động kết nối Firebase Emulator Suite nếu được bật
if (import.meta.env.VITE_USE_EMULATOR === "true") {
  const host = import.meta.env.VITE_EMULATOR_HOST || "127.0.0.1";
  console.log(`🔌 Kết nối Web Admin tới Firebase Emulator Suite tại ${host}...`);

  try {
    connectFirestoreEmulator(db, host, 8080);
    connectFunctionsEmulator(functions, host, 5001);
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
    connectStorageEmulator(storage, host, 9199);
  } catch (err) {
    console.warn("Firebase Emulators đã được kết nối hoặc có lỗi khởi tạo:", err);
  }
}

// 5 Callable Functions cho Admin
export const callAdminCorrectPlate = httpsCallable<
  { gateEventId: string; newPlateDisplay: string },
  { sessionId: string; linkedUid: string }
>(functions, "adminCorrectPlate");

export const callAdminOpenGate = httpsCallable<
  { deviceId?: string; direction?: "in" | "out" },
  { commandId: string }
>(functions, "adminOpenGate");

export const callAdminCloseSession = httpsCallable<
  { sessionId: string; exitTimeMs?: number; waiveFee?: boolean; closeReason?: string },
  { fee: number; amountCharged: number; depositRefund: number; invoiceId: string }
>(functions, "adminCloseSession");

export const callAdminAdjustBalance = httpsCallable<
  { targetUid: string; deltaAmount: number; reason?: string },
  { balanceAfter: number; transactionId: string }
>(functions, "adminAdjustBalance");

export const callAdminRefundDeposit = httpsCallable<
  { reservationId: string; reason?: string },
  { balanceAfter: number; transactionId: string }
>(functions, "adminRefundDeposit");
