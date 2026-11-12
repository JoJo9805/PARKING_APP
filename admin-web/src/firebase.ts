import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDummyKeyForDevelopment123456789",
  authDomain: "iot-parking-smart.firebaseapp.com",
  projectId: "iot-parking-smart",
  storageBucket: "iot-parking-smart.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef0123456789",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app, 'asia-southeast1');

// Callable functions
export const callAdminCorrectPlate = httpsCallable(functions, 'adminCorrectPlate');
export const callAdminOpenGate = httpsCallable(functions, 'adminOpenGate');
export const callAdminCloseSession = httpsCallable(functions, 'adminCloseSession');
export const callAdminAdjustBalance = httpsCallable(functions, 'adminAdjustBalance');
export const callAdminRefundDeposit = httpsCallable(functions, 'adminRefundDeposit');

