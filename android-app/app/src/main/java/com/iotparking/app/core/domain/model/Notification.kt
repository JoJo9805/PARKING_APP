package com.iotparking.app.core.domain.model

data class Notification(
    val id: String,
    val type: String,
    val title: String,
    val body: String,
    val refId: String?,
    val read: Boolean,
    val createdAt: Long
)
