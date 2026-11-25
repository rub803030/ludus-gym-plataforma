package com.ludus.gym.di

import android.content.Context
import androidx.room.Room
import androidx.work.WorkManager
import com.ludus.gym.BuildConfig
import com.ludus.gym.data.local.AppDatabase
import com.ludus.gym.data.local.MIGRATION_2_3
import com.ludus.gym.data.local.SecureTokenStore
import com.ludus.gym.data.local.SyncWorker
import com.ludus.gym.data.remote.ApiService
import com.ludus.gym.data.remote.AuthInterceptor
import com.ludus.gym.data.remote.NetworkMonitor
import com.ludus.gym.data.remote.RefreshApiService
import com.ludus.gym.data.remote.TokenAuthenticator
import com.ludus.gym.data.repository.AuthRepository
import com.ludus.gym.data.repository.BookingRepository
import com.ludus.gym.data.repository.DefaultGymRepository
import com.ludus.gym.data.repository.GymRepository
import com.ludus.gym.data.repository.MemberRepository
import com.ludus.gym.data.repository.NutritionRepository
import com.ludus.gym.data.repository.PaymentRepository
import com.ludus.gym.data.repository.QrRepository
import com.ludus.gym.data.repository.RegistrationRepository
import com.ludus.gym.data.repository.WorkoutRepository
import com.ludus.gym.domain.usecase.BookClassUseCase
import com.ludus.gym.domain.usecase.CancelBookingUseCase
import com.ludus.gym.domain.usecase.GetCachedProfileUseCase
import com.ludus.gym.domain.usecase.GetOccupancyUseCase
import com.ludus.gym.domain.usecase.GetProfileUseCase
import com.ludus.gym.domain.usecase.GetQrUseCase
import com.ludus.gym.domain.usecase.GetTodayRoutineUseCase
import com.ludus.gym.domain.usecase.JoinGymUseCase
import com.ludus.gym.domain.usecase.LogWorkoutUseCase
import com.ludus.gym.domain.usecase.ObserveActiveGymUseCase
import com.ludus.gym.domain.usecase.ObserveGymsUseCase
import com.ludus.gym.domain.usecase.LoginUseCase
import com.ludus.gym.domain.usecase.LogoutUseCase
import com.ludus.gym.domain.usecase.ObserveClassesUseCase
import com.ludus.gym.domain.usecase.ObserveNutritionUseCase
import com.ludus.gym.domain.usecase.ObservePendingWorkoutsUseCase
import com.ludus.gym.domain.usecase.ObserveProfileUseCase
import com.ludus.gym.domain.usecase.ObserveQrUseCase
import com.ludus.gym.domain.usecase.ObserveReceiptsUseCase
import com.ludus.gym.domain.usecase.ObserveRoutinesUseCase
import com.ludus.gym.domain.usecase.RecordAccessUseCase
import com.ludus.gym.domain.usecase.RefreshClassesUseCase
import com.ludus.gym.domain.usecase.RefreshMyGymsUseCase
import com.ludus.gym.domain.usecase.RefreshNutritionUseCase
import com.ludus.gym.domain.usecase.RefreshReceiptsUseCase
import com.ludus.gym.domain.usecase.RefreshRoutinesUseCase
import com.ludus.gym.domain.usecase.RegisterMemberUseCase
import com.ludus.gym.domain.usecase.ResendVerificationUseCase
import com.ludus.gym.domain.usecase.SwitchGymUseCase
import com.ludus.gym.domain.usecase.VerifyEmailUseCase
import com.ludus.gym.domain.usecase.VerifyQrLocallyUseCase
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import retrofit2.converter.moshi.MoshiConverterFactory
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import java.util.concurrent.TimeUnit

/** Localizador de servicios manual: sin Hilt, fácil de inspeccionar y probar. */
class AppContainer(context: Context) {
    private val appContext = context.applicationContext

    companion object {
        const val WEB_APP_URL = "https://ludus-gym-plataforma.vercel.app"
    }

    private val baseUrl: String = BuildConfig.API_BASE_URL

    val tokens = SecureTokenStore(appContext)
    val network = NetworkMonitor(appContext)

