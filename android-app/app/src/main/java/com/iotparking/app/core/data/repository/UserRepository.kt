package com.iotparking.app.core.data.repository

import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.iotparking.app.core.domain.model.User
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

interface UserRepository {
    fun getUserStream(uid: String): Flow<User?>
    suspend fun updateDisplayName(uid: String, displayName: String): Result<Unit>
    suspend fun updateDefaultVehicle(uid: String, vehicleId: String?): Result<Unit>
    suspend fun updateLocale(uid: String, locale: String): Result<Unit>
    suspend fun updateDefaultPlannedDuration(uid: String, minutes: Int): Result<Unit>
    suspend fun addFcmToken(uid: String, token: String): Result<Unit>
    suspend fun removeFcmToken(uid: String, token: String): Result<Unit>
}

@Singleton
class UserRepositoryImpl @Inject constructor(
    private val firestore: FirebaseFirestore
) : UserRepository {

    @Suppress("UNCHECKED_CAST")
    override fun getUserStream(uid: String): Flow<User?> = callbackFlow {
        val docRef = firestore.collection("users").document(uid)
        val registration = docRef.addSnapshotListener { snapshot, error ->
            if (error != null) {
                trySend(null)
                return@addSnapshotListener
            }
            if (snapshot != null && snapshot.exists()) {
                val data = snapshot.data ?: return@addSnapshotListener
                val user = User(
                    uid = uid,
                    email = data["email"] as? String ?: "",
                    displayName = data["displayName"] as? String ?: "",
                    defaultVehicleId = data["defaultVehicleId"] as? String,
                    walletBalance = (data["walletBalance"] as? Number)?.toLong() ?: 0L,
                    fcmTokens = (data["fcmTokens"] as? List<String>) ?: emptyList(),
                    locale = data["locale"] as? String ?: "vi",
                    defaultPlannedDurationMin = (data["defaultPlannedDurationMin"] as? Number)?.toInt() ?: 60,
                    createdAt = (data["createdAt"] as? Number)?.toLong() ?: 0L
                )
                trySend(user)
            } else {
                trySend(null)
            }
        }
        awaitClose { registration.remove() }
    }

    override suspend fun updateDisplayName(uid: String, displayName: String): Result<Unit> {
        return updateWhitelistedField(uid, "displayName", displayName)
    }

    override suspend fun updateDefaultVehicle(uid: String, vehicleId: String?): Result<Unit> {
        return updateWhitelistedField(uid, "defaultVehicleId", vehicleId)
    }

    override suspend fun updateLocale(uid: String, locale: String): Result<Unit> {
        return updateWhitelistedField(uid, "locale", locale)
    }

    override suspend fun updateDefaultPlannedDuration(uid: String, minutes: Int): Result<Unit> {
        return updateWhitelistedField(uid, "defaultPlannedDurationMin", minutes)
    }

    override suspend fun addFcmToken(uid: String, token: String): Result<Unit> {
        return try {
            firestore.collection("users").document(uid)
                .update("fcmTokens", FieldValue.arrayUnion(token)).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun removeFcmToken(uid: String, token: String): Result<Unit> {
        return try {
            firestore.collection("users").document(uid)
                .update("fcmTokens", FieldValue.arrayRemove(token)).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private suspend fun updateWhitelistedField(uid: String, field: String, value: Any?): Result<Unit> {
        return try {
            val updateData = if (value != null) mapOf(field to value) else mapOf(field to FieldValue.delete())
            firestore.collection("users").document(uid).update(updateData).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

