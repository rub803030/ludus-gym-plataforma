package com.ludus.gym.ui.screens.workout

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ludus.gym.domain.model.Exercise
import com.ludus.gym.domain.model.Routine
import com.ludus.gym.domain.usecase.LogWorkoutUseCase
import com.ludus.gym.domain.usecase.ObservePendingWorkoutsUseCase
import com.ludus.gym.domain.usecase.ObserveRoutinesUseCase
import com.ludus.gym.domain.usecase.RefreshRoutinesUseCase
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.util.Calendar

class WorkoutViewModel(
    observeRoutines: ObserveRoutinesUseCase,
    observePending: ObservePendingWorkoutsUseCase,
    private val refreshRoutines: RefreshRoutinesUseCase,
    private val logWorkout: LogWorkoutUseCase,
) : ViewModel() {

    val routines = observeRoutines().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val pendingCount = observePending().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0)

    var selectedDay by mutableStateOf(today())
        private set
    var selectedExercise by mutableStateOf<Exercise?>(null)
        private set
    var setsInput by mutableStateOf("3")
        private set
    var repsInput by mutableStateOf("10")
        private set
    var weightInput by mutableStateOf("0")
        private set
    var rpe by mutableStateOf(7)
        private set
    var isLogging by mutableStateOf(false)
        private set
    var message by mutableStateOf<String?>(null)
        private set
    var showReceipts by mutableStateOf(false)
        private set

    init { refresh() }

    fun refresh() {
        viewModelScope.launch { refreshRoutines() }
    }

    fun selectDay(day: Int) {
        selectedDay = day
        selectedExercise = null
        message = null
    }

    fun selectExercise(exercise: Exercise) {
        selectedExercise = exercise
        setsInput = exercise.sets.toString()
        repsInput = exercise.reps.toString()
        weightInput = if (exercise.weightKg % 1.0 == 0.0) {
            exercise.weightKg.toInt().toString()
        } else {
            exercise.weightKg.toString()
        }
        rpe = exercise.rpe
    }

    fun onSetsChange(value: String) { setsInput = value.filter { it.isDigit() }.take(2) }
    fun onRepsChange(value: String) { repsInput = value.filter { it.isDigit() }.take(3) }
    fun onWeightChange(value: String) { weightInput = value.filter { it.isDigit() || it == '.' }.take(6) }
    fun onRpeChange(value: Int) { rpe = value.coerceIn(1, 10) }

    fun currentRoutine(): Routine? =
        routines.value.firstOrNull { it.dayOfWeek == selectedDay }

    fun logSet() {
        val exercise = selectedExercise
        if (exercise == null) {
            message = "Elige un ejercicio para registrar la serie."
            return
        }
        if (isLogging) return
        val sets = setsInput.toIntOrNull() ?: 0
        val reps = repsInput.toIntOrNull() ?: 0
        val weight = weightInput.toDoubleOrNull() ?: 0.0
        viewModelScope.launch {
            isLogging = true
            message = null
            logWorkout(exercise, sets, reps, weight, rpe).fold(
                onSuccess = {
                    message = "Serie guardada. Se sincronizará cuando haya conexión."
                    showReceipts = true
                },
                onFailure = { message = it.message ?: "No se pudo guardar la serie." },
            )
            isLogging = false
        }
    }

    fun consumeMessage() { message = null }

    companion object {
        fun today(): Int = (Calendar.getInstance().get(Calendar.DAY_OF_WEEK) + 5) % 7 + 1
    }
}
