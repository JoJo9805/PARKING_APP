package com.iotparking.app.core.domain

import kotlin.math.ceil

/**
 * Kết quả tính phí đỗ xe.
 *
 * @param fee Tổng phí đỗ xe (VND)
 * @param depositApplied Tiền cọc đã áp dụng (VND)
 * @param depositRefund Tiền cọc được hoàn (VND)
 * @param amountCharged Số tiền thu thêm (VND)
 */
data class FeeResult(
    val fee: Long,
    val depositApplied: Long,
    val depositRefund: Long,
    val amountCharged: Long
)

/**
 * Tính phí đỗ xe theo công thức giống phiên bản TypeScript.
 */
object FeeCalculator {

    /**
     * Tính phí đỗ xe cơ bản.
     *
     * @param durationMin Thời gian đỗ xe (phút)
     * @param graceMinutes Thời gian miễn phí (phút)
     * @param blockMinutes Đơn vị thời gian tính phí (phút)
     * @param pricePerBlock Giá mỗi block (VND)
     * @return Phí đỗ xe (VND)
     */
    fun calculateBaseFee(
        durationMin: Int,
        graceMinutes: Int,
        blockMinutes: Int,
        pricePerBlock: Long
    ): Long {
        if (durationMin <= graceMinutes) return 0L
        val billableMinutes = durationMin - graceMinutes
        val blocks = ceil(billableMinutes.toDouble() / blockMinutes.toDouble()).toLong()
        return blocks * pricePerBlock
    }

    /**
     * Tính phí đầy đủ bao gồm khấu trừ tiền cọc.
     *
     * @param durationMin Thời gian đỗ xe (phút)
     * @param graceMinutes Thời gian miễn phí (phút)
     * @param blockMinutes Đơn vị thời gian tính phí (phút)
     * @param pricePerBlock Giá mỗi block (VND)
     * @param depositApplied Tiền cọc đã áp dụng (VND), mặc định 0
     * @return FeeResult chứa chi tiết phí
     */
    fun calculateFee(
        durationMin: Int,
        graceMinutes: Int,
        blockMinutes: Int,
        pricePerBlock: Long,
        depositApplied: Long = 0L
    ): FeeResult {
        val fee = calculateBaseFee(durationMin, graceMinutes, blockMinutes, pricePerBlock)
        return if (fee >= depositApplied) {
            FeeResult(
                fee = fee,
                depositApplied = depositApplied,
                depositRefund = 0L,
                amountCharged = fee - depositApplied
            )
        } else {
            FeeResult(
                fee = fee,
                depositApplied = depositApplied,
                depositRefund = depositApplied - fee,
                amountCharged = 0L
            )
        }
    }

    /**
     * Tính phí tạm tính theo thời gian thực.
     *
     * @param entryTimeMs Thời gian vào bãi (epoch ms)
     * @param currentTimeMs Thời gian hiện tại (epoch ms)
     * @param graceMinutes Thời gian miễn phí (phút)
     * @param blockMinutes Đơn vị thời gian tính phí (phút)
     * @param pricePerBlock Giá mỗi block (VND)
     * @param depositApplied Tiền cọc đã áp dụng (VND), mặc định 0
     * @return FeeResult chứa chi tiết phí tạm tính
     */
    fun calculateRealTimeFee(
        entryTimeMs: Long,
        currentTimeMs: Long,
        graceMinutes: Int,
        blockMinutes: Int,
        pricePerBlock: Long,
        depositApplied: Long = 0L
    ): FeeResult {
        val elapsedMs = (currentTimeMs - entryTimeMs).coerceAtLeast(0L)
        val durationMin = ceil(elapsedMs.toDouble() / 60_000.0).toInt()
        return calculateFee(durationMin, graceMinutes, blockMinutes, pricePerBlock, depositApplied)
    }
}
