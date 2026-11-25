package com.ludus.gym.ui.screens.gym

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ludus.gym.data.remote.ApiErrorMessages
import com.ludus.gym.domain.model.EnrollmentQrParser
import com.ludus.gym.domain.model.JoinResult
import com.ludus.gym.domain.usecase.JoinGymUseCase
import kotlinx.coroutines.launch

class LinkGymViewModel(
    private val joinGym: JoinGymUseCase,
) : ViewModel() {

    var code by mutableStateOf("")
        private set
    var isLoading by mutableStateOf(false)
        private set
    var errorMessage by mutableStateOf<String?>(null)
        private set
    var message by mutableStateOf<String?>(null)
        private set

    fun onCodeChange(value: String) {
        code = value
        errorMessage = null
    }

    fun submit(onLinked: (JoinResult) -> Unit) {
        val value = EnrollmentQrParser.normalize(code)
        if (value.isNullOrBlank()) {
            errorMessage = "Escribe el código del gimnasio o escanea su QR."
            return
        }
        join(value, onLinked)
    }

    /** El QR puede contener el token completo; nunca se usa el gymId leído para llamar a la API. */
    fun onScanned(rawValue: String, onLinked: (JoinResult) -> Unit) {
        val parsed = EnrollmentQrParser.parse(rawValue)
        if (parsed != null) {
            code = parsed.code
            errorMessage = null
            join(parsed.token, onLinked)
            return
        }
        val value = EnrollmentQrParser.normalize(rawValue)
        if (value.isNullOrBlank()) {
            errorMessage = "No pudimos leer el QR. Prueba a escribir el código LUDUS-XXXX."
        } else {
            code = value
            errorMessage = null
            join(value, onLinked)
        }
    }

    private fun join(token: String, onLinked: (JoinResult) -> Unit) {
        if (isLoading) return
        viewModelScope.launch {
            isLoading = true
            errorMessage = null
            message = null
            joinGym(token).fold(
                onSuccess = { result ->
                    message = if (result.alreadyMember) {
                        "Ya eras socio de ${result.gym.name}. Gimnasio activo actualizado."
                    } else {
                        "Vinculado con ${result.gym.name}. Ya puedes usar tu pase QR."
                    }
                    onLinked(result)
                },
                onFailure = { errorMessage = ApiErrorMessages.readable(it) },
            )
            isLoading = false
        }
    }
}
