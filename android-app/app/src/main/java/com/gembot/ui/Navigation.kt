package com.gembot.ui

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.gembot.ui.screens.HomeScreen
import com.gembot.ui.screens.EditScreen

@Composable
fun GeMBotNavHost(
    navController: NavHostController = rememberNavController()
) {
    NavHost(navController = navController, startDestination = "home") {
        composable("home") {
            HomeScreen(
                onNavigateToEdit = { bidId ->
                    navController.navigate("edit/$bidId")
                }
            )
        }
        composable("edit/{bidId}") { backStackEntry ->
            val bidId = backStackEntry.arguments?.getString("bidId") ?: ""
            EditScreen(bidId)
        }
    }
}
