package com.ludus.gym.data.remote

import com.ludus.gym.data.remote.dto.ApiErrorEnvelopeDto
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import retrofit2.HttpException
import java.io.IOException
import java.util.Collections
import java.util.WeakHashMap

private data class ApiFailure(val code: String? = null, val message: String? = null)

/** Traduce los errores de la API a mensajes de interfaz en español. */
object ApiErrorMessages {
    private const val CROSS_GYM_MESSAGE = "Este pase pertenece a otro gimnasio"

    private val moshi = Moshi.Builder().add(KotlinJsonAdapterFactory()).build()
    private val adapter = moshi.adapter(ApiErrorEnvelopeDto::class.java)
    private val failures = Collections.synchronizedMap(WeakHashMap<Throwable, ApiFailure>())

    fun code(error: Throwable): String? = failure(error).code

    fun readable(error: Throwable): String {
        val failure = failure(error)
        return when {
            failure.code == "CROSS_GYM_PASS" -> CROSS_GYM_MESSAGE
            failure.message?.contains(CROSS_GYM_MESSAGE, ignoreCase = true) == true -> CROSS_GYM_MESSAGE
            error is IOException -> "Sin conexión. Revisa tu red e inténtalo de nuevo."
            failure.code == "NO_GYM" -> "Únete a un gimnasio para continuar."
            failure.code == "EMAIL_NOT_VERIFIED" -> "Tu correo aún no está verificado. Revisa tu bandeja."
            failure.code == "GYM_NOT_ACTIVE" -> "Este gimnasio todavía no está activo."
            failure.code == "VALIDATION_ERROR" ->
                failure.message?.takeIf { it.isNotBlank() } ?: "Revisa los datos introducidos."
            else -> failure.message?.takeIf { it.isNotBlank() }
                ?: error.message?.takeIf { it.isNotBlank() }
                ?: "No pudimos completar la operación. Inténtalo de nuevo."
        }
    }

    private fun failure(error: Throwable): ApiFailure =
        failures[error] ?: parse(error).also { failures[error] = it }

    private fun parse(error: Throwable): ApiFailure {
        if (error is HttpException) {
            val body = runCatching { error.response()?.errorBody()?.string().orEmpty() }.getOrNull().orEmpty()
            val dto = runCatching { adapter.fromJson(body) }.getOrNull()
            return ApiFailure(dto?.error?.code, dto?.error?.message)
        }
        val code = Regex("""\b(CROSS_GYM_PASS|NO_GYM|GYM_NOT_ACTIVE|EMAIL_NOT_VERIFIED|CONFLICT|VALIDATION_ERROR)\b""")
            .find(error.message.orEmpty())?.groupValues?.get(1)
        return ApiFailure(code = code)
    }
}
