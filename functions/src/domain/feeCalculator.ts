export interface FeeCalculationResult {
  fee: number;
  depositRefund: number;
  amountCharged: number;
}

export class FeeCalculator {
  /**
   * Tính phí đỗ xe & đối trừ / hoàn cọc dư theo chuẩn v1.1
   */
  public static calculateFee(
    durationMin: number,
    graceMinutes = 0,
    blockMinutes = 60,
    pricePerBlock = 20000,
    depositApplied = 0
  ): FeeCalculationResult {
    let fee = 0;
    if (graceMinutes > 0 && durationMin <= graceMinutes) {
      fee = 0;
    } else {
      const chargeableMin = Math.max(1, durationMin - graceMinutes);
      const blocks = Math.ceil(chargeableMin / blockMinutes);
      fee = blocks * pricePerBlock;
    }

    let depositRefund = 0;
    let amountCharged = 0;

    if (fee >= depositApplied) {
      amountCharged = fee - depositApplied;
      depositRefund = 0;
    } else {
      amountCharged = 0;
      depositRefund = depositApplied - fee;
    }

    return {
      fee,
      depositRefund,
      amountCharged,
    };
  }
}

