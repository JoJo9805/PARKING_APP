package com.iotparking.app.core.data.repository

import android.util.Log
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.iotparking.app.core.domain.model.Session
import com.iotparking.app.core.domain.model.SessionStatus
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import javax.inject.Inject
import javax.inject.Singleton

interface SessionRepository {
    fun getActiveSessionStream(uid: String): Flow<Session?>
    fun getSessionStream(sessionId: String): Flow<Session?>
    fun getCompletedSessionsStream(uid: String): Flow<List<Session>>
    suspend fun extendPlannedDuration(sessionId: String, addMinutes: Int): Result<Map<String, Any?>>
    suspend fun requestExit(sessionId: String): Result<Map<String, Any?>>
    suspend fun cancelExitRequest(sessionId: String): Result<Map<String, Any?>>
}

@Singleton
class SessionRepositoryImpl @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val cloudFunctionRepository: CloudFunctionRepository
) : SessionRepository {

    override fun getActiveSessionStream(uid: String): Flow<Session?> = callbackFlow {
        val query = firestore.collection("sessions")
            .whereEqualTo("uid", uid)
            .whereEqualTo("status", "active")

        val registration = query.addSnapshotListener { snapshot, error ->
            if (error != null) {
                Log.e("SessionRepository", "getActiveSessionStream error", error)
                trySend(null)
                return@addSnapshotListener
            }
            if (snapshot == null || snapshot.isEmpty) {
                trySend(null)
                return@addSnapshotListener
            }
            val latestSession = snapshot.documents
                .mapNotNull { doc ->
                    mapDocToSession(doc.id, doc.data ?: return@mapNotNull null)
                }
                .maxByOrNull { it.entryTime }
            trySend(latestSession)
        }
        awaitClose { registration.remove() }
    }

    override fun getSessionStream(sessionId: String): Flow<Session?> = callbackFlow {
        val registration = firestore.collection("sessions").document(sessionId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    Log.e("SessionRepository", "getSessionStream($sessionId) error", error)
                    trySend(null)
                    return@addSnapshotListener
                }
                if (snapshot == null || !snapshot.exists()) {
                    trySend(null)
                    return@addSnapshotListener
                }
                val session = mapDocToSession(snapshot.id, snapshot.data ?: return@addSnapshotListener)
                trySend(session)
            }
        awaitClose { registration.remove() }
    }

    override fun getCompletedSessionsStream(uid: String): Flow<List<Session>> = callbackFlow {
        val query = firestore.collection("sessions")
            .whereEqualTo("uid", uid)
            .whereEqualTo("status", "completed")
            .orderBy("exitTime", Query.Direction.DESCENDING)

        val registration = query.addSnapshotListener { snapshot, error ->
            if (error != null) {
                Log.e("SessionRepository", "getCompletedSessionsStream error", error)
                trySend(emptyList())
                return@addSnapshotListener
            }
            if (snapshot == null) {
                trySend(emptyList())
                return@addSnapshotListener
            }
            val sessions = snapshot.documents.mapNotNull { doc ->
                mapDocToSession(doc.id, doc.data ?: return@mapNotNull null)
            }
            trySend(sessions)
        }
        awaitClose { registration.remove() }
    }

    override suspend fun extendPlannedDuration(sessionId: String, addMinutes: Int): Result<Map<String, Any?>> {
        return cloudFunctionRepository.extendPlannedDuration(sessionId, addMinutes)
    }

    override suspend fun requestExit(sessionId: String): Result<Map<String, Any?>> {
        return cloudFunctionRepository.requestExit(sessionId)
    }

    override suspend fun cancelExitRequest(sessionId: String): Result<Map<String, Any?>> {
        return cloudFunctionRepository.cancelExitRequest(sessionId)
    }

    @Suppress("UNCHECKED_CAST")
    private fun mapDocToSession(id: String, data: Map<String, Any>): Session {
        val statusStr = (data["status"] as? String)?.uppercase() ?: "ACTIVE"
        val status = if (statusStr == "COMPLETED") SessionStatus.COMPLETED else SessionStatus.ACTIVE

        return Session(
            id = id,
            uid = data["uid"] as? String,
            plate = data["plate"] as? String ?: "",
            plateDisplay = data["plateDisplay"] as? String ?: (data["plate"] as? String ?: ""),
            lotId = data["lotId"] as? String ?: "",
            lotName = data["lotName"] as? String ?: "",
            assignedSlotId = data["assignedSlotId"] as? String,
            actualSlotId = data["actualSlotId"] as? String,
            reservationId = data["reservationId"] as? String,
            status = status,
            entryTime = data["entryTime"].toEpochMillis() ?: 0L,
            exitTime = data["exitTime"].toEpochMillis(),
            plannedEndTime = data["plannedEndTime"].toEpochMillis(),
            remindedLongParking = data["remindedLongParking"] as? Boolean ?: false,
            durationMin = (data["durationMin"] as? Number)?.toInt(),
            fee = (data["fee"] as? Number)?.toLong(),
            depositApplied = (data["depositApplied"] as? Number)?.toLong(),
            depositRefund = (data["depositRefund"] as? Number)?.toLong(),
            amountCharged = (data["amountCharged"] as? Number)?.toLong(),
            entryImageUrl = data["entryImageUrl"] as? String,
            exitImageUrl = data["exitImageUrl"] as? String,
            flags = (data["flags"] as? List<String>) ?: emptyList(),
            transactionId = data["transactionId"] as? String,
            exitRequested = data["exitRequested"] as? Boolean ?: false,
            exitRequestedAt = data["exitRequestedAt"].toEpochMillis(),
            exitRequestExpiresAt = data["exitRequestExpiresAt"].toEpochMillis(),
            waitingAtExitGate = data["waitingAtExitGate"] as? Boolean ?: false,
            waitingAtExitGateAt = data["waitingAtExitGateAt"].toEpochMillis()
        )
    }
}

