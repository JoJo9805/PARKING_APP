import * as admin from "firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { BUSINESS_CONFIG } from "../config";
import { PlateUtils } from "./plateUtils";
import { FeeCalculator, FeeCalculationResult } from "./feeCalculator";
import { FcmService } from "../services/fcmService";

export interface OpenSessionParams {
  plateNormalized: string;
  lotId?: string;
  imageUrl?: string;
  assignedSlotId?: string;
  matchedReservationId?: string | null;
}

export interface OpenSessionResult {
  sessionId: string;
  sessionUid: string | null;
  assignedSlotId: string;
  matchedReservationId: string | null;
  lotName: string;
}

export interface CloseSessionParams {
  sessionId: string;
  exitTimeMs?: number;
  exitImageUrl?: string;
  waiveFee?: boolean;
  closedByAdmin?: boolean;
  closeReason?: string;
}

export interface CloseSessionResult {
  fee: number;
  amountCharged: number;
  depositRefund: number;
  durationMin: number;
  invoiceId: string;
}

export class SessionService {
  /**
   * Mở phiên đỗ mới khi xe vào cổng (dùng cho onGateEvent & adminCorrectPlate).
   */
  public static async openSession(
    params: OpenSessionParams
  ): Promise<OpenSessionResult> {
    const db = admin.firestore();
    const lotId = params.lotId || BUSINESS_CONFIG.DEFAULT_LOT_ID;
    const plateNormalized = PlateUtils.normalize(params.plateNormalized);

    const lotRef = db.collection("lots").doc(lotId);
    const lotDoc = await lotRef.get();
    const lotData = lotDoc.data() || {};
    const lotName = lotData.name || "Bãi đỗ thông minh";

    let matchedReservationId = params.matchedReservationId || null;
    let assignedSlotId = params.assignedSlotId || "";
    let depositApplied = 0;
    let sessionUid: string | null = null;

    // 1. Khớp lượt đặt chỗ đang active nếu chưa có sẵn
    if (matchedReservationId) {
      const resDoc = await db.collection("reservations").doc(matchedReservationId).get();
      if (resDoc.exists) {
        const resData = resDoc.data() || {};
        assignedSlotId = resData.slotId || assignedSlotId;
        depositApplied = Number(resData.depositAmount ?? 0);
        sessionUid = resData.uid || null;

        await resDoc.ref.update({
          status: "fulfilled",
          depositStatus: depositApplied > 0 ? "applied" : (resData.depositStatus || "none"),
          fulfilledAt: FieldValue.serverTimestamp(),
        });
      }
    } else {
      const resSnap = await db
        .collection("reservations")
        .where("plate", "==", plateNormalized)
        .where("status", "==", "active")
        .limit(1)
        .get();

      if (!resSnap.empty) {
        const resDoc = resSnap.docs[0];
        const resData = resDoc.data();
        matchedReservationId = resDoc.id;
        assignedSlotId = resData.slotId;
        depositApplied = Number(resData.depositAmount ?? 0);
        sessionUid = resData.uid || null;

        await resDoc.ref.update({
          status: "fulfilled",
          depositStatus: depositApplied > 0 ? "applied" : (resData.depositStatus || "none"),
          fulfilledAt: FieldValue.serverTimestamp(),
        });
      }
    }

    // 2. Nếu chưa xác định được chủ xe (vào tự do hoặc giữ chỗ tạo từ Admin): tìm chủ xe trong vehicles
    if (!sessionUid) {
      const vehicleDoc = await db.collection("vehicles").doc(plateNormalized).get();
      if (vehicleDoc.exists) {
        sessionUid = vehicleDoc.data()?.ownerUid || null;
      }
    }

    // 3. Thời lượng đỗ dự kiến
    let plannedMinutes = BUSINESS_CONFIG.DEFAULT_PLANNED_DURATION_MINUTES;
    if (sessionUid) {
      const userDoc = await db.collection("users").doc(sessionUid).get();
      if (userDoc.exists) {
        plannedMinutes =
          Number(userDoc.data()?.defaultPlannedDurationMin) || plannedMinutes;
      }
    }

    const nowMs = Date.now();
    const plannedEndMs = nowMs + plannedMinutes * 60 * 1000;

    // 4. Tạo document session
    const sessionRef = db.collection("sessions").doc();
    await sessionRef.set({
      uid: sessionUid,
      plate: plateNormalized,
      plateDisplay: PlateUtils.formatDisplay(plateNormalized),
      lotId,
      lotName,
      assignedSlotId,
      actualSlotId: assignedSlotId,
      reservationId: matchedReservationId,
      status: "active",
      entryTime: Timestamp.fromMillis(nowMs),
      plannedEndTime: Timestamp.fromMillis(plannedEndMs),
      remindedLongParking: false,
      durationMin: 0,
      fee: 0,
      depositApplied,
      depositRefund: 0,
      amountCharged: 0,
      entryImageUrl: params.imageUrl || "",
      exitImageUrl: "",
      flags: [],
      createdAt: FieldValue.serverTimestamp(),
    });

    // 5. Giải phóng khóa đặt chỗ trên slot về available; trạng thái đã đỗ do cảm biến vật lý (sensorOccupied) quyết định
    if (assignedSlotId) {
      await lotRef
        .collection("slots")
        .doc(assignedSlotId)
        .set(
          {
            status: "available",
            sessionId: null,
            reservationId: null,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
    }

    // 6. Gửi FCM thông báo xe vào bãi
    if (sessionUid) {
      await FcmService.sendDataOnly(
        sessionUid,
        {
          type: "VEHICLE_ENTERED",
          sessionId: sessionRef.id,
          lotId,
          lotName,
          slotCode: assignedSlotId,
          plate: plateNormalized,
          entryTimeMs: String(nowMs),
        },
        {
          title: "Xe đã vào bãi",
          body: `Xe ${PlateUtils.formatDisplay(plateNormalized)} đã vào bãi ${lotName}, vị trí ô ${assignedSlotId}.`,
          refId: sessionRef.id,
        }
      );
    }

    return {
      sessionId: sessionRef.id,
      sessionUid,
      assignedSlotId,
      matchedReservationId,
      lotName,
    };
  }

  /**
   * Đóng phiên đỗ, tính phí, khấu trừ/hoàn cọc ví, ghi lịch sử và gửi FCM.
   * Dùng cho cả onGateEvent (cổng RA) và adminCloseSession (Admin Web).
   */
  public static async closeSession(
    params: CloseSessionParams
  ): Promise<CloseSessionResult> {
    const db = admin.firestore();
    const sessionRef = db.collection("sessions").doc(params.sessionId);

    let resultFee = 0;
    let resultAmountCharged = 0;
    let resultDepositRefund = 0;
    let resultDurationMin = 0;
    let invoiceId = "";
    let lotName = "Bãi đỗ thông minh";
    let plateNormalized = "";
    let sessionUid: string | null = null;
    let slotIdToFree = "";

    const preSessionSnap = await sessionRef.get();
    if (!preSessionSnap.exists) {
      throw new Error("Không tìm thấy phiên đỗ xe.");
    }
    const preUid: string | null = preSessionSnap.data()?.uid || null;
    let paymentMethodLabel = "Thẻ thanh toán ảo (Demo)";
    if (preUid) {
      const pmSnap = await db
        .collection("users")
        .doc(preUid)
        .collection("paymentMethods")
        .get();
      if (!pmSnap.empty) {
        const docs = pmSnap.docs.map((d) => d.data() || {});
        const defaultCard = docs.find((d) => d.isDefault === true) || docs[0];
        if (defaultCard) {
          paymentMethodLabel = `${defaultCard.brand || "Visa"} •••• ${defaultCard.last4 || "0000"}`;
        }
      }
    }

    await db.runTransaction(async (transaction) => {
      const sDoc = await transaction.get(sessionRef);
      if (!sDoc.exists) {
        throw new Error("Không tìm thấy phiên đỗ xe.");
      }

      const sData = sDoc.data() || {};
      if (sData.status !== "active") {
        throw new Error(`Phiên đỗ không còn hoạt động (status: ${sData.status}).`);
      }

      plateNormalized = sData.plate || "";
      sessionUid = sData.uid || null;
      slotIdToFree = sData.actualSlotId || sData.assignedSlotId || "";
      const lotId = sData.lotId || BUSINESS_CONFIG.DEFAULT_LOT_ID;
      lotName = sData.lotName || lotName;

      const entryTimeMs = sData.entryTime?.toMillis() || Date.now();
      const effectiveExitMs = params.exitTimeMs ? Number(params.exitTimeMs) : Date.now();
      resultDurationMin = Math.max(0, Math.round((effectiveExitMs - entryTimeMs) / 60000));

      // Lấy cấu hình giá bãi
      let pricePerBlock = BUSINESS_CONFIG.DEFAULT_PRICE_PER_BLOCK;
      let blockMinutes = BUSINESS_CONFIG.DEFAULT_BLOCK_MINUTES;
      let graceMinutes = BUSINESS_CONFIG.DEFAULT_GRACE_MINUTES;

      const lotRef = db.collection("lots").doc(lotId);
      const lotDoc = await transaction.get(lotRef);
      if (lotDoc.exists) {
        const lotData = lotDoc.data();
        pricePerBlock = Number(lotData?.pricePerBlock || pricePerBlock);
        blockMinutes = Number(lotData?.blockMinutes || blockMinutes);
        graceMinutes = Number(lotData?.graceMinutes || graceMinutes);
      }

      const depositApplied = Number(sData.depositApplied || 0);

      let feeResult: FeeCalculationResult;
      if (params.waiveFee === true) {
        feeResult = {
          fee: 0,
          amountCharged: 0,
          depositRefund: depositApplied,
        };
      } else {
        feeResult = FeeCalculator.calculateFee(
          resultDurationMin,
          graceMinutes,
          blockMinutes,
          pricePerBlock,
          depositApplied
        );
      }

      resultFee = feeResult.fee;
      resultAmountCharged = feeResult.amountCharged;
      resultDepositRefund = feeResult.depositRefund;
      invoiceId = `INV-${sessionRef.id.slice(-6).toUpperCase()}`;

      // Ghi nhận giao dịch thanh toán qua thẻ thanh toán ảo liên kết (Demo), không trừ ví
      if (sessionUid && resultAmountCharged > 0) {
        const feeTxRef = db.collection("transactions").doc();
        transaction.set(feeTxRef, {
          uid: sessionUid,
          type: "parking_fee",
          amount: -resultAmountCharged,
          balanceAfter: 0,
          sessionId: sessionRef.id,
          methodLabel: paymentMethodLabel,
          invoiceNo: invoiceId,
          description: params.closedByAdmin
            ? `Quản trị viên đóng phiên đỗ ${resultDurationMin} phút tại ${lotName}`
            : `Thanh toán phí đỗ xe ${resultDurationMin} phút tại ${lotName} (${paymentMethodLabel})`,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      // Cập nhật session
      transaction.update(sessionRef, {
        status: "completed",
        exitRequested: false,
        waitingAtExitGate: false,
        waitingAtExitGateAt: FieldValue.delete(),
        waitingExitGateEventId: FieldValue.delete(),
        waitingExitImageUrl: FieldValue.delete(),
        exitTime: Timestamp.fromMillis(effectiveExitMs),
        durationMin: resultDurationMin,
        fee: resultFee,
        depositRefund: resultDepositRefund,
        amountCharged: resultAmountCharged,
        transactionId: invoiceId,
        ...(params.exitImageUrl ? { exitImageUrl: params.exitImageUrl } : {}),
        ...(params.closedByAdmin ? { closedByAdmin: true, closeReason: params.closeReason || "Admin manual close" } : {}),
      });

      // Giải phóng trạng thái đặt/phiên trên slot (giữ nguyên sensorOccupied theo cảm biến vật lý)
      if (slotIdToFree && lotId) {
        const slotRef = db.collection("lots").doc(lotId).collection("slots").doc(slotIdToFree);
        transaction.set(
          slotRef,
          {
            status: "available",
            sessionId: null,
            reservationId: null,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
    });

    // Gửi FCM VEHICLE_EXITED (ngoài transaction)
    if (sessionUid) {
      await FcmService.sendDataOnly(
        sessionUid,
        {
          type: "VEHICLE_EXITED",
          sessionId: params.sessionId,
          invoiceId,
          amountPaid: String(resultAmountCharged),
          depositRefund: String(resultDepositRefund),
        },
        {
          title: "Xe đã rời bãi",
          body: `Xe ${PlateUtils.formatDisplay(plateNormalized)} đã ra khỏi ${lotName}. Phí đỗ xe: ${resultFee.toLocaleString("vi-VN")}đ (${paymentMethodLabel}).`,
          refId: params.sessionId,
        }
      );
    }

    return {
      fee: resultFee,
      amountCharged: resultAmountCharged,
      depositRefund: resultDepositRefund,
      durationMin: resultDurationMin,
      invoiceId,
    };
  }
}

