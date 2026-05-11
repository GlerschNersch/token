package com.homearcade.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.homearcade.app.ui.HomeArcadeApp
import com.homearcade.app.ui.theme.HomeArcadeTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            HomeArcadeTheme {
                HomeArcadeApp()
            }
        }
    }
}
