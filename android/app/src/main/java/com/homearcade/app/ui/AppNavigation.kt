package com.homearcade.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.homearcade.app.ui.screens.LibraryScreen
import com.homearcade.app.ui.screens.SettingsScreen
import com.homearcade.app.ui.screens.UploadScreen

sealed class Screen(val route: String) {
    object Library  : Screen("library")
    object Upload   : Screen("upload")
    object Settings : Screen("settings")
}

@Composable
fun AppNavHost(
    navController: NavHostController,
    modifier: Modifier = Modifier
) {
    NavHost(
        navController = navController,
        startDestination = Screen.Library.route,
        modifier = modifier
    ) {
        composable(Screen.Library.route)  { LibraryScreen(navController) }
        composable(Screen.Upload.route)   { UploadScreen(navController) }
        composable(Screen.Settings.route) { SettingsScreen(navController) }
    }
}
