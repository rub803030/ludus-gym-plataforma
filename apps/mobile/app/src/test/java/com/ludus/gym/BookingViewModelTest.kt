package com.ludus.gym

import com.ludus.gym.data.remote.dto.ClassDto
import com.ludus.gym.data.repository.BookingRepository
import com.ludus.gym.data.repository.PaymentRepository
import com.ludus.gym.domain.model.GymClass
import com.ludus.gym.domain.usecase.BookClassUseCase
import com.ludus.gym.domain.usecase.CancelBookingUseCase
import com.ludus.gym.domain.usecase.ObserveClassesUseCase
import com.ludus.gym.domain.usecase.ObserveReceiptsUseCase
import com.ludus.gym.domain.usecase.RefreshClassesUseCase
import com.ludus.gym.domain.usecase.RefreshReceiptsUseCase
import com.ludus.gym.ui.screens.bookings.BookingViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/** Flujo de reservas: confirmación, alta, baja y fallback offline. */
@OptIn(ExperimentalCoroutinesApi::class)
class BookingViewModelTest {
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

    private fun viewModel(): BookingViewModel {
        val bookings = BookingRepository(api)
        val payments = PaymentRepository(api)
        return BookingViewModel(
            observeClasses = ObserveClassesUseCase(bookings),
            observeReceipts = ObserveReceiptsUseCase(payments),
            refreshClasses = RefreshClassesUseCase(bookings),
            refreshReceipts = RefreshReceiptsUseCase(payments),
            bookClass = BookClassUseCase(bookings),
            cancelBooking = CancelBookingUseCase(bookings),
        )
    }

    private fun gymClass(booked: Boolean = false) = GymClass(
        id = "hyrox-test",
        title = "Hyrox · Engine",
        startAt = "Hoy · 07:00",
        capacity = 16,
        booked = 11,
        isBooked = booked,
    )

    @Test
    fun `pide confirmacion y reserva la plaza`() {
        api.classes = listOf(ClassDto(id = "hyrox-test", title = "Hyrox · Engine", capacity = 16, booked = 11))
        val vm = viewModel()
        val item = gymClass()

        assertNull(vm.confirmationFor)
        vm.requestBook(item)
        assertEquals(item, vm.confirmationFor)

        vm.confirm()
        assertEquals("Plaza reservada. ¡Nos vemos en clase!", vm.message)
        assertEquals(listOf("hyrox-test"), api.bookedIds)
        assertTrue(api.cancelledIds.isEmpty())
        assertNull(vm.busyClassId)
        assertNull(vm.confirmationFor)
    }

    @Test
    fun `cancela una reserva ya confirmada`() {
        api.classes = listOf(
            ClassDto(id = "hyrox-test", title = "Hyrox · Engine", capacity = 16, booked = 12, isBooked = true),
        )
        val vm = viewModel()

        vm.requestCancel(gymClass(booked = true))
        assertEquals("hyrox-test", vm.confirmationFor?.id)
        vm.confirm()

        assertEquals("Reserva cancelada.", vm.message)
        assertEquals(listOf("hyrox-test"), api.cancelledIds)
        assertTrue(api.bookedIds.isEmpty())
    }

    @Test
    fun `confirmar sin seleccion no llama a la API`() {
        val vm = viewModel()

        vm.confirm()

        assertNull(vm.message)
        assertTrue(api.bookedIds.isEmpty())
        assertTrue(api.cancelledIds.isEmpty())
    }

    @Test
    fun `sin red la reserva se confirma en local`() {
        api.bookFails = true
        val vm = viewModel()

        vm.requestBook(gymClass())
        vm.confirm()

        assertEquals("Plaza reservada. ¡Nos vemos en clase!", vm.message)
        assertEquals(listOf("hyrox-test"), api.bookedIds)
    }

    @Test
    fun `el mensaje se consume y los comprobantes se alternan`() {
        val vm = viewModel()
        vm.requestBook(gymClass())
        vm.confirm()

        assertTrue(vm.showReceipts.not())
        vm.toggleReceipts()
        assertTrue(vm.showReceipts)
        vm.consumeMessage()
        assertNull(vm.message)
        vm.toggleReceipts()
        assertFalse(vm.showReceipts)
    }
}
