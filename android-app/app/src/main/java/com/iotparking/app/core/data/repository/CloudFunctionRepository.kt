package com.iotparking.app.core.data.repository

import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.functions.FirebaseFunctionsException
import com.iotparking.app.core.domain.TimeOffsetProvider
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class CloudFunctionRepository @Inject constructor(
    private val functions: FirebaseFunctions,
    private val timeOffsetProvider: TimeOffsetProvider
) {
    /**
     * Gọi callable getServerTime và cập nhật TimeOffsetProvider.
     */
    suspend fun syncServerTime(): Result<Long> {
        val t0 = System.currentTimeMillis()
        return try {
            val result = functions.getHttpsCallable("getServerTime").call().await()
            val t1 = System.currentTimeMillis()
            val data = result.getData() as? Map<*, *>
            val nowMs = (data?.get("nowMs") as? Number)?.toLong() ?: t1
            timeOffsetProvider.updateOffset(nowMs, t0, t1)
            Result.success(nowMs)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Gọi callable createReservation.
     */
    suspend fun createReservation(
        lotId: String,
        slotId: String?,
        plateNormalized: String
    ): Result<Map<String, Any?>> {
        val payload = hashMapOf(
            "lotId" to lotId,
            "plateNormalized" to plateNormalized
        )
        if (slotId != null) payload["slotId"] = slotId

        return callCallable("createReservation", payload)
    }

    /**
     * Gọi callable cancelReservation.
     */
    suspend fun cancelReservation(reservationId: String): Result<Map<String, Any?>> {
        return callCallable("cancelReservation", mapOf("reservationId" to reservationId))
    }

    /**
     * Gọi callable extendReservation.
     */
    suspend fun extendReservation(reservationId: String): Result<Map<String, Any?>> {
        return callCallable("extendReservation", mapOf("reservationId" to reservationId))
    }

    /**
     * Gọi callable extendPlannedDuration.
     */
    suspend fun extendPlannedDuration(sessionId: String, addMinutes: Int): Result<Map<String, Any?>> {
        return callCallable("extendPlannedDuration", mapOf(
            "sessionId" to sessionId,
            "addMinutes" to addMinutes
        ))
    }

    /**
     * Gọi callable addVehicle.
     */
    suspend fun addVehicle(
        plateDisplay: String,
        type: String,
        nickname: String,
        setDefault: Boolean
    ): Result<Map<String, Any?>> {
        return callCallable("addVehicle", mapOf(
            "plateDisplay" to plateDisplay,
            "type" to type,
            "nickname" to nickname,
            "setDefault" to setDefault
        ))
    }

    /**
     * Gọi callable removeVehicle.
     */
    suspend fun removeVehicle(plateNormalized: String): Result<Map<String, Any?>> {
        return callCallable("removeVehicle", mapOf("plateNormalized" to plateNormalized))
    }

    /**
     * Gọi callable topUpWallet.
     */
    suspend fun topUpWallet(amount: Long, methodId: String?): Result<Map<String, Any?>> {
        val payload = mutableMapOf<String, Any>("amount" to amount)
        if (methodId != null) payload["methodId"] = methodId
        return callCallable("topUpWallet", payload)
    }

    @Suppress("UNCHECKED_CAST")
    private suspend fun callCallable(name: String, data: Any): Result<Map<String, Any?>> {
        return try {
            val result = functions.getHttpsCallable(name).call(data).await()
            val resultMap = result.getData() as? Map<String, Any?> ?: emptyMap()
            Result.success(resultMap)
        } catch (e: FirebaseFunctionsException) {
            val details = e.details as? Map<*, *>
            val reason = details?.get("reason") as? String ?: e.message ?: "Lỗi hệ thống"
            Result.failure(Exception(reason, e))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

