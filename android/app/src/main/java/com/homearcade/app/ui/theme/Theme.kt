package com.homearcade.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// HomeArcade colour palette — mirrors the Nexus teal accent used in the web UI
private val tealPrimary     = Color(0xFF01696F)
private val tealOnPrimary   = Color(0xFFFFFFFF)
private val tealContainer   = Color(0xFFCEDCD8)
private val bgLight         = Color(0xFFF7F6F2)
private val surfaceLight    = Color(0xFFF9F8F5)
private val bgDark          = Color(0xFF171614)
private val surfaceDark     = Color(0xFF1C1B19)
private val tealDark        = Color(0xFF4F98A3)

private val LightColors = lightColorScheme(
    primary          = tealPrimary,
    onPrimary        = tealOnPrimary,
    primaryContainer = tealContainer,
    background       = bgLight,
    surface          = surfaceLight,
    onBackground     = Color(0xFF28251D),
    onSurface        = Color(0xFF28251D),
)

private val DarkColors = darkColorScheme(
    primary          = tealDark,
    onPrimary        = Color(0xFF003737),
    primaryContainer = Color(0xFF313B3B),
    background       = bgDark,
    surface          = surfaceDark,
    onBackground     = Color(0xFFCDCCCA),
    onSurface        = Color(0xFFCDCCCA),
)

@Composable
fun HomeArcadeTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        content = content
    )
}
