package com.iotparking.app.core.di

import com.iotparking.app.core.data.repository.AuthRepository
import com.iotparking.app.core.data.repository.AuthRepositoryImpl
import com.iotparking.app.core.data.repository.LotRepository
import com.iotparking.app.core.data.repository.LotRepositoryImpl
import com.iotparking.app.core.data.repository.NotificationRepository
import com.iotparking.app.core.data.repository.NotificationRepositoryImpl
import com.iotparking.app.core.data.repository.PaymentMethodRepository
import com.iotparking.app.core.data.repository.PaymentMethodRepositoryImpl
import com.iotparking.app.core.data.repository.ReservationRepository
import com.iotparking.app.core.data.repository.ReservationRepositoryImpl
import com.iotparking.app.core.data.repository.SessionRepository
import com.iotparking.app.core.data.repository.SessionRepositoryImpl
import com.iotparking.app.core.data.repository.UserRepository
import com.iotparking.app.core.data.repository.UserRepositoryImpl
import com.iotparking.app.core.data.repository.VehicleRepository
import com.iotparking.app.core.data.repository.VehicleRepositoryImpl
import com.iotparking.app.core.data.repository.WalletRepository
import com.iotparking.app.core.data.repository.WalletRepositoryImpl
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {

    @Binds
    @Singleton
    abstract fun bindAuthRepository(impl: AuthRepositoryImpl): AuthRepository

    @Binds
    @Singleton
    abstract fun bindUserRepository(impl: UserRepositoryImpl): UserRepository

    @Binds
    @Singleton
    abstract fun bindVehicleRepository(impl: VehicleRepositoryImpl): VehicleRepository

    @Binds
    @Singleton
    abstract fun bindLotRepository(impl: LotRepositoryImpl): LotRepository

    @Binds
    @Singleton
    abstract fun bindReservationRepository(impl: ReservationRepositoryImpl): ReservationRepository

    @Binds
    @Singleton
    abstract fun bindSessionRepository(impl: SessionRepositoryImpl): SessionRepository

    @Binds
    @Singleton
    abstract fun bindWalletRepository(impl: WalletRepositoryImpl): WalletRepository

    @Binds
    @Singleton
    abstract fun bindPaymentMethodRepository(impl: PaymentMethodRepositoryImpl): PaymentMethodRepository

    @Binds
    @Singleton
    abstract fun bindNotificationRepository(impl: NotificationRepositoryImpl): NotificationRepository
}

