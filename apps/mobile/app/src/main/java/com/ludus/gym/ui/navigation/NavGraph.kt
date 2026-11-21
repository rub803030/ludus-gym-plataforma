package com.ludus.gym.ui.navigation

import android.net.Uri
import androidx.compose.runtime.Composable
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
import com.ludus.gym.ui.screens.bookings.BookingViewModel
import com.ludus.gym.ui.screens.bookings.BookingsScreen
import com.ludus.gym.ui.screens.home.HomeScreen
import com.ludus.gym.ui.screens.home.HomeViewModel
import com.ludus.gym.ui.screens.nutrition.NutritionScreen
import com.ludus.gym.ui.screens.nutrition.NutritionViewModel
import com.ludus.gym.ui.screens.qr.QrScreen
import com.ludus.gym.ui.screens.qr.QrViewModel
import com.ludus.gym.ui.screens.workout.WorkoutScreen
import com.ludus.gym.ui.screens.workout.WorkoutViewModel
import com.ludus.gym.ui.viewModelFactory

private const val HOME_ROUTE = "home/{memberId}?name={name}"

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
                    navController.navigate("home/${Uri.encode(member.id)}?name=${Uri.encode(member.name)}") {
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
            route = HOME_ROUTE,
            arguments = listOf(
                navArgument("memberId") { type = NavType.StringType },
                navArgument("name") {
                    type = NavType.StringType
                    defaultValue = ""
                },
            ),
        ) { backStackEntry ->
            val factory = viewModelFactory {
                HomeViewModel(
                    observeProfile = container.observeProfileUseCase,
                    getCachedProfile = container.getCachedProfileUseCase,
                    getProfile = container.getProfileUseCase,
                    getOccupancy = container.getOccupancyUseCase,
                    logout = container.logoutUseCase,
                    memberId = backStackEntry.arguments?.getString("memberId"),
                )
            }
            val viewModel: HomeViewModel = viewModel(factory = factory)
            HomeScreen(
                viewModel = viewModel,
                fallbackName = backStackEntry.arguments?.getString("name").orEmpty(),
                onQr = { navController.navigate("qr") },
                onWorkout = { navController.navigate("workout") },
                onNutrition = { navController.navigate("nutrition") },
                onBookings = { navController.navigate("bookings") },
                onExit = { navController.navigate("login") { popUpTo(HOME_ROUTE) { inclusive = true } } },
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

        composable("workout") {
            val factory = viewModelFactory {
                WorkoutViewModel(
                    observeRoutines = container.observeRoutinesUseCase,
                    observePending = container.observePendingWorkoutsUseCase,
                    refreshRoutines = container.refreshRoutinesUseCase,
                    logWorkout = container.logWorkoutUseCase,
                )
            }
            val viewModel: WorkoutViewModel = viewModel(factory = factory)
            WorkoutScreen(viewModel = viewModel, onBack = { navController.popBackStack() })
        }

        composable("nutrition") {
            val factory = viewModelFactory {
                NutritionViewModel(
                    observeNutrition = container.observeNutritionUseCase,
                    refreshNutrition = container.refreshNutritionUseCase,
                )
            }
            val viewModel: NutritionViewModel = viewModel(factory = factory)
            NutritionScreen(viewModel = viewModel, onBack = { navController.popBackStack() })
        }

        composable("bookings") {
            val factory = viewModelFactory {
                BookingViewModel(
                    observeClasses = container.observeClassesUseCase,
                    observeReceipts = container.observeReceiptsUseCase,
                    refreshClasses = container.refreshClassesUseCase,
                    refreshReceipts = container.refreshReceiptsUseCase,
                    bookClass = container.bookClassUseCase,
                    cancelBooking = container.cancelBookingUseCase,
                )
            }
            val viewModel: BookingViewModel = viewModel(factory = factory)
            BookingsScreen(viewModel = viewModel, onBack = { navController.popBackStack() })
        }
    }
}
