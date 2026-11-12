package com.iotparking.app.navigation

sealed class Route(val route: String) {
    // Auth & Onboarding
    data object Splash : Route("splash")
    data object Onboarding : Route("onboarding")
    data object Login : Route("login")
    data object Register : Route("register")
    data object ForgotPassword : Route("forgot_password")

    // 5 Main Tabs
    data object Explore : Route("explore")
    data object Activity : Route("activity")
    data object History : Route("history")
    data object Wallet : Route("wallet")
    data object Account : Route("account")

    // Parking & Reservation
    data object LotDetail : Route("lot_detail/{lotId}") {
        fun createRoute(lotId: String) = "lot_detail/$lotId"
    }
    data object SlotSelection : Route("slot_selection/{lotId}") {
        fun createRoute(lotId: String) = "slot_selection/$lotId"
    }
    data object ReservationConfirm : Route("reservation_confirm/{lotId}/{slotId}") {
        fun createRoute(lotId: String, slotId: String) = "reservation_confirm/$lotId/$slotId"
    }
    data object ActiveReservation : Route("active_reservation/{reservationId}") {
        fun createRoute(reservationId: String) = "active_reservation/$reservationId"
    }
    data object ActiveSession : Route("active_session/{sessionId}") {
        fun createRoute(sessionId: String) = "active_session/$sessionId"
    }

    // History & Statistics
    data object InvoiceDetail : Route("invoice_detail/{sessionId}") {
        fun createRoute(sessionId: String) = "invoice_detail/$sessionId"
    }
    data object Statistics : Route("statistics")

    // Wallet & Cards
    data object CardManagement : Route("card_management")

    // Vehicles
    data object VehicleList : Route("vehicle_list")
    data object AddVehicle : Route("add_vehicle")

    // Notifications & Settings
    data object NotificationInbox : Route("notification_inbox")
    data object ChangePassword : Route("change_password")
}

