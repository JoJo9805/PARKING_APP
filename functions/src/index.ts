import * as admin from "firebase-admin";

// Khởi tạo Firebase Admin SDK
admin.initializeApp();

// 1. Callable Functions (Client Android & Admin Web)
export { getServerTime } from "./callable/system";
export { addVehicle, removeVehicle } from "./callable/vehicle";
export { topUpWallet } from "./callable/wallet";
export {
  createReservation,
  cancelReservation,
  extendReservation,
} from "./callable/reservation";
export { extendPlannedDuration } from "./callable/session";
export {
  adminCorrectPlate,
  adminOpenGate,
  adminCloseSession,
  adminAdjustBalance,
  adminRefundDeposit,
  adminCreateReservation,
  adminCancelReservation,
} from "./callable/admin";

// 2. Firestore Triggers
export { onGateEventCreated } from "./triggers/onGateEvent";
export { onSlotUpdated } from "./triggers/onSlotUpdate";

// 3. Scheduled Cronjobs
export { reservationCron } from "./scheduled/reservationCron";
export { reminderCron } from "./scheduled/reminderCron";
export { mockLotsCron } from "./scheduled/mockLotsCron";

