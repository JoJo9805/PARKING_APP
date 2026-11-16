import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { REGION } from "../config";
import { FcmService } from "../services/fcmService";

export const topUpWallet = onCall({ region: REGION }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Vui lòng đăng nhập.");
  }
  const uid = request.auth.uid;
  const { amount, methodId } = request.data || {};

  const numAmount = Number(amount);
  if (!numAmount || numAmount <= 0) {
    throw new HttpsError("invalid-argument", "Số tiền nạp không hợp lệ.");
  }

  const db = getFirestore();
  const userRef = db.collection("users").doc(uid);
  const txRef = db.collection("transactions").doc();

  let finalBalance = 0;

  await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) {
      finalBalance = numAmount;
      transaction.set(userRef, {
        email: request.auth?.token?.email || "",
        displayName: request.auth?.token?.name || "User",
        walletBalance: numAmount,
        fcmTokens: [],
        locale: "vi",
        defaultPlannedDurationMin: 60,
        createdAt: FieldValue.serverTimestamp(),
      });
    } else {
      const currentBalance = Number(userDoc.data()?.walletBalance || 0);
      finalBalance = currentBalance + numAmount;

      transaction.update(userRef, {
        walletBalance: finalBalance,
      });
    }

    transaction.set(txRef, {
      uid,
      type: "topup",
      amount: numAmount,
      balanceAfter: finalBalance,
      methodLabel: methodId ? `Thẻ (${methodId})` : "Thẻ ngân hàng giả lập",
      invoiceNo: `TOP-${Date.now().toString().slice(-8)}`,
      description: `Nạp ${numAmount.toLocaleString("vi-VN")}đ vào ví nội bộ`,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  // Gửi thông báo FCM WALLET_CHANGED
  await FcmService.sendDataOnly(
    uid,
    {
      type: "WALLET_CHANGED",
      delta: `+${numAmount}`,
      newBalance: String(finalBalance),
      reason: "Nạp tiền thành công",
    },
    {
      title: "Nạp tiền thành công",
      body: `Bạn đã nạp thành công ${numAmount.toLocaleString("vi-VN")}đ. Số dư mới: ${finalBalance.toLocaleString("vi-VN")}đ.`,
      refId: txRef.id,
    }
  );

  return {
    transactionId: txRef.id,
    balanceAfter: finalBalance,
  };
});

