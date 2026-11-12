package com.iotparking.app.core.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.iotparking.app.core.domain.PlateUtils
import com.iotparking.app.core.domain.model.Vehicle
import com.iotparking.app.core.domain.model.VehicleType
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import javax.inject.Inject
import javax.inject.Singleton

interface VehicleRepository {
    fun getVehiclesStream(uid: String): Flow<List<Vehicle>>
    suspend fun addVehicle(plateDisplay: String, type: VehicleType, nickname: String, setDefault: Boolean): Result<Unit>
    suspend fun removeVehicle(plateNormalized: String): Result<Unit>
}

@Singleton
class VehicleRepositoryImpl @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val cloudFunctionRepository: CloudFunctionRepository
) : VehicleRepository {

    override fun getVehiclesStream(uid: String): Flow<List<Vehicle>> = callbackFlow {
        val query = firestore.collection("vehicles").whereEqualTo("ownerUid", uid)
        val registration = query.addSnapshotListener { snapshot, error ->
            if (error != null) {
                trySend(emptyList())
                return@addSnapshotListener
            }
            if (snapshot != null) {
                val vehicles = snapshot.documents.mapNotNull { doc ->
                    val data = doc.data ?: return@mapNotNull null
                    val typeStr = (data["type"] as? String)?.uppercase() ?: "CAR"
                    val vType = if (typeStr == "MOTORBIKE") VehicleType.MOTORBIKE else VehicleType.CAR
                    Vehicle(
                        plateNormalized = doc.id,
                        plateDisplay = data["plateDisplay"] as? String ?: PlateUtils.formatDisplay(doc.id),
                        type = vType,
                        nickname = data["nickname"] as? String ?: "",
                        ownerUid = data["ownerUid"] as? String ?: uid,
                        createdAt = (data["createdAt"] as? Number)?.toLong() ?: 0L
                    )
                }
                trySend(vehicles)
            } else {
                trySend(emptyList())
            }
        }
        awaitClose { registration.remove() }
    }

    override suspend fun addVehicle(
        plateDisplay: String,
        type: VehicleType,
        nickname: String,
        setDefault: Boolean
    ): Result<Unit> {
        val typeStr = if (type == VehicleType.MOTORBIKE) "motorbike" else "car"
        return cloudFunctionRepository.addVehicle(
            plateDisplay = plateDisplay,
            type = typeStr,
            nickname = nickname,
            setDefault = setDefault
        ).map { }
    }

    override suspend fun removeVehicle(plateNormalized: String): Result<Unit> {
        return cloudFunctionRepository.removeVehicle(plateNormalized).map { }
    }
}

