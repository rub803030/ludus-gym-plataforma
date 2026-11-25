package com.ludus.gym.ui.screens.auth

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ludus.gym.data.demo.DemoCatalog
import com.ludus.gym.data.remote.ApiErrorMessages
import com.ludus.gym.domain.model.EmailNotVerifiedException
import com.ludus.gym.domain.model.Member
import com.ludus.gym.domain.usecase.LoginUseCase
import com.ludus.gym.domain.usecase.ResendVerificationUseCase
import com.ludus.gym.domain.usecase.VerifyEmailUseCase
import kotlinx.coroutines.launch

class LoginViewModel(
    private val login: LoginUseCase,
    private val verifyEmail: VerifyEmailUseCase,
    private val resendVerification: ResendVerificationUseCase,
    initialEmail: String = DemoCatalog.DEMO_EMAIL,
    initialDevLink: String? = null,
) : ViewModel() {

    var email by mutableStateOf(initialEmail)
        private set
    var password by mutableStateOf(DemoCatalog.DEMO_PASSWORD)
        private set
    var passwordVisible by mutableStateOf(false)
        private set
    var isLoading by mutableStateOf(false)
        private set
    var errorMessage by mutableStateOf<String?>(null)
        private set

    var verificationRequired by mutableStateOf(false)
        private set
    var verificationBusy by mutableStateOf(false)
        private set
    var verificationMessage by mutableStateOf<String?>(null)
        private set
    var verificationDone by mutableStateOf(false)
        private set
    var devLink by mutableStateOf<String?>(initialDevLink)
        private set

    /** Prepara la pantalla de verificación tras un registro correcto. */
    fun prepareVerification(email: String, devToken: String?, devLink: String?) {
        this.email = email.trim()
        this.devLink = devLink
        verificationRequired = true
        verificationDone = false
        verificationMessage = if (devToken.isNullOrBlank()) {
            "Te enviamos un enlace a $email. Pégalo abajo para confirmar tu correo."
        } else {
            "Modo desarrollo: usa el código enviado a $email o pégalo abajo."
        }
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

    fun submit(onSuccess: (Member) -> Unit) {
        if (isLoading) return
        viewModelScope.launch {
            isLoading = true
            errorMessage = null
            verificationMessage = null
            login(email, password).fold(
                onSuccess = onSuccess,
                onFailure = {
                    if (it is EmailNotVerifiedException) {
                        verificationRequired = true
                        errorMessage = it.message
                    } else {
                        errorMessage = it.readableMessage()
                    }
                },
            )
            isLoading = false
        }
    }

    fun submitVerificationCode(code: String) {
        if (verificationBusy || code.isBlank()) return
        viewModelScope.launch {
            verificationBusy = true
            verificationMessage = null
            verifyEmail(code).fold(
                onSuccess = {
                    verificationRequired = false
                    verificationDone = true
                    verificationMessage = "Correo verificado. Inicia sesión para continuar."
                },
                onFailure = { verificationMessage = it.readableMessage() },
            )
            verificationBusy = false
        }
    }

    fun resend() {
        if (verificationBusy || email.isBlank()) return
        viewModelScope.launch {
            verificationBusy = true
            verificationMessage = null
            resendVerification(email).fold(
                onSuccess = { verificationMessage = "Enviamos un nuevo enlace. Revisa tu bandeja y spam." },
                onFailure = { verificationMessage = it.readableMessage() },
            )
            verificationBusy = false
        }
    }

    fun consumeDeepLinkToken(token: String?) {
        if (token.isNullOrBlank()) return
        verificationRequired = true
        submitVerificationCode(token)
    }

    private fun Throwable.readableMessage(): String = when (this) {
        is IllegalArgumentException -> message ?: "Revisa los datos introducidos."
        is EmailNotVerifiedException -> message ?: "Tu correo aún no está verificado."
        else -> ApiErrorMessages.readable(this)
    }
}
