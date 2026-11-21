package com.ludus.gym

import com.ludus.gym.data.remote.dto.MealDto
import com.ludus.gym.data.remote.dto.NutritionPlanDto
import com.ludus.gym.data.repository.NutritionRepository
import com.ludus.gym.domain.usecase.ObserveNutritionUseCase
import com.ludus.gym.domain.usecase.RefreshNutritionUseCase
import com.ludus.gym.ui.screens.nutrition.NutritionViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import kotlinx.coroutines.withTimeout
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

/** Estado de nutrición: hidratación acotada y plan servido por la API. */
@OptIn(ExperimentalCoroutinesApi::class)
class NutritionViewModelTest {
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

    private fun viewModel(): NutritionViewModel {
        val repository = NutritionRepository(api)
        return NutritionViewModel(
            observeNutrition = ObserveNutritionUseCase(repository),
            refreshNutrition = RefreshNutritionUseCase(repository),
        )
    }

    @Test
    fun `la hidratacion nunca baja de cero ni sube de doce vasos`() {
        val vm = viewModel()

        repeat(15) { vm.addGlass() }
        assertEquals(12, vm.hydrationGlasses)

        repeat(20) { vm.removeGlass() }
        assertEquals(0, vm.hydrationGlasses)

        vm.addGlass()
        assertEquals(1, vm.hydrationGlasses)
    }

    @Test
    fun `el plan se actualiza con los datos de la API`() = runBlocking {
        api.nutrition = listOf(
            NutritionPlanDto(
                id = "plan-api",
                title = "Plan API",
                calories = 2100,
                meals = listOf(MealDto(id = "meal-1", name = "Desayuno", calories = 480)),
            ),
        )
        val vm = viewModel()

        val plan = withTimeout(5_000) { vm.plan.first { it?.title == "Plan API" } }

        assertEquals(2100, plan?.calories)
        assertEquals(1, plan?.meals?.size)
        assertEquals("Desayuno", plan?.meals?.first()?.name)
    }
}
