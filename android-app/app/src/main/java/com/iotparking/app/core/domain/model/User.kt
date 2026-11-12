package com.iotparking.app.core.domain.model

data class User(
    val uid: String,
    val email: String,
    val displayName: String,
    val defaultVehicleId: String?,
    val walletBalance: Long,
    val fcmTokens: List<String>,
    val locale: String,
    val defaultPlannedDurationMin: Int,
    val createdAt: Long
)
