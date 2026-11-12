package com.iotparking.app.core.domain.model

data class Lot(
    val id: String,
    val name: String,
    val address: String,
    val latitude: Double,
    val longitude: Double,
    val photos: List<String>,
    val isLive: Boolean,
    val deviceId: String?,
    val deviceOnline: Boolean,
    val totalSlots: Int,
    val availableSlots: Int,
    val pricePerBlock: Long,
    val blockMinutes: Int,
    val graceMinutes: Int,
    val depositAmount: Long,
    val freeCancelMinutes: Int,
    val holdDurationMinutes: Int,
    val maxExtendCount: Int,
    val vehicleTypes: List<VehicleType>,
    val hasRoof: Boolean,
    val hasEv: Boolean,
    val openHours: String,
    val rating: Float,
    val ratingCount: Int
)
