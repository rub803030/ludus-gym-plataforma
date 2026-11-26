package com.ludus.gym.ui.screens.gym

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ludus.gym.data.remote.ApiErrorMessages
import com.ludus.gym.domain.model.GymRegistrationResult
import com.ludus.gym.domain.model.RegisterGymInput
import com.ludus.gym.domain.usecase.RegisterGymUseCase
import kotlinx.coroutines.launch

/** Estado y validación local del alta pública de gimnasio. */
class RegisterGymViewModel(
    private val registerGym: RegisterGymUseCase,
) : ViewModel() {

    var gymName by mutableStateOf("")
        private set
    var slug by mutableStateOf("")
        private set
    var ownerName by mutableStateOf("")
        private set
    var email by mutableStateOf("")
        private set
    var password by mutableStateOf("")
        private set
    var passwordVisible by mutableStateOf(false)
        private set
    var contactEmail by mutableStateOf("")
        private set
    var phone by mutableStateOf("")
        private set
    var address by mutableStateOf("")
        private set
    var city by mutableStateOf("")
        private set
    var state by mutableStateOf("")
        private set
    var postalCode by mutableStateOf("")
        private set
    var legalRepresentative by mutableStateOf("")
        private set
    var rfc by mutableStateOf("")
        private set
    var website by mutableStateOf("")
        private set
    var socialMedia by mutableStateOf("")
        private set
    var description by mutableStateOf("")
        private set
    var branchCount by mutableStateOf("")
        private set
    var timezone by mutableStateOf("")
        private set
    var capacity by mutableStateOf("")
        private set
    var openingHours by mutableStateOf("")
        private set

    var isLoading by mutableStateOf(false)
        private set
    var errorMessage by mutableStateOf<String?>(null)
        private set
    var result by mutableStateOf<GymRegistrationResult?>(null)
        private set

    fun onGymNameChange(value: String) {
        gymName = value
        errorMessage = null
    }

    fun onSlugChange(value: String) {
        slug = value
        errorMessage = null
    }

    fun onOwnerNameChange(value: String) {
        ownerName = value
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

    fun onContactEmailChange(value: String) {
        contactEmail = value
        errorMessage = null
    }

    fun onPhoneChange(value: String) {
        phone = value
        errorMessage = null
    }

    fun onAddressChange(value: String) {
        address = value
        errorMessage = null
    }

    fun onCityChange(value: String) {
        city = value
        errorMessage = null
    }

    fun onStateChange(value: String) {
        state = value
        errorMessage = null
    }

    fun onPostalCodeChange(value: String) {
        postalCode = value
        errorMessage = null
    }

    fun onLegalRepresentativeChange(value: String) {
        legalRepresentative = value
        errorMessage = null
    }

    fun onRfcChange(value: String) {
        rfc = value
        errorMessage = null
    }

    fun onWebsiteChange(value: String) {
        website = value
        errorMessage = null
    }

    fun onSocialMediaChange(value: String) {
        socialMedia = value
        errorMessage = null
    }

    fun onDescriptionChange(value: String) {
        description = value
        errorMessage = null
    }

    fun onBranchCountChange(value: String) {
        branchCount = value
        errorMessage = null
    }

    fun onTimezoneChange(value: String) {
        timezone = value
        errorMessage = null
    }

    fun onCapacityChange(value: String) {
        capacity = value
        errorMessage = null
    }

    fun onOpeningHoursChange(value: String) {
        openingHours = value
        errorMessage = null
    }

    fun submit(onRegistered: (GymRegistrationResult) -> Unit = {}) {
        if (isLoading) return
        validate()?.let {
            errorMessage = it
            return
        }
        viewModelScope.launch {
            isLoading = true
            errorMessage = null
            registerGym(
                RegisterGymInput(
                    gymName = gymName,
                    slug = slug,
                    ownerName = ownerName,
                    email = email,
                    password = password,
                    contactEmail = contactEmail,
                    phone = phone,
                    address = address,
                    city = city,
                    state = state,
                    postalCode = postalCode,
                    legalRepresentative = legalRepresentative,
                    rfc = rfc,
                    website = website,
                    socialMedia = socialMedia,
                    description = description,
                    branchCount = branchCount,
                    timezone = timezone,
                    capacity = capacity,
                    currency = "MXN",
                    openingHours = openingHours,
                ),
            ).fold(
                onSuccess = {
                    result = it
                    onRegistered(it)
                },
                onFailure = { errorMessage = ApiErrorMessages.readable(it) },
            )
            isLoading = false
        }
    }

    /** Espejo de los límites del contrato `POST /api/gyms/register`. */
    private fun validate(): String? = when {
        gymName.trim().length !in 2..120 ->
            "El nombre del gimnasio debe tener entre 2 y 120 caracteres."
        slug.isNotBlank() && (
            slug.trim().length !in 3..48 || !SLUG_REGEX.matches(slug.trim())
            ) -> "El identificador debe tener de 3 a 48 caracteres y usar solo minúsculas, números y guiones."
        ownerName.trim().length !in 2..120 ->
            "El nombre del dueño debe tener entre 2 y 120 caracteres."
        !validEmail(email) -> "Introduce un correo electrónico válido."
        password.length !in 12..128 -> "La contraseña debe tener entre 12 y 128 caracteres."
        !validEmail(contactEmail) -> "Introduce un correo de contacto válido."
        phone.trim().length !in 8..40 -> "El teléfono debe tener entre 8 y 40 caracteres."
        address.trim().length !in 5..200 -> "La dirección debe tener entre 5 y 200 caracteres."
        city.trim().length !in 2..80 -> "La ciudad debe tener entre 2 y 80 caracteres."
        state.trim().length !in 2..80 -> "El estado debe tener entre 2 y 80 caracteres."
        postalCode.trim().length !in 4..12 -> "El código postal debe tener entre 4 y 12 caracteres."
        legalRepresentative.trim().length !in 2..120 ->
            "El representante legal debe tener entre 2 y 120 caracteres."
        rfc.trim().length !in 12..13 -> "El RFC debe tener entre 12 y 13 caracteres."
        website.isNotBlank() && !URL_REGEX.matches(website.trim()) ->
            "Introduce un sitio web válido, por ejemplo https://ejemplo.com."
        socialMedia.trim().length > 300 -> "Las redes sociales no pueden superar los 300 caracteres."
        description.trim().length > 1000 -> "La descripción no puede superar los 1000 caracteres."
        branchCount.isNotBlank() && (branchCount.trim().toIntOrNull() ?: 0) !in 1..1000 ->
            "El número de sucursales debe estar entre 1 y 1000."
        capacity.isNotBlank() && (capacity.trim().toIntOrNull() ?: 0) < 1 ->
            "La capacidad debe ser un número entero positivo."
        openingHours.trim().length > 200 -> "El horario no puede superar los 200 caracteres."
        else -> null
    }

    private fun validEmail(value: String): Boolean {
        val candidate = value.trim()
        return candidate.length <= 255 && EMAIL_REGEX.matches(candidate)
    }

    private companion object {
        val EMAIL_REGEX = Regex("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$")
        val SLUG_REGEX = Regex("^[a-z0-9]+(?:-[a-z0-9]+)*$")
        val URL_REGEX = Regex("^https?://[^\\s]+$")
    }
}
