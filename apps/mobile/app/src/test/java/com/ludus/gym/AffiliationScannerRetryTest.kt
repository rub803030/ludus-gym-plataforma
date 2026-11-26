package com.ludus.gym

import com.ludus.gym.data.repository.GymRepository
import com.ludus.gym.domain.model.Gym
import com.ludus.gym.domain.model.JoinResult
import com.ludus.gym.domain.model.MyGyms
import com.ludus.gym.domain.model.SwitchResult
import com.ludus.gym.domain.usecase.JoinGymUseCase
import com.ludus.gym.ui.screens.gym.LinkGymViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class AffiliationScannerRetryTest {
    private lateinit var repository: RetryGymRepository

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        repository = RetryGymRepository()
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `shows domain feedback and retries the same scanned QR`() = runTest {
        val viewModel = LinkGymViewModel(JoinGymUseCase(repository))
        val qr = "LUDUS-A7K2"
        var linked = 0

        viewModel.onScanned(qr) { linked++ }

        assertEquals("Únete a un gimnasio para continuar.", viewModel.errorMessage)
        assertEquals(qr, repository.attempts.single())

        viewModel.onScanned(qr) { linked++ }

        assertEquals(listOf(qr, qr), repository.attempts)
        assertNull(viewModel.errorMessage)
        assertEquals(1, linked)
        assertTrue(viewModel.message?.contains("GYM Norte") == true)
    }

    private class RetryGymRepository : GymRepository {
        override val activeGymId = MutableStateFlow<String?>("gym-1")
        val attempts = mutableListOf<String>()

        override fun observeGyms(): Flow<List<Gym>> = flowOf(emptyList())

        override suspend fun joinGym(code: String): Result<JoinResult> {
            attempts += code
            if (attempts.size == 1) return Result.failure(IllegalStateException("NO_GYM"))
            return Result.success(JoinResult(Gym("gym-1", "GYM Norte"), "gym-1"))
        }

        override suspend fun refreshMyGyms(): Result<MyGyms> = error("Not used")
        override suspend fun switchGym(gymId: String): Result<SwitchResult> = error("Not used")
    }
}
