package com.iotparking.app.core.domain.model

data class PaymentMethod(
    val id: String,
    val brand: String,
    val last4: String,
    val holderName: String,
    val isDefault: Boolean,
    val createdAt: Long
)
