package com.iotparking.app.core.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.iotparking.app.core.domain.model.DepositStatus
import com.iotparking.app.core.domain.model.Reservation
import com.iotparking.app.core.domain.model.ReservationStatus
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import javax.inject.Inject
import javax.inject.Singleton

interface ReservationRepository {
    fun getActiveReservationStream(uid: String): Flow<Reservation?>
    fun getReservationsStream(uid: String): Flow<List<Reservation>>
    suspend fun createReservation(lotId: String, slotId: String?, plateNormalized: String): Result<Map<String, Any?>>
    suspend fun cancelReservation(reservationId: String): Result<Map<String, Any?>>
    suspend fun extendReservation(reservationId: String): Result<Map<String, Any?>>
}

@Singleton
class ReservationRepositoryImpl @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val cloudFunctionRepository: CloudFunctionRepository
) : ReservationRepository {

    override fun getActiveReservationStream(uid: String): Flow<Reservation?> = callbackFlow {
        val query = firestore.collection("reservations")
            .whereEqualTo("uid", uid)
            .whereEqualTo("status", "active")
            .limit(1)

        val registration = query.addSnapshotListener { snapshot, error ->
            if (error != null || snapshot == null || snapshot.isEmpty) {
                trySend(null)
                return@addSnapshotListener
            }
            val doc = snapshot.documents.first()
            val reservation = mapDocToReservation(doc.id, doc.data ?: return@addSnapshotListener)
            trySend(reservation)
        }
        awaitClose { registration.remove() }
    }

    override fun getReservationsStream(uid: String): Flow<List<Reservation>> = callbackFlow {
        val query = firestore.collection("reservations")
            .whereEqualTo("uid", uid)
            .orderBy("createdAt", Query.Direction.DESCENDING)

        val registration = query.addSnapshotListener { snapshot, error ->
            if (error != null || snapshot == null) {
                trySend(emptyList())
                return@addSnapshotListener
            }
            val list = snapshot.documents.mapNotNull { doc ->
                mapDocToReservation(doc.id, doc.data ?: return@mapNotNull null)
            }
            trySend(list)
        }
        awaitClose { registration.remove() }
    }

    override suspend fun createReservation(
        lotId: String,
        slotId: String?,
        plateNormalized: String
    ): Result<Map<String, Any?>> {
        return cloudFunctionRepository.createReservation(lotId, slotId, plateNormalized)
    }

    override suspend fun cancelReservation(reservationId: String): Result<Map<String, Any?>> {
        return cloudFunctionRepository.cancelReservation(reservationId)
    }

    override suspend fun extendReservation(reservationId: String): Result<Map<String, Any?>> {
        return cloudFunctionRepository.extendReservation(reservationId)
    }

    private fun mapDocToReservation(id: String, data: Map<String, Any>): Reservation {
        val statusStr = (data["status"] as? String)?.uppercase() ?: "ACTIVE"
        val status = when (statusStr) {
            "FULFILLED" -> ReservationStatus.FULFILLED
            "EXPIRED" -> ReservationStatus.EXPIRED
            "CANCELLED" -> ReservationStatus.CANCELLED
            else -> ReservationStatus.ACTIVE
        }

        val depStatusStr = (data["depositStatus"] as? String)?.uppercase() ?: "HELD"
        val depStatus = when (depStatusStr) {
            "APPLIED" -> DepositStatus.APPLIED
            "REFUNDED" -> DepositStatus.REFUNDED
            "FORFEITED" -> DepositStatus.FORFEITED
            else -> DepositStatus.HELD
        }

        return Reservation(
            id = id,
            uid = data["uid"] as? String ?: "",
            lotId = data["lotId"] as? String ?: "",
            lotName = data["lotName"] as? String ?: "",
            slotId = data["slotId"] as? String ?: "",
            plate = data["plate"] as? String ?: "",
            plateDisplay = data["plateDisplay"] as? String ?: (data["plate"] as? String ?: ""),
            status = status,
            createdAt = (data["createdAt"] as? Number)?.toLong() ?: 0L,
            expiresAt = (data["expiresAt"] as? Number)?.toLong() ?: 0L,
            remindedExpiring = data["remindedExpiring"] as? Boolean ?: false,
            extendCount = (data["extendCount"] as? Number)?.toInt() ?: 0,
            maxExtendCount = (data["maxExtendCount"] as? Number)?.toInt() ?: 1,
            depositAmount = (data["depositAmount"] as? Number)?.toLong() ?: 5000L,
            depositStatus = depStatus
        )
    }
}

