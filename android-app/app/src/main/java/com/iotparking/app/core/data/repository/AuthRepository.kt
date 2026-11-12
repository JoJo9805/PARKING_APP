package com.iotparking.app.core.data.repository

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.UserProfileChangeRequest
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.messaging.FirebaseMessaging
import com.iotparking.app.core.data.datasource.PreferencesDataStore
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

interface AuthRepository {
    val currentUser: Flow<FirebaseUser?>
    val isUserLoggedIn: Boolean
    val currentUserId: String?
    suspend fun signIn(email: String, pass: String): Result<FirebaseUser>
    suspend fun signUp(email: String, pass: String, displayName: String): Result<FirebaseUser>
    suspend fun sendPasswordResetEmail(email: String): Result<Unit>
    suspend fun sendEmailVerification(): Result<Unit>
    suspend fun updatePassword(newPass: String): Result<Unit>
    suspend fun signOut(): Result<Unit>
    fun reloadUser(): Result<Unit>
}

@Singleton
class AuthRepositoryImpl @Inject constructor(
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore,
    private val preferencesDataStore: PreferencesDataStore
) : AuthRepository {

    override val currentUser: Flow<FirebaseUser?> = callbackFlow {
        val listener = FirebaseAuth.AuthStateListener { fAuth ->
            trySend(fAuth.currentUser)
        }
        auth.addAuthStateListener(listener)
        awaitClose { auth.removeAuthStateListener(listener) }
    }

    override val isUserLoggedIn: Boolean
        get() = auth.currentUser != null

    override val currentUserId: String?
        get() = auth.currentUser?.uid

    override suspend fun signIn(email: String, pass: String): Result<FirebaseUser> {
        return try {
            val result = auth.signInWithEmailAndPassword(email, pass).await()
            val user = result.user ?: throw Exception("Đăng nhập thất bại")
            Result.success(user)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun signUp(email: String, pass: String, displayName: String): Result<FirebaseUser> {
        return try {
            val result = auth.createUserWithEmailAndPassword(email, pass).await()
            val user = result.user ?: throw Exception("Tạo tài khoản thất bại")

            // Cập nhật display name trên Auth
            val profileUpdates = UserProfileChangeRequest.Builder()
                .setDisplayName(displayName)
                .build()
            user.updateProfile(profileUpdates).await()

            // Tạo document trong Firestore users/{uid}
            val userData = hashMapOf<String, Any>(
                "email" to email,
                "displayName" to displayName,
                "walletBalance" to 0L,
                "fcmTokens" to emptyList<String>(),
                "locale" to "vi",
                "defaultPlannedDurationMin" to 60,
                "createdAt" to System.currentTimeMillis()
            )
            firestore.collection("users").document(user.uid).set(userData).await()

            // Gửi email xác minh
            user.sendEmailVerification()

            Result.success(user)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun sendPasswordResetEmail(email: String): Result<Unit> {
        return try {
            auth.sendPasswordResetEmail(email).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun sendEmailVerification(): Result<Unit> {
        return try {
            auth.currentUser?.sendEmailVerification()?.await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun updatePassword(newPass: String): Result<Unit> {
        return try {
            auth.currentUser?.updatePassword(newPass)?.await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun signOut(): Result<Unit> {
        return try {
            val uid = auth.currentUser?.uid
            if (uid != null) {
                try {
                    val token = FirebaseMessaging.getInstance().token.await()
                    firestore.collection("users").document(uid).update(
                        "fcmTokens", FieldValue.arrayRemove(token)
                    ).await()
                    FirebaseMessaging.getInstance().deleteToken().await()
                } catch (_: Exception) {
                    // Tiếp tục sign out ngay cả khi xóa token lỗi
                }
            }
            preferencesDataStore.clearSessionData()
            auth.signOut()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override fun reloadUser(): Result<Unit> {
        return try {
            auth.currentUser?.reload()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

