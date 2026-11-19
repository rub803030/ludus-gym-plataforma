package com.ludus.gym.ui.screens.auth

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ludus.gym.data.demo.DemoCatalog
import com.ludus.gym.domain.model.Member
import com.ludus.gym.domain.usecase.LoginUseCase
import kotlinx.coroutines.launch
import java.io.IOException

class LoginViewModel(
    private val login: LoginUseCase,
) : ViewModel() {

    var email by mutableStateOf(DemoCatalog.DEMO_EMAIL)
        private set
    var password by mutableStateOf(DemoCatalog.DEMO_PASSWORD)
        private set
    var passwordVisible by mutableStateOf(false)
        private set
    var isLoading by mutableStateOf(false)
        private set
    var errorMessage by mutableStateOf<String?>(null)
        private set

    fun onEmailChange(value: String) {
        email = value
        errorMessage = null
    }

    fun onPasswordChange(value: String) {
        password = value
        errorMessage = null
    }

    fun togglePasswordVisibility() {
        passwordVisible = !passwordVisible
    }

    fun submit(onSuccess: (Member) -> Unit) {
        if (isLoading) return
        viewModelScope.launch {
            isLoading = true
            errorMessage = null
            login(email, password).fold(
                onSuccess = onSuccess,
                onFailure = { errorMessage = it.readableMessage() },
            )
            isLoading = false
        }
    }

    private fun Throwable.readableMessage(): String = when (this) {
        is IOException -> "Sin conexión. Revisa tu red o usa la credencial de demostración."
        is IllegalArgumentException -> message ?: "Revisa los datos introducidos."
        else -> "No pudimos iniciar sesión. Revisa tus datos e inténtalo de nuevo."
    }
}