    private val moshi = Moshi.Builder()
        .add(KotlinJsonAdapterFactory())
        .build()

    private val database = Room.databaseBuilder(appContext, AppDatabase::class.java, "ludus-gym.db")
        .addMigrations(MIGRATION_2_3)
        .fallbackToDestructiveMigration()
        .build()

    val dao = database.dao()

    private val refreshApi: RefreshApiService by lazy {
        Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(plainHttpClient())
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()
            .create(RefreshApiService::class.java)
    }

    private val authenticator = TokenAuthenticator(tokens, refreshApi)

    private val authorizedClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(10, TimeUnit.SECONDS)
            .writeTimeout(10, TimeUnit.SECONDS)
            .addInterceptor(AuthInterceptor(tokens))
            .authenticator(authenticator)
            .build()
    }

    private val api: ApiService by lazy {
        Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(authorizedClient)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()
            .create(ApiService::class.java)
    }

    private val memberRepository = MemberRepository(api, dao)
    val authRepository = AuthRepository(api, tokens, memberRepository, network, dao)
    val qrRepository = QrRepository(api, dao, tokens, network)
    private val registrationRepository = RegistrationRepository(api)
    val gymRepository: GymRepository = DefaultGymRepository(api, tokens, dao)
    val workoutRepository = WorkoutRepository(api, dao, moshi, appContext)
    private val nutritionRepository = NutritionRepository(api)
    private val bookingRepository = BookingRepository(api)
    private val paymentRepository = PaymentRepository(api)

    val loginUseCase = LoginUseCase(authRepository)
    val verifyEmailUseCase = VerifyEmailUseCase(authRepository)
    val resendVerificationUseCase = ResendVerificationUseCase(authRepository)
    val registerMemberUseCase = RegisterMemberUseCase(registrationRepository)
    val logoutUseCase = LogoutUseCase(authRepository)
    val observeActiveGymUseCase = ObserveActiveGymUseCase(gymRepository)
    val observeGymsUseCase = ObserveGymsUseCase(gymRepository)
    val joinGymUseCase = JoinGymUseCase(gymRepository)
    val refreshMyGymsUseCase = RefreshMyGymsUseCase(gymRepository)
    val switchGymUseCase = SwitchGymUseCase(gymRepository)
    val getProfileUseCase = GetProfileUseCase(authRepository)
    val observeProfileUseCase = ObserveProfileUseCase(memberRepository)
    val getCachedProfileUseCase = GetCachedProfileUseCase(memberRepository)
    val getOccupancyUseCase = GetOccupancyUseCase(memberRepository)

    val observeQrUseCase = ObserveQrUseCase(qrRepository)
    val getQrUseCase = GetQrUseCase(qrRepository)
    val verifyQrLocallyUseCase = VerifyQrLocallyUseCase(qrRepository)
    val recordAccessUseCase = RecordAccessUseCase(qrRepository)

    val observeRoutinesUseCase = ObserveRoutinesUseCase(workoutRepository)
    val getTodayRoutineUseCase = GetTodayRoutineUseCase(workoutRepository)
    val refreshRoutinesUseCase = RefreshRoutinesUseCase(workoutRepository)
    val observePendingWorkoutsUseCase = ObservePendingWorkoutsUseCase(workoutRepository)
    val logWorkoutUseCase = LogWorkoutUseCase(workoutRepository)

    val observeNutritionUseCase = ObserveNutritionUseCase(nutritionRepository)
    val refreshNutritionUseCase = RefreshNutritionUseCase(nutritionRepository)
    val observeClassesUseCase = ObserveClassesUseCase(bookingRepository)
    val refreshClassesUseCase = RefreshClassesUseCase(bookingRepository)
    val bookClassUseCase = BookClassUseCase(bookingRepository)
    val cancelBookingUseCase = CancelBookingUseCase(bookingRepository)
    val observeReceiptsUseCase = ObserveReceiptsUseCase(paymentRepository)
    val refreshReceiptsUseCase = RefreshReceiptsUseCase(paymentRepository)

    fun start() {
        SyncWorker.enqueue(appContext)
        WorkManager.getInstance(appContext).pruneWork()
    }

    private fun plainHttpClient(): OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()
}
