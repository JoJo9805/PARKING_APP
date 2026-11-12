import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { REGION, BUSINESS_CONFIG } from "../config";
import { PlateUtils } from "../domain/plateUtils";
import { FeeCalculator } from "../domain/feeCalculator";
import { FcmService } from "../services/fcmService";

export const onGateEventCreated = onDocumentCreated(
  {
    document: "gateEvents/{eventId}",
    region: REGION,
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    const rawPlate = data.plateNormalized || data.plateRaw || "";
    const plateNormalized = PlateUtils.normalize(rawPlate);
    const direction = (data.direction || "").toLowerCase();
    const lotId = data.lotId || "lot_live_01";

    if (!plateNormalized) return;

    const db = admin.firestore();

    // Lấy thông tin bãi đỗ
    const lotRef = db.collection("lots").doc(lotId);
    const lotDoc = await lotRef.get();
    const lotData = lotDoc.data() || {};
    const lotName = lotData.name || "Bãi đỗ thông minh";

    if (direction === "in") {
      // 1. Kiểm tra xem có lượt đặt chỗ active nào khớp với biển số này không
      const reservationQuery = await db
        .collection("reservations")
        .where("plate", "==", plateNormalized)
        .where("status", "==", "active")
        .limit(1)
        .get();

      let matchedReservationId: string | null = null;
      let assignedSlotId = "";
      let depositApplied = 0;
      let sessionUid: string | null = null;

      if (!reservationQuery.empty) {
        const resDoc = reservationQuery.docs[0];
        const resData = resDoc.data();
        matchedReservationId = resDoc.id;
        assignedSlotId = resData.slotId;
        depositApplied = Number(resData.depositAmount || BUSINESS_CONFIG.DEFAULT_DEPOSIT_AMOUNT);
        sessionUid = resData.uid;

        // Cập nhật reservation thành fulfilled
        await resDoc.ref.update({
          status: "fulfilled",
          depositStatus: "applied",
          fulfilledAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        // Vào bãi tự do (không đặt trước): Tìm chủ xe trong bảng vehicles
        const vehicleDoc = await db.collection("vehicles").doc(plateNormalized).get();
        if (vehicleDoc.exists) {
          sessionUid = vehicleDoc.data()?.ownerUid || null;
        }

        // Tìm một ô trống trong bãi
        const freeSlots = await lotRef
          .collection("slots")
          .where("status", "==", "available")
          .limit(1)
          .get();

        if (!freeSlots.empty) {
          assignedSlotId = freeSlots.docs[0].id;
        } else {
          assignedSlotId = "A1"; // Fallback nếu chưa có dữ liệu slot
        }
      }

      // Lấy cấu hình thời lượng đỗ dự kiến của user (mặc định 120p)
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

      // Tạo session mới
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
        entryImageUrl: data.imageUrl || data.cropImageUrl || "",
        exitImageUrl: "",
        flags: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Cập nhật ô đỗ sang occupied
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

      // Cập nhật ngược lại gateEvent với sessionId
      await snap.ref.update({
        decision: "accepted",
        assignedSlotId,
        matchedReservationId,
        status: "processed",
      });

      // Gửi FCM VEHICLE_ENTERED nếu xe thuộc tài khoản người dùng
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
    } else if (direction === "out") {
      // Tìm phiên đỗ active của xe
      const sessionQuery = await db
        .collection("sessions")
        .where("plate", "==", plateNormalized)
        .where("status", "==", "active")
        .limit(1)
        .get();

      if (sessionQuery.empty) {
        await snap.ref.update({
          decision: "denied",
          denyReason: "Không tìm thấy phiên đỗ đang hoạt động cho biển số này.",
          status: "error",
        });
        return;
      }

      const sDoc = sessionQuery.docs[0];
      const sData = sDoc.data();
      const entryTimeMs = sData.entryTime?.toMillis() || Date.now();
      const exitTimeMs = Date.now();
      const durationMin = Math.max(0, Math.round((exitTimeMs - entryTimeMs) / 60000));

      const pricePerBlock = Number(lotData.pricePerBlock || BUSINESS_CONFIG.DEFAULT_PRICE_PER_BLOCK);
      const blockMinutes = Number(lotData.blockMinutes || BUSINESS_CONFIG.DEFAULT_BLOCK_MINUTES);
      const graceMinutes = Number(lotData.graceMinutes || BUSINESS_CONFIG.DEFAULT_GRACE_MINUTES);
      const depositApplied = Number(sData.depositApplied || 0);

      // Tính phí đỗ xe & đối trừ hoàn cọc dư
      const feeResult = FeeCalculator.calculateFee(
        durationMin,
        graceMinutes,
        blockMinutes,
        pricePerBlock,
        depositApplied
      );

      const uid = sData.uid;
      const invoiceId = `INV-${sDoc.id.slice(-6).toUpperCase()}`;

      if (uid) {
        const userRef = db.collection("users").doc(uid);
        await db.runTransaction(async (transaction) => {
          const userDoc = await transaction.get(userRef);
          if (!userDoc.exists) return;

          const currentBal = Number(userDoc.data()?.walletBalance || 0);
          const newBal = currentBal - feeResult.amountCharged + feeResult.depositRefund;

          transaction.update(userRef, { walletBalance: newBal });

          // Giao dịch trừ tiền đỗ xe nếu có
          if (feeResult.amountCharged > 0) {
            const feeTxRef = db.collection("transactions").doc();
            transaction.set(feeTxRef, {
              uid,
              type: "parking_fee",
              amount: -feeResult.amountCharged,
              balanceAfter: newBal + feeResult.depositRefund, // tạm thời trước hoàn cọc
              sessionId: sDoc.id,
              methodLabel: "Ví nội bộ",
              invoiceNo: invoiceId,
              description: `Thanh toán phí đỗ xe ${durationMin} phút tại ${lotName}`,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }

          // Giao dịch hoàn cọc dư nếu có (v1.1: deposit_excess_refund)
          if (feeResult.depositRefund > 0) {
            const refundTxRef = db.collection("transactions").doc();
            transaction.set(refundTxRef, {
              uid,
              type: "deposit_excess_refund",
              amount: feeResult.depositRefund,
              balanceAfter: newBal,
              sessionId: sDoc.id,
              methodLabel: "Hoàn cọc dư ví",
              invoiceNo: `EXC-${sDoc.id.slice(-6).toUpperCase()}`,
              description: `Hoàn phần tiền cọc dư (${feeResult.depositRefund.toLocaleString("vi-VN")}đ) phiên đỗ ${lotName}`,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        });

        // Gửi FCM VEHICLE_EXITED
        await FcmService.sendDataOnly(
          uid,
          {
            type: "VEHICLE_EXITED",
            sessionId: sDoc.id,
            invoiceId,
            amountPaid: String(feeResult.amountCharged),
            depositRefund: String(feeResult.depositRefund),
          },
          {
            title: "Xe đã rời bãi",
            body: `Xe ${PlateUtils.formatDisplay(plateNormalized)} đã ra khỏi ${lotName}. Phí: ${feeResult.fee.toLocaleString("vi-VN")}đ (Trừ ví: ${feeResult.amountCharged.toLocaleString("vi-VN")}đ, Hoàn cọc: ${feeResult.depositRefund.toLocaleString("vi-VN")}đ).`,
            refId: sDoc.id,
          }
        );
      }

      // Đóng phiên đỗ
      await sDoc.ref.update({
        status: "completed",
        exitTime: admin.firestore.Timestamp.fromMillis(exitTimeMs),
        durationMin,
        fee: feeResult.fee,
        depositRefund: feeResult.depositRefund,
        amountCharged: feeResult.amountCharged,
        exitImageUrl: data.imageUrl || data.cropImageUrl || "",
        transactionId: invoiceId,
      });

      // Giải phóng ô đỗ
      const slotIdToFree = sData.actualSlotId || sData.assignedSlotId;
      if (slotIdToFree) {
        await lotRef
          .collection("slots")
          .doc(slotIdToFree)
          .set(
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

      await snap.ref.update({
        decision: "accepted",
        sessionId: sDoc.id,
        status: "processed",
      });
    }
  }
);

