import * as admin from "firebase-admin";
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
        depositApplied = Number(resData.depositAmount || BUSINESS_CONFIG.DEFAULT_DEPOSIT_AMOUNT);
        sessionUid = resData.uid || null;

        await resDoc.ref.update({
          status: "fulfilled",
          depositStatus: "applied",
          fulfilledAt: admin.firestore.FieldValue.serverTimestamp(),
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
        depositApplied = Number(resData.depositAmount || BUSINESS_CONFIG.DEFAULT_DEPOSIT_AMOUNT);
        sessionUid = resData.uid || null;

        await resDoc.ref.update({
          status: "fulfilled",
          depositStatus: "applied",
          fulfilledAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    // 2. Nếu vào tự do: tìm chủ xe trong vehicles và tìm slot trống
    if (!matchedReservationId) {
      const vehicleDoc = await db.collection("vehicles").doc(plateNormalized).get();
      if (vehicleDoc.exists) {
        sessionUid = vehicleDoc.data()?.ownerUid || null;
      }

      if (!assignedSlotId) {
        const freeSlots = await lotRef
          .collection("slots")
          .where("status", "==", "available")
          .limit(1)
          .get();

        if (!freeSlots.empty) {
          assignedSlotId = freeSlots.docs[0].id;
        } else {
          assignedSlotId = "A1"; // Fallback nếu chưa cấu hình slot
        }
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
      entryTime: admin.firestore.Timestamp.fromMillis(nowMs),
      plannedEndTime: admin.firestore.Timestamp.fromMillis(plannedEndMs),
      remindedLongParking: false,
      durationMin: 0,
      fee: 0,
      depositApplied,
      depositRefund: 0,
      amountCharged: 0,
      entryImageUrl: params.imageUrl || "",
      exitImageUrl: "",
      flags: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 5. Cập nhật slot sang occupied
    if (assignedSlotId) {
      await lotRef
        .collection("slots")
        .doc(assignedSlotId)
        .set(
          {
            status: "occupied",
            sessionId: sessionRef.id,
            sensorOccupied: true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
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

      // Xử lý ví người dùng
      if (sessionUid) {
        const userRef = db.collection("users").doc(sessionUid);
        const userDoc = await transaction.get(userRef);
        if (userDoc.exists) {
          const currentBal = Number(userDoc.data()?.walletBalance || 0);
          const newBal = currentBal - resultAmountCharged + resultDepositRefund;

          transaction.update(userRef, { walletBalance: newBal });

          // Giao dịch thanh toán phí đỗ xe nếu có thu thêm
          if (resultAmountCharged > 0) {
            const feeTxRef = db.collection("transactions").doc();
            transaction.set(feeTxRef, {
              uid: sessionUid,
              type: "parking_fee",
              amount: -resultAmountCharged,
              balanceAfter: newBal + resultDepositRefund,
              sessionId: sessionRef.id,
              methodLabel: "Ví nội bộ",
              invoiceNo: invoiceId,
              description: params.closedByAdmin
                ? `Quản trị viên đóng phiên đỗ ${resultDurationMin} phút tại ${lotName}`
                : `Thanh toán phí đỗ xe ${resultDurationMin} phút tại ${lotName}`,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }

          // Giao dịch hoàn cọc dư nếu có (v1.1)
          if (resultDepositRefund > 0) {
            const refundTxRef = db.collection("transactions").doc();
            transaction.set(refundTxRef, {
              uid: sessionUid,
              type: "deposit_excess_refund",
              amount: resultDepositRefund,
              balanceAfter: newBal,
              sessionId: sessionRef.id,
              methodLabel: "Hoàn cọc dư ví",
              invoiceNo: `EXC-${sessionRef.id.slice(-6).toUpperCase()}`,
              description: `Hoàn phần tiền cọc dư (${resultDepositRefund.toLocaleString("vi-VN")}đ) phiên đỗ ${lotName}`,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        }
      }

      // Cập nhật session
      transaction.update(sessionRef, {
        status: "completed",
        exitTime: admin.firestore.Timestamp.fromMillis(effectiveExitMs),
        durationMin: resultDurationMin,
        fee: resultFee,
        depositRefund: resultDepositRefund,
        amountCharged: resultAmountCharged,
        transactionId: invoiceId,
        ...(params.exitImageUrl ? { exitImageUrl: params.exitImageUrl } : {}),
        ...(params.closedByAdmin ? { closedByAdmin: true, closeReason: params.closeReason || "Admin manual close" } : {}),
      });

      // Giải phóng slot
      if (slotIdToFree && lotId) {
        const slotRef = db.collection("lots").doc(lotId).collection("slots").doc(slotIdToFree);
        transaction.set(
          slotRef,
          {
            status: "available",
            sessionId: null,
            reservationId: null,
            sensorOccupied: false,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
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
          body: `Xe ${PlateUtils.formatDisplay(plateNormalized)} đã ra khỏi ${lotName}. Phí: ${resultFee.toLocaleString("vi-VN")}đ (Trừ ví: ${resultAmountCharged.toLocaleString("vi-VN")}đ, Hoàn cọc: ${resultDepositRefund.toLocaleString("vi-VN")}đ).`,
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

