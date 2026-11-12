package com.iotparking.app.core.domain.model

data class Slot(
    val id: String,
    val zone: String,
    val sensorOccupied: Boolean,
    val status: SlotStatus,
    val reservationId: String?,
    val sessionId: String?,
    val updatedAt: Long
)

enum class SlotStatus {
    AVAILABLE,
    OCCUPIED,
    RESERVED
}
