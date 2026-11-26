package com.ludus.gym

import com.ludus.gym.data.remote.dto.GymDto
import com.ludus.gym.data.remote.dto.JoinGymResponseDto
import com.ludus.gym.data.remote.dto.MyGymDto
import com.ludus.gym.data.remote.dto.MyGymsDto
import com.ludus.gym.data.remote.dto.RegisterGymResponseDto
import com.ludus.gym.data.remote.dto.RegisteredGymDto
import com.ludus.gym.data.remote.dto.RegisteredGymOwnerDto
import com.ludus.gym.data.remote.dto.SwitchGymResponseDto
import com.ludus.gym.data.remote.dto.VerificationIssueDto
import com.ludus.gym.data.remote.dto.TokenPairDto
import com.ludus.gym.data.remote.dto.toDomain
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Contrato de vinculación y cambio de gimnasio con renovación de tokens. */
class GymContractTest {
    private val gymId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
    private val gym = GymDto(id = gymId, name = "GYM Norte", publicCode = "LUDUS-A7K2")

    @Test
    fun `join-gym expone los tokens que deben guardarse`() {
        val response = JoinGymResponseDto(
            gym = gym,
            activeGymId = gymId,
            alreadyMember = true,
            tokens = TokenPairDto(accessToken = "access-nuevo", refreshToken = "refresh-nuevo"),
        )

        val result = response.toDomain()
        assertEquals(gymId, result.activeGymId)
        assertTrue(result.alreadyMember)
        assertEquals("access-nuevo", response.tokens?.accessToken)
        assertEquals("refresh-nuevo", response.tokens?.refreshToken)
    }

    @Test
    fun `switch-gym devuelve el gimnasio activo y tokens nuevos`() {
        val response = SwitchGymResponseDto(
            gym = gym,
            activeGymId = gymId,
            tokens = TokenPairDto(accessToken = "access-switch", refreshToken = "refresh-switch"),
        )

        assertEquals(gymId, response.toDomain().activeGymId)
        assertEquals("access-switch", response.tokens?.accessToken)
    }

    @Test
    fun `my-gyms conserva el gimnasio activo calculado por la API`() {
        val result = MyGymsDto(
            activeGymId = gymId,
            gyms = listOf(
                MyGymDto(id = gymId, name = "GYM Norte", isActive = true),
                MyGymDto(id = "otro", name = "GYM Sur", isActive = false),
            ),
        ).toDomain()

        assertEquals(gymId, result.activeGymId)
        assertEquals(2, result.gyms.size)
        assertTrue(result.gyms.first().isActive)
        assertFalse(result.gyms.last().isActive)
    }

    @Test
    fun `registrar gimnasio expone verificacion y autorizacion pendientes`() {
        val response = RegisterGymResponseDto(
            gym = RegisteredGymDto(
                id = gymId,
                name = "GYM Norte",
                slug = "gym-norte",
                status = "PENDING_VERIFICATION",
            ),
            owner = RegisteredGymOwnerDto(email = "owner@test.com", fullName = "Ana Pérez"),
            verification = VerificationIssueDto(email = "owner@test.com", expiresAt = "2026-11-27T00:00:00Z"),
            approval = VerificationIssueDto(email = "admin@test.com", expiresAt = "2026-11-28T00:00:00Z"),
        )

        val result = response.toDomain()

        assertEquals(gymId, result.gymId)
        assertEquals("gym-norte", result.slug)
        assertEquals("PENDING_VERIFICATION", result.status)
        assertEquals("owner@test.com", result.ownerEmail)
        assertEquals("owner@test.com", result.verificationEmail)
        assertEquals("admin@test.com", result.approvalEmail)
        assertNull(result.verificationDevLink)
        assertNull(result.approvalDevToken)
    }
}
