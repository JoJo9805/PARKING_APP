package com.iotparking.app.core.domain.model

data class Session(
    val id: String,
    val uid: String?,
    val plate: String,
    val plateDisplay: String,
    val lotId: String,
    val lotName: String,
    val assignedSlotId: String?,
    val actualSlotId: String?,
    val reservationId: String?,
    val status: SessionStatus,
    val entryTime: Long,
    val exitTime: Long?,
    val plannedEndTime: Long?,
    val remindedLongParking: Boolean,
    val durationMin: Int?,
    val fee: Long?,
    val depositApplied: Long?,
    val depositRefund: Long?,
    val amountCharged: Long?,
    val entryImageUrl: String?,
    val exitImageUrl: String?,
    val flags: List<String>,
    val transactionId: String?,
    val exitRequested: Boolean = false,
    val exitRequestedAt: Long? = null,
    val exitRequestExpiresAt: Long? = null,
    val waitingAtExitGate: Boolean = false,
    val waitingAtExitGateAt: Long? = null
)

enum class SessionStatus {
    ACTIVE,
    COMPLETED
}
