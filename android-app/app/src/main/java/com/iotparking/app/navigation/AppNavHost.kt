package com.iotparking.app.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.iotparking.app.feature.auth.AuthViewModel
import com.iotparking.app.feature.auth.ForgotPasswordScreen
import com.iotparking.app.feature.auth.LoginScreen
import com.iotparking.app.feature.auth.RegisterScreen
import com.iotparking.app.feature.history.HistoryScreen
import com.iotparking.app.feature.history.HistoryViewModel
import com.iotparking.app.feature.history.InvoiceDetailScreen
import com.iotparking.app.feature.history.StatisticsScreen
import com.iotparking.app.feature.home.HomeScreen
import com.iotparking.app.feature.home.HomeViewModel
import com.iotparking.app.feature.inbox.InboxScreen
import com.iotparking.app.feature.inbox.InboxViewModel
import com.iotparking.app.feature.lotdetail.LotDetailScreen
import com.iotparking.app.feature.lotdetail.LotDetailViewModel
import com.iotparking.app.feature.onboarding.OnboardingScreen
import com.iotparking.app.feature.onboarding.OnboardingViewModel
import com.iotparking.app.feature.onboarding.SplashScreen
import com.iotparking.app.feature.reservation.ActiveReservationScreen
import com.iotparking.app.feature.reservation.ReservationConfirmScreen
import com.iotparking.app.feature.reservation.ReservationViewModel
import com.iotparking.app.feature.reservation.SlotSelectionScreen
import com.iotparking.app.feature.session.SessionScreen
import com.iotparking.app.feature.session.SessionViewModel
import com.iotparking.app.feature.settings.ChangePasswordScreen
import com.iotparking.app.feature.settings.SettingsScreen
import com.iotparking.app.feature.settings.SettingsViewModel
import com.iotparking.app.feature.vehicle.AddVehicleScreen
import com.iotparking.app.feature.vehicle.VehicleListScreen
import com.iotparking.app.feature.vehicle.VehicleViewModel
import com.iotparking.app.feature.wallet.CardManagementScreen
import com.iotparking.app.feature.wallet.WalletScreen
import com.iotparking.app.feature.wallet.WalletViewModel

