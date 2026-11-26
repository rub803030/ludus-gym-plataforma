package com.ludus.gym

import com.ludus.gym.data.remote.dto.RegisterGymRequestDto
import com.ludus.gym.data.remote.dto.RegisterGymResponseDto
import com.ludus.gym.data.remote.dto.RegisteredGymDto
import com.ludus.gym.data.remote.dto.RegisteredGymOwnerDto
import com.ludus.gym.data.remote.dto.VerificationIssueDto
import com.ludus.gym.data.repository.GymRegistrationRepository
import com.ludus.gym.domain.model.RegisterGymInput
import com.ludus.gym.domain.usecase.RegisterGymUseCase
import com.ludus.gym.ui.screens.gym.RegisterGymViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.IOException

/** Contrato del alta pública de gimnasio: mapeo, validación y mensajes en español. */
@OptIn(ExperimentalCoroutinesApi::class)
class GymRegistrationTest {
    private lateinit var api: FakeApiService

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        api = FakeApiService()
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun useCase() = RegisterGymUseCase(GymRegistrationRepository(api))

    private fun response(withDev: Boolean = false) = RegisterGymResponseDto(
        gym = RegisteredGymDto(
            id = "gym-1",
            name = "GYM Norte",
            slug = "gym-norte",
            status = "PENDING_VERIFICATION",
            publicCode = "LUDUS-A7K2",
        ),
        owner = RegisteredGymOwnerDto(email = "owner@test.com", fullName = "Ana Pérez"),
        verification = VerificationIssueDto(
            email = "owner@test.com",
            expiresAt = "2026-11-27T00:00:00Z",
            devToken = if (withDev) "verify-token" else null,
            devLink = if (withDev) "https://ejemplo.test/verify" else null,
        ),
        approval = VerificationIssueDto(
            email = "admin@test.com",
            expiresAt = "2026-11-28T00:00:00Z",
            devToken = if (withDev) "approval-token" else null,
            devLink = if (withDev) "https://ejemplo.test/approve" else null,
        ),
    )

    private fun input() = RegisterGymInput(
        gymName = "  GYM Norte  ",
        slug = "  ",
        ownerName = " Ana Pérez ",
        email = "  Owner@Test.com ",
        password = "contrasena-segura",
        contactEmail = " Contacto@Test.com ",
        phone = " 5512345678 ",
        address = " Calle Principal 12 ",
        city = " León ",
        state = " Guanajuato ",
        postalCode = " 37200 ",
        legalRepresentative = " Ana Pérez ",
        rfc = " pepa800101abc ",
        website = " ",
        socialMedia = " ",
        description = " ",
        branchCount = " 3 ",
        timezone = " ",
        capacity = " 45 ",
        currency = "MXN",
        openingHours = " ",
    )

    @Test
    fun `el repositorio normaliza el request y mapea la respuesta`() = runTest {
        api.gymRegistration = response(withDev = true)

        val result = useCase()(input()).getOrThrow()

        val request = api.registeredGyms.single()
        assertEquals("GYM Norte", request.gymName)
        assertNull(request.slug)
        assertEquals("owner@test.com", request.email)
        assertEquals("contacto@test.com", request.contactEmail)
        assertEquals("PEPA800101ABC", request.rfc)
        assertEquals(3, request.branchCount)
        assertEquals(45, request.capacity)
        assertEquals("MXN", request.currency)
        assertNull(request.website)

        assertEquals("gym-1", result.gymId)
        assertEquals("PENDING_VERIFICATION", result.status)
        assertEquals("owner@test.com", result.ownerEmail)
        assertEquals("verify-token", result.verificationDevToken)
        assertEquals("https://ejemplo.test/approve", result.approvalDevLink)
    }

    @Test
    fun `los atajos de desarrollo ausentes no se inventan`() = runTest {
        api.gymRegistration = response()
        val result = useCase()(input()).getOrThrow()

        assertNull(result.verificationDevToken)
        assertNull(result.verificationDevLink)
        assertNull(result.approvalDevToken)
        assertNull(result.approvalDevLink)
        assertEquals("admin@test.com", result.approvalEmail)
    }

    @Test
    fun `el viewmodel valida antes de llamar a la api`() {
        val vm = viewModel()
        vm.onGymNameChange("GYM Norte")
        vm.onOwnerNameChange("Ana Pérez")
        vm.onEmailChange("owner@test.com")
        vm.onPasswordChange("contrasena-segura")
        vm.onContactEmailChange("contacto@test.com")
        vm.onPhoneChange("5512345678")
        vm.onAddressChange("Calle Principal 12")
        vm.onCityChange("León")
        vm.onStateChange("Guanajuato")
        vm.onPostalCodeChange("37200")
        vm.onLegalRepresentativeChange("Ana Pérez")
        vm.onRfcChange("RFC-CORTO")

        vm.submit()

        assertEquals("El RFC debe tener entre 12 y 13 caracteres.", vm.errorMessage)
        assertTrue(api.registeredGyms.isEmpty())
    }

    @Test
    fun `el viewmodel expone el resultado y los errores legibles`() {
        api.gymRegistration = response(withDev = true)
        val vm = fillValid(RegisterGymViewModel(useCase()))

        vm.submit()

        assertNull(vm.errorMessage)
        assertNotNull(vm.result)
        assertEquals("gym-1", vm.result?.gymId)
        assertFalse(vm.isLoading)

        val offline = object : FakeApiService() {
            override suspend fun registerGym(request: RegisterGymRequestDto): RegisterGymResponseDto =
                throw IOException("fallo de red")
        }
        val failingVm = fillValid(
            RegisterGymViewModel(RegisterGymUseCase(GymRegistrationRepository(offline))),
        )
        failingVm.submit()

        assertEquals("Sin conexión. Revisa tu red e inténtalo de nuevo.", failingVm.errorMessage)
        assertNull(failingVm.result)
    }

    private fun viewModel(): RegisterGymViewModel = RegisterGymViewModel(useCase())

    private fun fillValid(vm: RegisterGymViewModel): RegisterGymViewModel {
        vm.onGymNameChange("GYM Norte")
        vm.onOwnerNameChange("Ana Pérez")
        vm.onEmailChange("owner@test.com")
        vm.onPasswordChange("contrasena-segura")
        vm.onContactEmailChange("contacto@test.com")
        vm.onPhoneChange("5512345678")
        vm.onAddressChange("Calle Principal 12")
        vm.onCityChange("León")
        vm.onStateChange("Guanajuato")
        vm.onPostalCodeChange("37200")
        vm.onLegalRepresentativeChange("Ana Pérez")
        vm.onRfcChange("PEPA800101ABC")
        return vm
    }
}
