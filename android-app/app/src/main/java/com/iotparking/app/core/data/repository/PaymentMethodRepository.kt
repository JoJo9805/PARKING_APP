package com.iotparking.app.core.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.iotparking.app.core.domain.model.PaymentMethod
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

interface PaymentMethodRepository {
    fun getPaymentMethodsStream(uid: String): Flow<List<PaymentMethod>>
    suspend fun addPaymentMethod(uid: String, brand: String, last4: String, holderName: String, isDefault: Boolean): Result<Unit>
    suspend fun deletePaymentMethod(uid: String, id: String): Result<Unit>
    suspend fun setDefaultPaymentMethod(uid: String, id: String): Result<Unit>
}

@Singleton
class PaymentMethodRepositoryImpl @Inject constructor(
    private val firestore: FirebaseFirestore
) : PaymentMethodRepository {

    override fun getPaymentMethodsStream(uid: String): Flow<List<PaymentMethod>> = callbackFlow {
        val col = firestore.collection("users").document(uid).collection("paymentMethods")
        val registration = col.addSnapshotListener { snapshot, error ->
            if (error != null || snapshot == null) {
                trySend(emptyList())
                return@addSnapshotListener
            }
            val methods = snapshot.documents.mapNotNull { doc ->
                val data = doc.data ?: return@mapNotNull null
                PaymentMethod(
                    id = doc.id,
                    brand = data["brand"] as? String ?: "Visa",
                    last4 = data["last4"] as? String ?: "0000",
                    holderName = data["holderName"] as? String ?: "",
                    isDefault = data["isDefault"] as? Boolean ?: false,
                    createdAt = (data["createdAt"] as? Number)?.toLong() ?: 0L
                )
            }
            trySend(methods)
        }
        awaitClose { registration.remove() }
    }

    override suspend fun addPaymentMethod(
        uid: String,
        brand: String,
        last4: String,
        holderName: String,
        isDefault: Boolean
    ): Result<Unit> {
        return try {
            val col = firestore.collection("users").document(uid).collection("paymentMethods")
            if (isDefault) {
                // Đặt các thẻ khác thành false
                val existing = col.whereEqualTo("isDefault", true).get().await()
                for (doc in existing.documents) {
                    doc.reference.update("isDefault", false).await()
                }
            }
            val data = hashMapOf(
                "brand" to brand,
                "last4" to last4,
                "holderName" to holderName,
                "isDefault" to isDefault,
                "createdAt" to System.currentTimeMillis()
            )
            col.add(data).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun deletePaymentMethod(uid: String, id: String): Result<Unit> {
        return try {
            firestore.collection("users").document(uid)
                .collection("paymentMethods").document(id).delete().await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun setDefaultPaymentMethod(uid: String, id: String): Result<Unit> {
        return try {
            val col = firestore.collection("users").document(uid).collection("paymentMethods")
            val existing = col.whereEqualTo("isDefault", true).get().await()
            for (doc in existing.documents) {
                doc.reference.update("isDefault", false).await()
            }
            col.document(id).update("isDefault", true).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

