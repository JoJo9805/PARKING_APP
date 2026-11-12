package com.iotparking.app.core.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.iotparking.app.core.domain.model.Transaction
import com.iotparking.app.core.domain.model.TransactionType
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import javax.inject.Inject
import javax.inject.Singleton

interface WalletRepository {
    fun getTransactionsStream(uid: String): Flow<List<Transaction>>
    suspend fun topUpWallet(amount: Long, methodId: String?): Result<Map<String, Any?>>
}

@Singleton
class WalletRepositoryImpl @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val cloudFunctionRepository: CloudFunctionRepository
) : WalletRepository {

    override fun getTransactionsStream(uid: String): Flow<List<Transaction>> = callbackFlow {
        val query = firestore.collection("transactions")
            .whereEqualTo("uid", uid)
            .orderBy("createdAt", Query.Direction.DESCENDING)

        val registration = query.addSnapshotListener { snapshot, error ->
            if (error != null || snapshot == null) {
                trySend(emptyList())
                return@addSnapshotListener
            }
            val list = snapshot.documents.mapNotNull { doc ->
                val data = doc.data ?: return@mapNotNull null
                val typeStr = (data["type"] as? String)?.uppercase() ?: "TOPUP"
                val type = when (typeStr) {
                    "RESERVATION_DEPOSIT" -> TransactionType.RESERVATION_DEPOSIT
                    "DEPOSIT_REFUND" -> TransactionType.DEPOSIT_REFUND
                    "DEPOSIT_EXCESS_REFUND" -> TransactionType.DEPOSIT_EXCESS_REFUND
                    "PARKING_FEE" -> TransactionType.PARKING_FEE
                    "ADJUSTMENT" -> TransactionType.ADJUSTMENT
                    else -> TransactionType.TOPUP
                }

                Transaction(
                    id = doc.id,
                    uid = data["uid"] as? String ?: uid,
                    type = type,
                    amount = (data["amount"] as? Number)?.toLong() ?: 0L,
                    balanceAfter = (data["balanceAfter"] as? Number)?.toLong() ?: 0L,
                    sessionId = data["sessionId"] as? String,
                    reservationId = data["reservationId"] as? String,
                    methodLabel = data["methodLabel"] as? String,
                    invoiceNo = data["invoiceNo"] as? String,
                    description = data["description"] as? String,
                    createdAt = (data["createdAt"] as? Number)?.toLong() ?: 0L
                )
            }
            trySend(list)
        }
        awaitClose { registration.remove() }
    }

    override suspend fun topUpWallet(amount: Long, methodId: String?): Result<Map<String, Any?>> {
        return cloudFunctionRepository.topUpWallet(amount, methodId)
    }
}

