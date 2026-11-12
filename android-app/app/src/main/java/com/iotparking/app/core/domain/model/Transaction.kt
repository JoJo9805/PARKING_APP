package com.iotparking.app.core.domain.model

data class Transaction(
    val id: String,
    val uid: String,
    val type: TransactionType,
    val amount: Long,
    val balanceAfter: Long,
    val sessionId: String?,
    val reservationId: String?,
    val methodLabel: String?,
    val invoiceNo: String?,
    val description: String?,
    val createdAt: Long
)

enum class TransactionType {
    TOPUP,
    RESERVATION_DEPOSIT,
    DEPOSIT_REFUND,
    DEPOSIT_EXCESS_REFUND,
    PARKING_FEE,
    ADJUSTMENT
}
