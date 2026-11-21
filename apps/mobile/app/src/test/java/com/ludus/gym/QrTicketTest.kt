package com.ludus.gym

import com.ludus.gym.domain.model.QrTicket
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Cuenta regresiva y expiración del pase mostrado en pantalla. */
class QrTicketTest {
    @Test
    fun `el pase vigente muestra segundos y expira al llegar a cero`() {
        val now = System.currentTimeMillis()
        val ticket = QrTicket(token = "pase-firmado", validUntilMillis = now + 30_000L)

        assertEquals(30L, ticket.secondsRemaining(now))
        assertFalse(ticket.isExpired(now))
        assertFalse(ticket.isExpired(now + 29_000L))
        assertTrue(ticket.isExpired(now + 30_000L))
        assertEquals(0L, ticket.secondsRemaining(now + 60_000L))
    }

    @Test
    fun `la credencial offline usa la misma ventana de expiracion`() {
        val now = System.currentTimeMillis()
        val offline = QrTicket(token = "credencial-offline", validUntilMillis = now + 600_000L, offline = true)

        assertTrue(offline.offline)
        assertEquals(600L, offline.secondsRemaining(now))
        assertFalse(offline.isExpired(now + 599_000L))
        assertTrue(offline.isExpired(now + 600_000L))
    }
}
