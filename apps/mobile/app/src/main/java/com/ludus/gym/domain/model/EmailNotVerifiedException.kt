package com.ludus.gym.domain.model

/** La API devolvió 403 EMAIL_NOT_VERIFIED: la sesión no puede crearse todavía. */
class EmailNotVerifiedException(
    val email: String,
) : Exception("Tu correo aún no está verificado. Revisa tu bandeja o solicita un nuevo enlace.")
