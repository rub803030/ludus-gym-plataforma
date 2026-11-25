package com.ludus.gym.ui.screens.auth

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ludus.gym.data.remote.ApiErrorMessages
import com.ludus.gym.domain.model.RegisterMemberInput
import com.ludus.gym.domain.model.RegistrationResult
import com.ludus.gym.domain.usecase.RegisterMemberUseCase
import kotlinx.coroutines.launch

class RegisterViewModel(
    private val registerMember: RegisterMemberUseCase,
) : ViewModel() {

    var firstName by mutableStateOf("")
        private set
    var lastName by mutableStateOf("")
        private set
    var email by mutableStateOf("")
        private set
    var password by mutableStateOf("")
        private set
    var passwordVisible by mutableStateOf(false)
        private set
    var phone by mutableStateOf("")
        private set
    var documentNumber by mutableStateOf("")
        private set
    var birthDate by mutableStateOf("")
        private set
    var isLoading by mutableStateOf(false)
        private set
    var errorMessage by mutableStateOf<String?>(null)
        private set

    fun onFirstNameChange(value: String) {
        firstName = value
        errorMessage = null
    }

    fun onLastNameChange(value: String) {
        lastName = value
        errorMessage = null
    }

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

    fun onPhoneChange(value: String) {
        phone = value
        errorMessage = null
    }

    fun onDocumentNumberChange(value: String) {
        documentNumber = value
        errorMessage = null
    }

    fun onBirthDateChange(value: String) {
        birthDate = value
        errorMessage = null
    }

    fun submit(onRegistered: (RegistrationResult) -> Unit) {
        if (isLoading) return
        validate()?.let {
            errorMessage = it
            return
        }
        viewModelScope.launch {
            isLoading = true
            errorMessage = null
            registerMember(
                RegisterMemberInput(
                    firstName = firstName,
                    lastName = lastName,
                    email = email,
                    password = password,
                    phone = phone,
                    documentNumber = documentNumber,
                    birthDate = birthDate,
                ),
            ).fold(
                onSuccess = onRegistered,
                onFailure = { errorMessage = ApiErrorMessages.readable(it) },
            )
            isLoading = false
        }
    }

    private fun validate(): String? = when {
        firstName.trim().length < 2 -> "Escribe tu nombre (al menos 2 caracteres)."
        lastName.trim().length < 2 -> "Escribe tus apellidos (al menos 2 caracteres)."
        !EMAIL_REGEX.matches(email.trim()) -> "Introduce un correo electrónico válido."
        password.length !in 12..128 -> "La contraseña debe tener entre 12 y 128 caracteres."
        phone.isNotBlank() && phone.trim().length !in 8..24 ->
            "El teléfono debe tener entre 8 y 24 caracteres."
        documentNumber.isNotBlank() && documentNumber.trim().length !in 5..32 ->
            "El documento debe tener entre 5 y 32 caracteres."
        birthDate.isNotBlank() && !DATE_REGEX.matches(birthDate.trim()) ->
            "La fecha de nacimiento debe tener el formato AAAA-MM-DD."
        else -> null
    }

    private companion object {
        val EMAIL_REGEX = Regex("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$")
        val DATE_REGEX = Regex("^\\d{4}-\\d{2}-\\d{2}$")
    }
}
