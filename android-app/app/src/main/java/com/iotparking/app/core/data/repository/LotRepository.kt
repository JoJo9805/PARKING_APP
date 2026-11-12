package com.iotparking.app.core.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.GeoPoint
import com.iotparking.app.core.domain.model.Lot
import com.iotparking.app.core.domain.model.Slot
import com.iotparking.app.core.domain.model.SlotStatus
import com.iotparking.app.core.domain.model.VehicleType
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import javax.inject.Inject
import javax.inject.Singleton

interface LotRepository {
    fun getAllLotsStream(): Flow<List<Lot>>
    fun getLotStream(lotId: String): Flow<Lot?>
    fun getSlotsStream(lotId: String): Flow<List<Slot>>
}

@Singleton
class LotRepositoryImpl @Inject constructor(
    private val firestore: FirebaseFirestore
) : LotRepository {

    @Suppress("UNCHECKED_CAST")
    override fun getAllLotsStream(): Flow<List<Lot>> = callbackFlow {
        val registration = firestore.collection("lots").addSnapshotListener { snapshot, error ->
            if (error != null) {
                trySend(emptyList())
                return@addSnapshotListener
            }
            if (snapshot != null) {
                val lots = snapshot.documents.mapNotNull { doc ->
                    mapDocToLot(doc.id, doc.data ?: return@mapNotNull null)
                }
                trySend(lots)
            } else {
                trySend(emptyList())
            }
        }
        awaitClose { registration.remove() }
    }

    override fun getLotStream(lotId: String): Flow<Lot?> = callbackFlow {
        val registration = firestore.collection("lots").document(lotId).addSnapshotListener { snapshot, error ->
            if (error != null || snapshot == null || !snapshot.exists()) {
                trySend(null)
                return@addSnapshotListener
            }
            val lot = mapDocToLot(snapshot.id, snapshot.data ?: return@addSnapshotListener)
            trySend(lot)
        }
        awaitClose { registration.remove() }
    }

    override fun getSlotsStream(lotId: String): Flow<List<Slot>> = callbackFlow {
        val registration = firestore.collection("lots").document(lotId)
            .collection("slots").addSnapshotListener { snapshot, error ->
                if (error != null || snapshot == null) {
                    trySend(emptyList())
                    return@addSnapshotListener
                }
                val slots = snapshot.documents.mapNotNull { doc ->
                    val data = doc.data ?: return@mapNotNull null
                    val statusStr = (data["status"] as? String)?.uppercase() ?: "AVAILABLE"
                    val status = when (statusStr) {
                        "OCCUPIED" -> SlotStatus.OCCUPIED
                        "RESERVED" -> SlotStatus.RESERVED
                        else -> SlotStatus.AVAILABLE
                    }
                    Slot(
                        id = doc.id,
                        zone = data["zone"] as? String ?: "A",
                        sensorOccupied = data["sensorOccupied"] as? Boolean ?: false,
                        status = status,
                        reservationId = data["reservationId"] as? String,
                        sessionId = data["sessionId"] as? String,
                        updatedAt = (data["updatedAt"] as? Number)?.toLong() ?: 0L
                    )
                }
                trySend(slots)
            }
        awaitClose { registration.remove() }
    }

    @Suppress("UNCHECKED_CAST")
    private fun mapDocToLot(id: String, data: Map<String, Any>): Lot {
        val geo = data["location"] as? GeoPoint
        val vTypes = (data["vehicleTypes"] as? List<String>)?.map {
            if (it.uppercase() == "MOTORBIKE") VehicleType.MOTORBIKE else VehicleType.CAR
        } ?: listOf(VehicleType.CAR)

        return Lot(
            id = id,
            name = data["name"] as? String ?: "",
            address = data["address"] as? String ?: "",
            latitude = geo?.latitude ?: 0.0,
            longitude = geo?.longitude ?: 0.0,
            photos = (data["photos"] as? List<String>) ?: emptyList(),
            isLive = data["isLive"] as? Boolean ?: false,
            deviceId = data["deviceId"] as? String,
            deviceOnline = data["deviceOnline"] as? Boolean ?: false,
            totalSlots = (data["totalSlots"] as? Number)?.toInt() ?: 4,
            availableSlots = (data["availableSlots"] as? Number)?.toInt() ?: 0,
            pricePerBlock = (data["pricePerBlock"] as? Number)?.toLong() ?: 5000L,
            blockMinutes = (data["blockMinutes"] as? Number)?.toInt() ?: 30,
            graceMinutes = (data["graceMinutes"] as? Number)?.toInt() ?: 0,
            depositAmount = (data["depositAmount"] as? Number)?.toLong() ?: 5000L,
            freeCancelMinutes = (data["freeCancelMinutes"] as? Number)?.toInt() ?: 2,
            holdDurationMinutes = (data["holdDurationMinutes"] as? Number)?.toInt() ?: 15,
            maxExtendCount = (data["maxExtendCount"] as? Number)?.toInt() ?: 1,
            vehicleTypes = vTypes,
            hasRoof = data["hasRoof"] as? Boolean ?: false,
            hasEv = data["hasEv"] as? Boolean ?: false,
            openHours = data["openHours"] as? String ?: "24/7",
            rating = (data["rating"] as? Number)?.toFloat() ?: 4.5f,
            ratingCount = (data["ratingCount"] as? Number)?.toInt() ?: 10
        )
    }
}

