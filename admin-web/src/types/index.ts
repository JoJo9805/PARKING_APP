export interface Lot {
  id: string;
  name: string;
  address: string;
  deviceId?: string;
  deviceOnline?: boolean;
  camOnline?: boolean;
  totalSlots: number;
  availableSlots: number;
  pricePerBlock: number;
  blockMinutes: number;
  graceMinutes: number;
  depositAmount: number;
  freeCancelMinutes: number;
  holdDurationMinutes: number;
  maxExtendCount: number;
  isLive: boolean;
  openHours?: string;
  rating?: number;
}

export interface Slot {
  id: string;
  zone: "A" | "B";
  sensorOccupied: boolean;
  status: "available" | "occupied" | "reserved";
  reservationId?: string | null;
  sessionId?: string | null;
  plate?: string;
  updatedAt?: any;
}

export interface GateEvent {
  id: string;
  deviceId: string;
  lotId: string;
  seq?: number;
  direction: "in" | "out" | "IN" | "OUT";
  plateRaw: string;
  plateNormalized: string;
  plateDisplay?: string;
  confidence: number;
  decision: "accepted" | "denied";
  denyReason?: string;
  assignedSlotId?: string;
  matchedReservationId?: string;
  status: "processed" | "error" | "pending";
  imageUrl?: string;
  cropImageUrl?: string;
  latencyMs?: number;
  serverTs?: any;
  isManualCorrected?: boolean;
}

export interface Session {
  id: string;
  uid?: string | null;
  plate: string;
  plateDisplay?: string;
  lotId: string;
  lotName: string;
  assignedSlotId?: string;
  actualSlotId?: string;
  reservationId?: string | null;
  status: "active" | "completed";
  entryTime: any;
  exitTime?: any;
  plannedEndTime?: any;
  durationMin?: number;
  fee?: number;
  depositApplied?: number;
  depositRefund?: number;
  amountCharged?: number;
  entryImageUrl?: string;
  exitImageUrl?: string;
  transactionId?: string;
  closedByAdmin?: boolean;
  closeReason?: string;
}

export interface Reservation {
  id: string;
  uid: string;
  lotId: string;
  lotName: string;
  slotId: string;
  plate: string;
  plateDisplay?: string;
  status: "active" | "fulfilled" | "expired" | "cancelled";
  createdAt: any;
  expiresAt: any;
  extendCount?: number;
  maxExtendCount?: number;
  depositAmount: number;
  depositStatus: "held" | "applied" | "refunded" | "forfeited";
}

export interface Transaction {
  id: string;
  uid: string;
  type: "topup" | "reservation_deposit" | "deposit_refund" | "deposit_excess_refund" | "parking_fee" | "adjustment";
  amount: number;
  balanceAfter: number;
  sessionId?: string;
  reservationId?: string;
  methodLabel?: string;
  invoiceNo?: string;
  description?: string;
  createdAt: any;
}

export interface UserAccount {
  uid: string;
  email: string;
  displayName?: string;
  walletBalance: number;
  defaultVehicleId?: string;
  locale?: string;
  createdAt?: any;
}

export interface Device {
  id: string;
  type: string;
  lotId: string;
  online: boolean;
  lastSeen?: any;
}

export interface DeviceCommand {
  id: string;
  deviceId: string;
  action: string;
  payload?: any;
  status: "pending" | "sent" | "failed";
  createdBy?: string;
  createdAt?: any;
}

