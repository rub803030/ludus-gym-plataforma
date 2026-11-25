package com.ludus.gym

import com.ludus.gym.data.remote.ApiErrorMessages
import org.junit.Assert.assertEquals
import org.junit.Test

/** Los errores multigimnasio llegan al socio en español. */
class ApiErrorMessagesTest {
    @Test
    fun `cross gym mantiene el mensaje contractual`() {
        assertEquals("Este pase pertenece a otro gimnasio", ApiErrorMessages.readable(IllegalStateException("CROSS_GYM_PASS")))
    }

    @Test
    fun `no gym invita a vincularse`() {
        assertEquals("Únete a un gimnasio para continuar.", ApiErrorMessages.readable(IllegalArgumentException("NO_GYM")))
    }

    @Test
    fun `la causa de la api se expone cuando no hay traduccion`() {
        assertEquals("Código desconocido", ApiErrorMessages.readable(IllegalStateException("Código desconocido")))
    }
}
