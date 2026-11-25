package com.ludus.gym

import com.ludus.gym.domain.model.QrPayload
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Base64

/** Contrato del formato QR que emite la API y consume la app. */
class QrSignerTest {
    private val memberId = "11111111-2222-3333-4444-555555555555"
    private val gymId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"

    private fun encode(json: String): String =
        Base64.getUrlEncoder().withoutPadding().encodeToString(json.toByteArray(Charsets.UTF_8))

    @Test
    fun `parsea el pase dinamico firmado por la API`() {
        val now = System.currentTimeMillis()
        val exp = now + 30_000L
        val raw = encode(
            """{"memberId":"$memberId","gymId":"$gymId","bucket":${now / 30_000L},"exp":$exp,"nonce":"abc123","signature":"${"a".repeat(64)}"}""",
        )

        val parsed = QrPayload.parse(raw)
        assertEquals(memberId, parsed?.memberId)
        assertEquals(gymId, parsed?.gymId)
        assertEquals(exp, parsed?.expiresAtMillis)
        assertTrue(parsed?.kind.isNullOrEmpty())
        assertTrue(QrPayload.isLiveTicket(raw, now))
        assertFalse(QrPayload.isOfflineCredential(raw, now))
    }

    @Test
    fun `parsea la credencial offline firmada por la API`() {
        val now = System.currentTimeMillis()
        val exp = now + 600_000L
        val raw = encode(
            """{"memberId":"$memberId","gymId":"$gymId","exp":$exp,"nonce":"abc123","kind":"offline","signature":"${"b".repeat(64)}"}""",
        )

        assertEquals(gymId, QrPayload.parse(raw)?.gymId)
        assertEquals(exp, QrPayload.parse(raw)?.expiresAtMillis)
        assertTrue(QrPayload.isOfflineCredential(raw, now))
        assertFalse(QrPayload.isLiveTicket(raw, now))
    }

    @Test
    fun `rechaza credenciales vencidas incompletas o corruptas`() {
        val past = System.currentTimeMillis() - 1_000L
        val expired = encode("""{"memberId":"$memberId","gymId":"$gymId","exp":$past,"kind":"offline"}""")
        val withoutExp = encode("""{"memberId":"$memberId","gymId":"$gymId","kind":"offline"}""")

        assertFalse(QrPayload.isOfflineCredential(expired))
        assertFalse(QrPayload.isOfflineCredential(withoutExp))
        assertFalse(QrPayload.isOfflineCredential("no-es-base64"))
        assertEquals(null, QrPayload.parse(withoutExp))
    }
}
