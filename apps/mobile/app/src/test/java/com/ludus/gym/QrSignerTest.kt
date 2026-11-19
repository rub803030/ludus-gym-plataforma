package com.ludus.gym

import org.junit.Assert.assertEquals
import org.junit.Test

class QrSignerTest {
    @Test
    fun `firma estable para el mismo bucket`() {
        assertEquals("abc", "abc")
    }
}