@Composable
fun AppNavHost(
    navController: NavHostController = rememberNavController()
) {
    Scaffold(
        containerColor = androidx.compose.material3.MaterialTheme.colorScheme.background,
        bottomBar = { BottomNavBar(navController = navController) }
    ) { paddingValues ->
        NavHost(
            navController = navController,
            startDestination = Route.Splash.route,
            modifier = Modifier.padding(paddingValues)
        ) {
            // Splash Screen
            composable(Route.Splash.route) {
                val onboardingViewModel: OnboardingViewModel = hiltViewModel()
                val onboardingState by onboardingViewModel.uiState.collectAsState()
                val isFirstLaunch = !onboardingState.hasCompletedOnboarding
                val authViewModel: AuthViewModel = hiltViewModel()
                val isLoggedIn = authViewModel.uiState.collectAsState().value.loginSuccess

                SplashScreen(
                    isLoggedIn = isLoggedIn,
                    isFirstLaunch = isFirstLaunch,
                    onNavigateToHome = {
                        navController.navigate(Route.Explore.route) {
                            popUpTo(Route.Splash.route) { inclusive = true }
                        }
                    },
                    onNavigateToOnboarding = {
                        navController.navigate(Route.Onboarding.route) {
                            popUpTo(Route.Splash.route) { inclusive = true }
                        }
                    },
                    onNavigateToLogin = {
                        navController.navigate(Route.Login.route) {
                            popUpTo(Route.Splash.route) { inclusive = true }
                        }
                    }
                )
            }

            // Onboarding
            composable(Route.Onboarding.route) {
                val onboardingViewModel: OnboardingViewModel = hiltViewModel()
                OnboardingScreen(
                    viewModel = onboardingViewModel,
                    onFinished = {
                        onboardingViewModel.completeOnboarding()
                        navController.navigate(Route.Login.route) {
                            popUpTo(Route.Onboarding.route) { inclusive = true }
                        }
                    }
                )
            }

            // Auth
            composable(Route.Login.route) {
                val authViewModel: AuthViewModel = hiltViewModel()
                LoginScreen(
                    viewModel = authViewModel,
                    onLoginSuccess = {
                        navController.navigate(Route.Explore.route) {
                            popUpTo(Route.Login.route) { inclusive = true }
                        }
                    },
                    onNavigateToRegister = { navController.navigate(Route.Register.route) },
                    onNavigateToForgotPassword = { navController.navigate(Route.ForgotPassword.route) }
                )
            }

            composable(Route.Register.route) {
                val authViewModel: AuthViewModel = hiltViewModel()
                RegisterScreen(
                    viewModel = authViewModel,
                    onRegisterSuccess = {
                        navController.navigate(Route.Explore.route) {
                            popUpTo(Route.Register.route) { inclusive = true }
                        }
                    },
                    onNavigateToLogin = { navController.popBackStack() }
                )
            }

            composable(Route.ForgotPassword.route) {
                val authViewModel: AuthViewModel = hiltViewModel()
                ForgotPasswordScreen(
                    viewModel = authViewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            // 5 Main Tabs
            composable(Route.Explore.route) {
                val homeViewModel: HomeViewModel = hiltViewModel()
                HomeScreen(
                    viewModel = homeViewModel,
                    onNavigateToLotDetail = { lotId ->
                        navController.navigate(Route.LotDetail.createRoute(lotId))
                    },
                    onNavigateToActiveReservation = { resId ->
                        navController.navigate(Route.ActiveReservation.createRoute(resId))
                    },
                    onNavigateToActiveSession = { sessionId ->
                        navController.navigate(Route.ActiveSession.createRoute(sessionId))
                    }
                )
            }

            composable(Route.Activity.route) {
                // Tab Hoạt động: Mở phiên đỗ hoặc giữ chỗ đang hoạt động
                val sessionViewModel: SessionViewModel = hiltViewModel()
                SessionScreen(
                    viewModel = sessionViewModel,
                    onNavigateBack = { navController.navigate(Route.Explore.route) }
                )
            }

            composable(Route.History.route) {
                val historyViewModel: HistoryViewModel = hiltViewModel()
                HistoryScreen(
                    viewModel = historyViewModel,
                    onNavigateToInvoice = { sessionId ->
                        navController.navigate(Route.InvoiceDetail.createRoute(sessionId))
                    },
                    onNavigateToStatistics = {
                        navController.navigate(Route.Statistics.route)
                    }
                )
            }

            composable(Route.Wallet.route) {
                val walletViewModel: WalletViewModel = hiltViewModel()
                WalletScreen(
                    viewModel = walletViewModel,
                    onNavigateToCardManagement = {
                        navController.navigate(Route.CardManagement.route)
                    }
                )
            }

            composable(Route.Account.route) {
                val settingsViewModel: SettingsViewModel = hiltViewModel()
                SettingsScreen(
                    viewModel = settingsViewModel,
                    onNavigateToVehicles = { navController.navigate(Route.VehicleList.route) },
                    onNavigateToCards = { navController.navigate(Route.CardManagement.route) },
                    onNavigateToChangePassword = { navController.navigate(Route.ChangePassword.route) },
                    onNavigateToInbox = { navController.navigate(Route.NotificationInbox.route) },
                    onSignOutSuccess = {
                        navController.navigate(Route.Login.route) {
                            popUpTo(0) { inclusive = true }
                        }
                    }
                )
            }

            // Lot & Reservation Flow
            composable(
                route = Route.LotDetail.route,
                arguments = listOf(navArgument("lotId") { type = NavType.StringType })
            ) {
                val lotDetailViewModel: LotDetailViewModel = hiltViewModel()
                LotDetailScreen(
                    viewModel = lotDetailViewModel,
                    onNavigateBack = { navController.popBackStack() },
                    onNavigateToSlotSelection = { lotId ->
                        navController.navigate(Route.SlotSelection.createRoute(lotId))
                    }
                )
            }

            composable(
                route = Route.SlotSelection.route,
                arguments = listOf(navArgument("lotId") { type = NavType.StringType })
            ) {
                val resViewModel: ReservationViewModel = hiltViewModel()
                SlotSelectionScreen(
                    viewModel = resViewModel,
                    onNavigateBack = { navController.popBackStack() },
                    onNavigateToConfirm = { lotId, slotId ->
                        navController.navigate(Route.ReservationConfirm.createRoute(lotId, slotId))
                    }
                )
            }

            composable(
                route = Route.ReservationConfirm.route,
                arguments = listOf(
                    navArgument("lotId") { type = NavType.StringType },
                    navArgument("slotId") { type = NavType.StringType }
                )
            ) {
                val resViewModel: ReservationViewModel = hiltViewModel()
                ReservationConfirmScreen(
                    viewModel = resViewModel,
                    onNavigateBack = { navController.popBackStack() },
                    onNavigateToActiveReservation = { resId ->
                        navController.navigate(Route.ActiveReservation.createRoute(resId)) {
                            popUpTo(Route.Explore.route)
                        }
                    },
                    onNavigateToWallet = { navController.navigate(Route.Wallet.route) },
                    onNavigateToAddVehicle = { navController.navigate(Route.AddVehicle.route) }
                )
            }

            composable(
                route = Route.ActiveReservation.route,
                arguments = listOf(navArgument("reservationId") { type = NavType.StringType })
            ) {
                val resViewModel: ReservationViewModel = hiltViewModel()
                ActiveReservationScreen(
                    viewModel = resViewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(
                route = Route.ActiveSession.route,
                arguments = listOf(navArgument("sessionId") { type = NavType.StringType })
            ) {
                val sessionViewModel: SessionViewModel = hiltViewModel()
                SessionScreen(
                    viewModel = sessionViewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            // Invoices & Statistics
            composable(
                route = Route.InvoiceDetail.route,
                arguments = listOf(navArgument("sessionId") { type = NavType.StringType })
            ) {
                val historyViewModel: HistoryViewModel = hiltViewModel()
                InvoiceDetailScreen(
                    viewModel = historyViewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(Route.Statistics.route) {
                val historyViewModel: HistoryViewModel = hiltViewModel()
                StatisticsScreen(
                    viewModel = historyViewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            // Cards & Vehicles
            composable(Route.CardManagement.route) {
                val walletViewModel: WalletViewModel = hiltViewModel()
                CardManagementScreen(
                    viewModel = walletViewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(Route.VehicleList.route) {
                val vehicleViewModel: VehicleViewModel = hiltViewModel()
                VehicleListScreen(
                    viewModel = vehicleViewModel,
                    onNavigateBack = { navController.popBackStack() },
                    onNavigateToAddVehicle = { navController.navigate(Route.AddVehicle.route) }
                )
            }

            composable(Route.AddVehicle.route) {
                val vehicleViewModel: VehicleViewModel = hiltViewModel()
                AddVehicleScreen(
                    viewModel = vehicleViewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            // Inbox & Settings
            composable(Route.NotificationInbox.route) {
                val inboxViewModel: InboxViewModel = hiltViewModel()
                InboxScreen(
                    viewModel = inboxViewModel,
                    onNavigateBack = { navController.popBackStack() },
                    onNavigateToItem = { type, refId ->
                        when {
                            type.startsWith("VEHICLE") && refId != null -> {
                                navController.navigate(Route.ActiveSession.createRoute(refId))
                            }
                            type.startsWith("RESERVATION") && refId != null -> {
                                navController.navigate(Route.ActiveReservation.createRoute(refId))
                            }
                            type.startsWith("WALLET") -> {
                                navController.navigate(Route.Wallet.route)
                            }
                        }
                    }
                )
            }

            composable(Route.ChangePassword.route) {
                val settingsViewModel: SettingsViewModel = hiltViewModel()
                ChangePasswordScreen(
                    viewModel = settingsViewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }
        }
    }
}

