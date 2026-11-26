package com.ludus.gym.ui.navigation

import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.ludus.gym.LudusApplication
import com.ludus.gym.ui.screens.auth.LoginScreen
import com.ludus.gym.ui.screens.auth.LoginViewModel
import com.ludus.gym.ui.screens.auth.RegisterScreen
import com.ludus.gym.ui.screens.auth.RegisterViewModel
import com.ludus.gym.ui.screens.auth.VerifyEmailScreen
import com.ludus.gym.ui.screens.bookings.BookingViewModel
import com.ludus.gym.ui.screens.bookings.BookingsScreen
import com.ludus.gym.ui.screens.gym.GymQrScannerScreen
import com.ludus.gym.ui.screens.gym.LinkGymScreen
import com.ludus.gym.ui.screens.gym.LinkGymViewModel
import com.ludus.gym.ui.screens.gym.MyGymsScreen
import com.ludus.gym.ui.screens.gym.MyGymsViewModel
import com.ludus.gym.ui.screens.gym.RegisterGymScreen
import com.ludus.gym.ui.screens.gym.RegisterGymViewModel
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
private const val VERIFY_ROUTE = "verificacion_correo?token={token}"

@Composable
fun LudusNavHost(deepLinkToken: String? = null) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val container = (context.applicationContext as LudusApplication).container
    val navController = rememberNavController()

    val loginViewModel: LoginViewModel = viewModel(
        factory = viewModelFactory {
            LoginViewModel(
                login = container.loginUseCase,
                verifyEmail = container.verifyEmailUseCase,
                resendVerification = container.resendVerificationUseCase,
            )
        },
    )
    val linkGymViewModel: LinkGymViewModel = viewModel(
        factory = viewModelFactory { LinkGymViewModel(container.joinGymUseCase) },
    )

    fun homeRoute(): String {
        val memberId = container.tokens.memberId()?.takeIf { it.isNotBlank() } ?: "member-demo"
        return "home/${Uri.encode(memberId)}?name="
    }

    fun goHome() {
        navController.navigate(homeRoute()) {
            popUpTo("vincular_gimnasio") { inclusive = true }
            launchSingleTop = true
        }
    }

    @Composable
    fun RequireGym(content: @Composable () -> Unit) {
        if (container.tokens.activeGymId().isNullOrBlank()) {
            LaunchedEffect(Unit) {
                navController.navigate("vincular_gimnasio") {
                    popUpTo(0) { inclusive = true }
                    launchSingleTop = true
                }
            }
        } else {
            content()
        }
    }

    val startDestination = when {
        !deepLinkToken.isNullOrBlank() ->
            "verificacion_correo?token=${Uri.encode(deepLinkToken)}"
        container.tokens.hasSession() && !container.tokens.memberId().isNullOrBlank() &&
            !container.tokens.activeGymId().isNullOrBlank() -> homeRoute()
        container.tokens.hasSession() -> "vincular_gimnasio"
        else -> "login"
    }

    NavHost(navController = navController, startDestination = startDestination) {
        composable("login") {
            LoginScreen(
                viewModel = loginViewModel,
                onLoggedIn = { member ->
                    val sinGimnasio = member.activeGymId.isNullOrBlank() &&
                        container.tokens.activeGymId().isNullOrBlank()
                    if (sinGimnasio) {
                        navController.navigate("vincular_gimnasio") {
                            popUpTo("login") { inclusive = true }
                        }
                    } else {
                        navController.navigate(homeRoute()) {
                            popUpTo("login") { inclusive = true }
                            launchSingleTop = true
                        }
                    }
                },
                onRegister = { navController.navigate("registro") },
                onRegisterGym = { navController.navigate("registrar_gimnasio") },
            )
        }

        composable("registro") {
            val factory = viewModelFactory {
                RegisterViewModel(registerMember = container.registerMemberUseCase)
            }
            val viewModel: RegisterViewModel = viewModel(factory = factory)
            RegisterScreen(
                viewModel = viewModel,
                onRegistered = { result ->
                    loginViewModel.prepareVerification(result.email, result.devToken, result.devLink)
                    navController.navigate("verificacion_correo") {
                        popUpTo("registro") { inclusive = true }
                    }
                },
                onBack = { navController.popBackStack() },
                onRegisterGym = { navController.navigate("registrar_gimnasio") },
            )
        }

        composable("registrar_gimnasio") {
            val factory = viewModelFactory {
                RegisterGymViewModel(registerGym = container.registerGymUseCase)
            }
            val viewModel: RegisterGymViewModel = viewModel(factory = factory)
            RegisterGymScreen(
                viewModel = viewModel,
                onBack = { navController.popBackStack() },
            )
        }

        composable(
            route = VERIFY_ROUTE,
            arguments = listOf(
                navArgument("token") {
                    type = NavType.StringType
                    nullable = true
                    defaultValue = null
                },
            ),
        ) { backStackEntry ->
            VerifyEmailScreen(
                viewModel = loginViewModel,
                token = backStackEntry.arguments?.getString("token"),
                onBack = { navController.popBackStack() },
                onVerified = {
                    navController.navigate("login") {
                        popUpTo(VERIFY_ROUTE) { inclusive = true }
                    }
                },
            )
        }

        composable("vincular_gimnasio") {
            LinkGymScreen(
                viewModel = linkGymViewModel,
                onBack = { navController.popBackStack() },
                onScan = { navController.navigate("escanear_qr_gimnasio") },
                onMyGyms = { navController.navigate("mis_gimnasios") },
                onHome = { goHome() },
            )
        }

        composable("escanear_qr_gimnasio") {
            GymQrScannerScreen(
                onDetected = { raw ->
                    linkGymViewModel.onScanned(raw) { goHome() }
                },
                onRetry = { raw ->
                    linkGymViewModel.onScanned(raw) { goHome() }
                },
                errorMessage = linkGymViewModel.errorMessage,
                isLoading = linkGymViewModel.isLoading,
                onBack = { navController.popBackStack() },
            )
        }

        composable("mis_gimnasios") {
            val factory = viewModelFactory {
                MyGymsViewModel(
                    observeGyms = container.observeGymsUseCase,
                    observeActiveGym = container.observeActiveGymUseCase,
                    refreshMyGyms = container.refreshMyGymsUseCase,
                    switchGym = container.switchGymUseCase,
                )
            }
            val viewModel: MyGymsViewModel = viewModel(factory = factory)
            MyGymsScreen(
                viewModel = viewModel,
                onBack = { navController.popBackStack() },
                onLinkGym = { navController.navigate("vincular_gimnasio") },
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
                    observeActiveGym = container.observeActiveGymUseCase,
                    observeGyms = container.observeGymsUseCase,
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
                onLinkGym = { navController.navigate("vincular_gimnasio") },
                onMyGyms = { navController.navigate("mis_gimnasios") },
                onExit = { navController.navigate("login") { popUpTo(HOME_ROUTE) { inclusive = true } } },
            )
        }

        composable("qr") {
            RequireGym {
                val factory = viewModelFactory {
                    QrViewModel(
                        observeQr = container.observeQrUseCase,
                        observeActiveGym = container.observeActiveGymUseCase,
                        observeGyms = container.observeGymsUseCase,
                        getQr = container.getQrUseCase,
                        recordAccess = container.recordAccessUseCase,
                        readableError = container.qrRepository::readableError,
                    )
                }
                val viewModel: QrViewModel = viewModel(factory = factory)
                QrScreen(
                    viewModel = viewModel,
                    onBack = { navController.popBackStack() },
                    onMyGyms = { navController.navigate("mis_gimnasios") },
                )
            }
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
            RequireGym {
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
}
