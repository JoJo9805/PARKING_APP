package com.iotparking.app.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.navigation.NavController
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.currentBackStackEntryAsState
import com.iotparking.app.R

sealed class BottomNavItem(
    val route: String,
    val titleRes: Int,
    val icon: ImageVector
) {
    data object Explore : BottomNavItem(Route.Explore.route, R.string.tab_explore, Icons.Default.Explore)
    data object Activity : BottomNavItem(Route.Activity.route, R.string.tab_activity, Icons.Default.DirectionsCar)
    data object History : BottomNavItem(Route.History.route, R.string.tab_history, Icons.Default.History)
    data object Wallet : BottomNavItem(Route.Wallet.route, R.string.tab_wallet, Icons.Default.AccountBalanceWallet)
    data object Account : BottomNavItem(Route.Account.route, R.string.tab_account, Icons.Default.Person)
}

@Composable
fun BottomNavBar(navController: NavController) {
    val items = listOf(
        BottomNavItem.Explore,
        BottomNavItem.Activity,
        BottomNavItem.History,
        BottomNavItem.Wallet,
        BottomNavItem.Account
    )

    val navBackStackEntry = navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry.value?.destination?.route

    // Chỉ hiển thị bottom bar khi đang ở 1 trong 5 tab chính
    val isBottomBarVisible = items.any { it.route == currentRoute }

    if (isBottomBarVisible) {
        NavigationBar(
            containerColor = MaterialTheme.colorScheme.surface,
            contentColor = MaterialTheme.colorScheme.primary
        ) {
            items.forEach { item ->
                val selected = currentRoute == item.route
                NavigationBarItem(
                    icon = { Icon(imageVector = item.icon, contentDescription = stringResource(item.titleRes)) },
                    label = { Text(text = stringResource(item.titleRes)) },
                    selected = selected,
                    onClick = {
                        if (currentRoute != item.route) {
                            navController.navigate(item.route) {
                                popUpTo(navController.graph.findStartDestination().id) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        }
                    },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = MaterialTheme.colorScheme.primary,
                        selectedTextColor = MaterialTheme.colorScheme.primary,
                        indicatorColor = MaterialTheme.colorScheme.primaryContainer
                    )
                )
            }
        }
    }
}

