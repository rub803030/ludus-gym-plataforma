package com.ludus.gym.domain.model

import java.net.URLDecoder
import java.util.Base64

data class ParsedEnrollmentQr(
    /** Token completo que se envía a la API; la firma se valida solo allí. */
    val token: String,
    val gymId: String,
    val code: String,
)

/** Lee el QR estático de inscripción sin intentar verificar su firma localmente. */
object EnrollmentQrParser {
    private const val MAX_LENGTH = 500

    /** Acepta el token plano, un enlace con `?token=` y un enlace con `?code=`. */
    fun normalize(raw: String): String? {
        val value = raw.trim().takeIf { it.isNotBlank() } ?: return null
        val token = Regex("""(?:[?&](?:token|code)=)([^&#\s]+)""")
            .find(value)?.groupValues?.get(1) ?: value
        @Suppress("DEPRECATION")
        return URLDecoder.decode(token, "UTF-8").take(MAX_LENGTH).takeIf { it.isNotBlank() }
    }

    /** Comprobación de forma para mostrar el código; la autenticidad la decide la API. */
    fun parse(raw: String): ParsedEnrollmentQr? {
        val token = normalize(raw) ?: return null
        val json = runCatching {
            String(Base64.getUrlDecoder().decode(token), Charsets.UTF_8)
        }.getOrNull() ?: return null
        val kind = stringField(json, "kind")
        val code = stringField(json, "code")
        val gymId = stringField(json, "gymId")
        val signature = stringField(json, "signature")
        if (kind != "gym-enroll" || code.length !in 4..16 || gymId.isBlank() || signature.length != 64) {
            return null
        }
        return ParsedEnrollmentQr(token = token, gymId = gymId, code = code)
    }

    private fun stringField(json: String, name: String): String =
        Regex("\"$name\"\\s*:\\s*\"([^\"]*)\"").find(json)?.groupValues?.get(1).orEmpty()
}
