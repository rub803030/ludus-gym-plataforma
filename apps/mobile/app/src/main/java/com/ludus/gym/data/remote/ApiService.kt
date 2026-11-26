package com.ludus.gym.data.remote

import com.ludus.gym.data.remote.dto.AccessEventRequestDto
import com.ludus.gym.data.remote.dto.BookResponseDto
import com.ludus.gym.data.remote.dto.ClassDto
import com.ludus.gym.data.remote.dto.JoinGymRequestDto
import com.ludus.gym.data.remote.dto.JoinGymResponseDto
import com.ludus.gym.data.remote.dto.LoginRequestDto
import com.ludus.gym.data.remote.dto.LoginResponseDto
import com.ludus.gym.data.remote.dto.MeDto
import com.ludus.gym.data.remote.dto.MemberDto
import com.ludus.gym.data.remote.dto.MyGymsDto
import com.ludus.gym.data.remote.dto.NutritionPlanDto
import com.ludus.gym.data.remote.dto.OccupancyDto
import com.ludus.gym.data.remote.dto.PaymentDto
import com.ludus.gym.data.remote.dto.QrTokenDto
import com.ludus.gym.data.remote.dto.QrTokenRequestDto
import com.ludus.gym.data.remote.dto.RefreshRequestDto
import com.ludus.gym.data.remote.dto.RefreshResponseDto
import com.ludus.gym.data.remote.dto.RegisterGymRequestDto
import com.ludus.gym.data.remote.dto.RegisterGymResponseDto
import com.ludus.gym.data.remote.dto.RegisterMemberRequestDto
import com.ludus.gym.data.remote.dto.RegisterMemberResponseDto
import com.ludus.gym.data.remote.dto.ResendVerificationRequestDto
import com.ludus.gym.data.remote.dto.RoutineDto
import com.ludus.gym.data.remote.dto.SwitchGymRequestDto
import com.ludus.gym.data.remote.dto.SwitchGymResponseDto
import com.ludus.gym.data.remote.dto.VerifyEmailRequestDto
import com.ludus.gym.data.remote.dto.VerifyEmailResponseDto
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

    @POST("api/auth/verify-email")
    suspend fun verifyEmail(@Body request: VerifyEmailRequestDto): VerifyEmailResponseDto

    @POST("api/auth/verify-email/resend")
    suspend fun resendVerification(@Body request: ResendVerificationRequestDto): Map<String, Any?>

    @GET("api/auth/me")
    suspend fun me(): MeDto

    @POST("api/members/register")
    suspend fun registerMember(@Body request: RegisterMemberRequestDto): RegisterMemberResponseDto

    @POST("api/gyms/register")
    suspend fun registerGym(@Body request: RegisterGymRequestDto): RegisterGymResponseDto

    @POST("api/members/join-gym")
    suspend fun joinGym(@Body request: JoinGymRequestDto): JoinGymResponseDto

    @POST("api/members/switch-gym")
    suspend fun switchGym(@Body request: SwitchGymRequestDto): SwitchGymResponseDto

    @GET("api/members/my-gyms")
    suspend fun myGyms(): MyGymsDto

    @POST("api/access/qr-token")
    suspend fun qrToken(@Body request: QrTokenRequestDto): QrTokenDto

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
