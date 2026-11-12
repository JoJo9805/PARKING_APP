package com.iotparking.app.core.domain.model

data class Vehicle(
    val plateNormalized: String,
    val plateDisplay: String,
    val type: VehicleType,
    val nickname: String,
    val ownerUid: String,
    val createdAt: Long
)

enum class VehicleType {
    CAR,
    MOTORBIKE
}
