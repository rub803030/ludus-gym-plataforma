package com.ludus.gym

import com.ludus.gym.domain.model.EnrollmentQrParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Base64

/** El escáner pasa el token completo a la API; la firma se valida allí. */
class EnrollmentQrParserTest {
    private val gymId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"

    private fun token(code: String = "LUDUS-A7K2"): String {
        val json = """{"kind":"gym-enroll","gymId":"$gymId","code":"$code","signature":"${"c".repeat(64)}"}"""
        return Base64.getUrlEncoder().withoutPadding().encodeToString(json.toByteArray(Charsets.UTF_8))
    }

    @Test
    fun `normaliza el token plano y el enlace con code`() {
        val raw = token()
        assertEquals(raw, EnrollmentQrParser.normalize("  $raw  "))
        assertEquals(
            "LUDUS-A7K2",
            EnrollmentQrParser.normalize("https://ludus.gym/unirme?code=LUDUS-A7K2"),
        )
    }

    @Test
    fun `parsea el QR de inscripcion sin verificar la firma localmente`() {
        val parsed = EnrollmentQrParser.parse(token())!!
        assertEquals(gymId, parsed.gymId)
        assertEquals("LUDUS-A7K2", parsed.code)
        assertTrue(parsed.token.length > 40)
    }

    @Test
    fun `rechaza un QR que no es de inscripcion`() {
        assertNull(EnrollmentQrParser.parse("no-es-base64"))
        assertNull(EnrollmentQrParser.parse(Base64.getUrlEncoder().withoutPadding()
            .encodeToString("""{"kind":"access","gymId":"$gymId","code":"LUDUS-A7K2"}""".toByteArray())))
    }
}
