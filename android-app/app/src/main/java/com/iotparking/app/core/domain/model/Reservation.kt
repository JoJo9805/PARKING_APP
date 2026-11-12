package com.iotparking.app.core.domain.model

data class Reservation(
    val id: String,
    val uid: String,
    val lotId: String,
    val lotName: String,
    val slotId: String,
    val plate: String,
    val plateDisplay: String,
    val status: ReservationStatus,
    val createdAt: Long,
    val expiresAt: Long,
    val remindedExpiring: Boolean,
    val extendCount: Int,
    val maxExtendCount: Int,
    val depositAmount: Long,
    val depositStatus: DepositStatus
)

enum class ReservationStatus {
    ACTIVE,
    FULFILLED,
    EXPIRED,
    CANCELLED
}

enum class DepositStatus {
    HELD,
    APPLIED,
    REFUNDED,
    FORFEITED
}
