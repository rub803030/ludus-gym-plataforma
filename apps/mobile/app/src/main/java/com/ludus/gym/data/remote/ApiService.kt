package com.ludus.gym.data.remote

import com.ludus.gym.data.remote.dto.AccessEventRequestDto
import com.ludus.gym.data.remote.dto.BookResponseDto
import com.ludus.gym.data.remote.dto.ClassDto
import com.ludus.gym.data.remote.dto.LoginRequestDto
import com.ludus.gym.data.remote.dto.LoginResponseDto
import com.ludus.gym.data.remote.dto.MeDto
import com.ludus.gym.data.remote.dto.MemberDto
import com.ludus.gym.data.remote.dto.NutritionPlanDto
import com.ludus.gym.data.remote.dto.OccupancyDto
import com.ludus.gym.data.remote.dto.PaymentDto
import com.ludus.gym.data.remote.dto.QrTokenDto
import com.ludus.gym.data.remote.dto.RefreshRequestDto
import com.ludus.gym.data.remote.dto.RefreshResponseDto
import com.ludus.gym.data.remote.dto.RoutineDto
import com.ludus.gym.data.remote.dto.WorkoutLogRequestDto
import com.ludus.gym.data.remote.dto.WorkoutLogResponseDto
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface ApiService {
    @POST("api/auth/mobile/login")
    suspend fun login(@Body request: LoginRequestDto): LoginResponseDto

    @GET("api/auth/me")
    suspend fun me(): MeDto

    @POST("api/access/qr-token")
    suspend fun qrToken(): QrTokenDto

    @POST("api/access/events")
    suspend fun recordAccessEvent(@Body request: AccessEventRequestDto)

    @GET("api/access/occupancy")
    suspend fun occupancy(): OccupancyDto

    @GET("api/members/me")
    suspend fun memberMe(): MemberDto

    @GET("api/members")
    suspend fun members(): List<MemberDto>

    @GET("api/routines")
    suspend fun routines(): List<RoutineDto>

    @POST("api/workout-logs")
    suspend fun createWorkoutLog(@Body request: WorkoutLogRequestDto): WorkoutLogResponseDto

    @GET("api/nutrition-plans")
    suspend fun nutritionPlans(): List<NutritionPlanDto>

    @GET("api/classes")
    suspend fun classes(): List<ClassDto>

    @POST("api/classes/{id}/book")
    suspend fun bookClass(@Path("id") id: String): BookResponseDto

    @DELETE("api/classes/{id}/book")
    suspend fun cancelBooking(@Path("id") id: String)

    @GET("api/payments")
    suspend fun payments(): List<PaymentDto>
}

/** Cliente sin interceptor de autorización: evita ciclos al refrescar el token. */
interface RefreshApiService {
    @POST("api/auth/refresh")
    suspend fun refresh(@Body request: RefreshRequestDto): RefreshResponseDto

    @POST("api/auth/mobile/refresh")
    suspend fun refreshMobile(@Body request: RefreshRequestDto): RefreshResponseDto
}
