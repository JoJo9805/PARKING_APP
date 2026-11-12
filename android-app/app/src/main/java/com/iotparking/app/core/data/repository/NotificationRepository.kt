package com.iotparking.app.core.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.iotparking.app.core.domain.model.Notification
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

interface NotificationRepository {
    fun getNotificationsStream(uid: String): Flow<List<Notification>>
    fun getUnreadCountStream(uid: String): Flow<Int>
    suspend fun markAsRead(uid: String, notificationId: String): Result<Unit>
    suspend fun markAllAsRead(uid: String): Result<Unit>
}

@Singleton
class NotificationRepositoryImpl @Inject constructor(
    private val firestore: FirebaseFirestore
) : NotificationRepository {

    override fun getNotificationsStream(uid: String): Flow<List<Notification>> = callbackFlow {
        val query = firestore.collection("users").document(uid)
            .collection("notifications")
            .orderBy("createdAt", Query.Direction.DESCENDING)

        val registration = query.addSnapshotListener { snapshot, error ->
            if (error != null || snapshot == null) {
                trySend(emptyList())
                return@addSnapshotListener
            }
            val list = snapshot.documents.mapNotNull { doc ->
                val data = doc.data ?: return@mapNotNull null
                Notification(
                    id = doc.id,
                    type = data["type"] as? String ?: "INFO",
                    title = data["title"] as? String ?: "",
                    body = data["body"] as? String ?: "",
                    refId = data["refId"] as? String,
                    read = data["read"] as? Boolean ?: false,
                    createdAt = (data["createdAt"] as? Number)?.toLong() ?: 0L
                )
            }
            trySend(list)
        }
        awaitClose { registration.remove() }
    }

    override fun getUnreadCountStream(uid: String): Flow<Int> {
        return getNotificationsStream(uid).map { list -> list.count { !it.read } }
    }

    override suspend fun markAsRead(uid: String, notificationId: String): Result<Unit> {
        return try {
            firestore.collection("users").document(uid)
                .collection("notifications").document(notificationId)
                .update("read", true).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun markAllAsRead(uid: String): Result<Unit> {
        return try {
            val col = firestore.collection("users").document(uid).collection("notifications")
            val unread = col.whereEqualTo("read", false).get().await()
            val batch = firestore.batch()
            for (doc in unread.documents) {
                batch.update(doc.reference, "read", true)
            }
            batch.commit().await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

