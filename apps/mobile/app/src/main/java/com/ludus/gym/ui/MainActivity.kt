package com.ludus.gym.ui

import android.graphics.Color
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.ui.Modifier
import com.ludus.gym.ui.navigation.LudusNavHost
import com.ludus.gym.ui.theme.LudusTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // La app siempre usa el tema oscuro: los iconos del sistema deben ser claros
        // y el contenido debe respetar los insets de las barras (targetSdk 35).
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
        )
        val verificationToken = intent?.data?.getQueryParameter("token")
        setContent {
            LudusTheme {
                Box(modifier = Modifier.systemBarsPadding()) {
                    LudusNavHost(deepLinkToken = verificationToken)
                }
            }
        }
    }
}
