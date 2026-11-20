package com.ludus.gym.domain.usecase

import com.ludus.gym.data.repository.AuthRepository
import com.ludus.gym.domain.model.Member

class LoginUseCase(private val auth: AuthRepository) {
    suspend operator fun invoke(email: String, password: String): Result<Member> {
        if (!email.contains("@") || email.length < 5) {
            return Result.failure(IllegalArgumentException("Introduce un correo electrónico válido"))
        }
        if (password.length < 4) {
            return Result.failure(IllegalArgumentException("La contraseña es demasiado corta"))
        }
        return auth.login(email, password)
    }
}

class VerifyEmailUseCase(private val auth: AuthRepository) {
    suspend operator fun invoke(token: String): Result<String> = auth.verifyEmail(token)
}

class ResendVerificationUseCase(private val auth: AuthRepository) {
    suspend operator fun invoke(email: String): Result<Unit> = auth.resendVerification(email)
}

class LogoutUseCase(private val auth: AuthRepository) {
    suspend operator fun invoke() = auth.logout()
}

class GetProfileUseCase(private val auth: AuthRepository) {
    suspend operator fun invoke() = auth.refreshProfile()
}
