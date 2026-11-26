package com.ludus.gym

import com.ludus.gym.data.remote.ApiService
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

/** API en memoria para probar ViewModels sin red ni Android. */
open class FakeApiService : ApiService {
    var occupancy: OccupancyDto = OccupancyDto(current = 12, capacity = 20)
    var classes: List<ClassDto> = emptyList()
    var nutrition: List<NutritionPlanDto> = emptyList()
    var payments: List<PaymentDto> = emptyList()
    var routines: List<RoutineDto> = emptyList()
    var bookFails = false
    var cancelFails = false
    val bookedIds = mutableListOf<String>()
    val cancelledIds = mutableListOf<String>()

    var registration: RegisterMemberResponseDto? = null
    var gymRegistration: RegisterGymResponseDto? = null
    var joinResponse: JoinGymResponseDto? = null
    var switchResponse: SwitchGymResponseDto? = null
    var myGymsResponse: MyGymsDto? = null
    var qrTokenResponse: QrTokenDto? = null
    val joinCodes = mutableListOf<String>()
    val switchGymIds = mutableListOf<String>()
    val qrGymIds = mutableListOf<String?>()
    val registeredEmails = mutableListOf<String>()
    val registeredGyms = mutableListOf<RegisterGymRequestDto>()

    override suspend fun login(request: LoginRequestDto): LoginResponseDto = unsupported()
    override suspend fun verifyEmail(request: VerifyEmailRequestDto): VerifyEmailResponseDto = unsupported()
    override suspend fun resendVerification(request: ResendVerificationRequestDto): Map<String, Any?> = unsupported()
    override suspend fun me(): MeDto = unsupported()

    override suspend fun registerMember(request: RegisterMemberRequestDto): RegisterMemberResponseDto {
        registeredEmails += request.email
        return registration ?: unsupported()
    }

    open override suspend fun registerGym(request: RegisterGymRequestDto): RegisterGymResponseDto {
        registeredGyms += request
        return gymRegistration ?: unsupported()
    }

    override suspend fun joinGym(request: JoinGymRequestDto): JoinGymResponseDto {
        joinCodes += request.code
        return joinResponse ?: unsupported()
    }

    override suspend fun switchGym(request: SwitchGymRequestDto): SwitchGymResponseDto {
        switchGymIds += request.gymId
        return switchResponse ?: unsupported()
    }

    override suspend fun myGyms(): MyGymsDto = myGymsResponse ?: unsupported()

    override suspend fun qrToken(request: QrTokenRequestDto): QrTokenDto {
        qrGymIds += request.gymId
        return qrTokenResponse ?: unsupported()
    }

    override suspend fun recordAccessEvent(request: AccessEventRequestDto): Unit = unsupported()
    override suspend fun occupancy(): OccupancyDto = occupancy
    override suspend fun memberMe(): MemberDto = unsupported()
    override suspend fun members(): List<MemberDto> = unsupported()
    override suspend fun routines(): List<RoutineDto> = routines
    override suspend fun createWorkoutLog(request: WorkoutLogRequestDto): WorkoutLogResponseDto = unsupported()
    override suspend fun nutritionPlans(): List<NutritionPlanDto> = nutrition
    override suspend fun classes(): List<ClassDto> = classes

    override suspend fun bookClass(id: String): BookResponseDto {
        bookedIds += id
        if (bookFails) error("Sin conexión")
        return BookResponseDto(success = true, bookingId = "booking-$id", booked = true)
    }

    override suspend fun cancelBooking(id: String) {
        cancelledIds += id
        if (cancelFails) error("Sin conexión")
    }

    override suspend fun payments(): List<PaymentDto> = payments

    private fun unsupported(): Nothing = error("Método no usado en esta prueba")
}
