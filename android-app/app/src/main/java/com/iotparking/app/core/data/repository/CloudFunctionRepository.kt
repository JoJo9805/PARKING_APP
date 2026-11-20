package com.iotparking.app.core.data.repository

import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.functions.FirebaseFunctionsException
import com.iotparking.app.core.di.AppModule
import com.iotparking.app.core.domain.TimeOffsetProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class CloudFunctionRepository @Inject constructor(
    private val functions: FirebaseFunctions,
    private val firebaseAuth: FirebaseAuth,
    private val timeOffsetProvider: TimeOffsetProvider
) {
    /**
     * Gọi callable getServerTime và cập nhật TimeOffsetProvider.
     */
    suspend fun syncServerTime(): Result<Long> {
        val t0 = System.currentTimeMillis()
        val result = callCallable("getServerTime", emptyMap<String, Any>())
        return result.map { data ->
            val t1 = System.currentTimeMillis()
            val nowMs = (data["nowMs"] as? Number)?.toLong() ?: t1
            timeOffsetProvider.updateOffset(nowMs, t0, t1)
            nowMs
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
     * Gọi callable requestExit: Chủ xe gửi yêu cầu ra khỏi bãi (hiệu lực 5 phút).
     */
    suspend fun requestExit(sessionId: String): Result<Map<String, Any?>> {
        return callCallable("requestExit", mapOf("sessionId" to sessionId))
    }

    /**
     * Gọi callable cancelExitRequest: Hủy yêu cầu ra khỏi bãi.
     */
    suspend fun cancelExitRequest(sessionId: String): Result<Map<String, Any?>> {
        return callCallable("cancelExitRequest", mapOf("sessionId" to sessionId))
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
        if (AppModule.USE_EMULATOR) {
            return callEmulatorCallable(name, data)
        }
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

    /**
     * Gọi thẳng Cloud Functions Emulator qua HTTP v2 để tránh FirebaseInstallations
     * báo lỗi API key khi dùng google-services.json dummy ở môi trường local.
     */
    private suspend fun callEmulatorCallable(name: String, data: Any): Result<Map<String, Any?>> {
        val projectId = FirebaseApp.getInstance().options.projectId ?: "demo-iot-parking-smart"
        val idToken = try {
            firebaseAuth.currentUser?.getIdToken(false)?.await()?.token
        } catch (_: Exception) {
            null
        }

        return withContext(Dispatchers.IO) {
            var conn: HttpURLConnection? = null
            try {
                val url = URL("http://${AppModule.EMULATOR_HOST}:5001/$projectId/asia-southeast1/$name")
                conn = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 15_000
                    readTimeout = 15_000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json; charset=utf-8")
                    if (!idToken.isNullOrBlank()) {
                        setRequestProperty("Authorization", "Bearer $idToken")
                    }
                }

                val body = JSONObject().put("data", toJsonValue(data)).toString()
                conn.outputStream.use { os ->
                    os.write(body.toByteArray(Charsets.UTF_8))
                }

                val code = conn.responseCode
                val stream = if (code in 200..299) conn.inputStream else conn.errorStream
                val rawResponse = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()

                if (rawResponse.isBlank()) {
                    return@withContext if (code in 200..299) {
                        Result.success(emptyMap())
                    } else {
                        Result.failure(Exception("Lỗi hệ thống (HTTP $code)"))
                    }
                }

                val json = JSONObject(rawResponse)
                val errorObj = json.optJSONObject("error")
                if (code !in 200..299 || errorObj != null) {
                    val details = errorObj?.optJSONObject("details")
                    val reason = details?.optString("reason")?.takeIf { it.isNotBlank() }
                        ?: errorObj?.optString("message")?.takeIf { it.isNotBlank() }
                        ?: "Lỗi hệ thống (HTTP $code)"
                    return@withContext Result.failure(Exception(reason))
                }

                val resultObj = json.optJSONObject("result") ?: json.optJSONObject("data")
                val parsed = if (resultObj != null) jsonObjectToMap(resultObj) else emptyMap()
                Result.success(parsed)
            } catch (e: Exception) {
                Result.failure(Exception(e.message ?: "Không thể kết nối Functions Emulator", e))
            } finally {
                conn?.disconnect()
            }
        }
    }

    private fun toJsonValue(value: Any?): Any {
        return when (value) {
            null -> JSONObject.NULL
            is Map<*, *> -> JSONObject().apply {
                for ((k, v) in value) {
                    if (k != null) {
                        put(k.toString(), toJsonValue(v))
                    }
                }
            }
            is Iterable<*> -> JSONArray().apply {
                for (item in value) {
                    put(toJsonValue(item))
                }
            }
            is Array<*> -> JSONArray().apply {
                for (item in value) {
                    put(toJsonValue(item))
                }
            }
            else -> value
        }
    }

    private fun jsonObjectToMap(obj: JSONObject): Map<String, Any?> {
        val map = mutableMapOf<String, Any?>()
        val keys = obj.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            map[key] = jsonToKotlin(obj.opt(key))
        }
        return map
    }

    private fun jsonToKotlin(value: Any?): Any? {
        return when (value) {
            null, JSONObject.NULL -> null
            is JSONObject -> jsonObjectToMap(value)
            is JSONArray -> List(value.length()) { idx -> jsonToKotlin(value.opt(idx)) }
            else -> value
        }
    }
}

