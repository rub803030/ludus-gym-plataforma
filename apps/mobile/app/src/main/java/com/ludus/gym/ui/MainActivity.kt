package com.ludus.gym.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.ludus.gym.ui.navigation.LudusNavHost
import com.ludus.gym.ui.theme.LudusTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val verificationToken = intent?.data?.getQueryParameter("token")
        setContent {
            LudusTheme {
                LudusNavHost(deepLinkToken = verificationToken)
            }
        }
    }
}
