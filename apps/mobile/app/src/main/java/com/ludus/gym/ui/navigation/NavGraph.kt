package com.ludus.gym.ui.navigation

import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.ludus.gym.LudusApplication
import com.ludus.gym.ui.screens.auth.LoginScreen
import com.ludus.gym.ui.screens.auth.LoginViewModel
import com.ludus.gym.ui.screens.auth.VerifyEmailScreen
import com.ludus.gym.ui.screens.qr.QrScreen
import com.ludus.gym.ui.screens.qr.QrViewModel
import com.ludus.gym.ui.viewModelFactory

@Composable
fun LudusNavHost(deepLinkToken: String? = null) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val container = (context.applicationContext as LudusApplication).container
    val navController = rememberNavController()
    val startDestination = if (deepLinkToken.isNullOrBlank()) {
        "login"
    } else {
        "verify_email?token=${Uri.encode(deepLinkToken)}"
    }

    NavHost(navController = navController, startDestination = startDestination) {
        composable("login") {
            val factory = viewModelFactory {
                LoginViewModel(
                    login = container.loginUseCase,
                    verifyEmail = container.verifyEmailUseCase,
                    resendVerification = container.resendVerificationUseCase,
                )
            }
            val viewModel: LoginViewModel = viewModel(factory = factory)
            LoginScreen(
                viewModel = viewModel,
                onLoggedIn = { member ->
                    navController.navigate("home/${Uri.encode(member.name)}") {
                        popUpTo("login") { inclusive = true }
                    }
                },
            )
        }

        composable(
            route = "verify_email?token={token}",
            arguments = listOf(
                navArgument("token") {
                    type = NavType.StringType
                    nullable = true
                    defaultValue = null
                },
            ),
        ) { backStackEntry ->
            val factory = viewModelFactory {
                LoginViewModel(
                    login = container.loginUseCase,
                    verifyEmail = container.verifyEmailUseCase,
                    resendVerification = container.resendVerificationUseCase,
                )
            }
            val viewModel: LoginViewModel = viewModel(factory = factory)
            VerifyEmailScreen(
                viewModel = viewModel,
                token = backStackEntry.arguments?.getString("token"),
                onBack = { navController.navigate("login") { popUpTo("verify_email?token={token}") { inclusive = true } } },
            )
        }

        composable(
            route = "home/{name}",
            arguments = listOf(navArgument("name") { type = NavType.StringType }),
        ) { backStackEntry ->
            val name = backStackEntry.arguments?.getString("name").orEmpty()
            HomeScreen(
                name = name,
                onQr = { navController.navigate("qr") },
                onExit = { navController.navigate("login") { popUpTo("home/{name}") { inclusive = true } } },
            )
        }

        composable("qr") {
            val factory = viewModelFactory {
                QrViewModel(
                    observeQr = container.observeQrUseCase,
                    getQr = container.getQrUseCase,
                    recordAccess = container.recordAccessUseCase,
                )
            }
            val viewModel: QrViewModel = viewModel(factory = factory)
            QrScreen(viewModel = viewModel, onBack = { navController.popBackStack() })
        }
    }
}

@Composable
private fun HomeScreen(name: String, onQr: () -> Unit, onExit: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("Ludus.", style = MaterialTheme.typography.displaySmall, color = MaterialTheme.colorScheme.primary)
        Text("Sesión iniciada", style = MaterialTheme.typography.headlineSmall, modifier = Modifier.padding(top = 16.dp))
        Text("Bienvenido, $name", style = MaterialTheme.typography.bodyLarge, modifier = Modifier.padding(top = 8.dp))
        Button(onClick = onQr, modifier = Modifier.padding(top = 24.dp)) { Text("Mi pase QR") }
        Button(onClick = onExit, modifier = Modifier.padding(top = 12.dp)) { Text("Cerrar sesión") }
    }
}
