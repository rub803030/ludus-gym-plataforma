import SwiftUI

struct WorkoutView: View {
    @Environment(AppRouter.self) private var router
    @Environment(ThemeStore.self) private var theme
    @State private var viewModel = WorkoutViewModel()

    private let dayLabels = ["L", "M", "X", "J", "V", "S", "D"]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                LudusScreenHeader(
                    title: "Entrenamiento",
                    subtitle: "Tu rutina semanal",
                    showsBack: true,
                    back: { router.back() },
                    trailing: AnyView(
                        Button(action: { Task { await viewModel.refresh() } }) {
                            Text("Actualizar")
                                .font(.ludusTitle(13))
                                .frame(minHeight: 48)
                        }
                        .foregroundStyle(theme.palette.volt)
                    )
                )

                HStack(spacing: 6) {
                    ForEach(1...7, id: \.self) { day in
                        Button(action: {
                            viewModel.selectedDay = day
                            viewModel.selectedExercise = nil
                            viewModel.message = nil
                        }) {
                            Text(dayLabels[day - 1])
                                .font(.ludusTitle(15))
                                .frame(maxWidth: .infinity, minHeight: 48)
                                .background(
                                    day == viewModel.selectedDay ? theme.palette.volt : theme.palette.raised,
                                    in: RoundedRectangle(cornerRadius: 12)
                                )
                                .foregroundStyle(
                                    day == viewModel.selectedDay ? Color(hex: "#101214") : theme.palette.ink
                                )
                        }
                        .buttonStyle(.plain)
                    }
                }

                if viewModel.pendingCount > 0 {
                    StatusPill(text: "\(viewModel.pendingCount) por sincronizar", tone: .ignition)
                }

                if let routine = viewModel.currentRoutine {
                    LudusCard {
                        Text(routine.title)
                            .font(.ludusTitle(20))
                            .foregroundStyle(theme.palette.ink)
                        Text("\(routine.durationMinutes) min · \(routine.exercises.count) ejercicios")
                            .font(.ludusBody(13))
                            .foregroundStyle(theme.palette.muted)

                        ForEach(routine.exercises) { exercise in
                            Divider().background(theme.palette.hairline)
                            VStack(alignment: .leading, spacing: 6) {
                                Text(exercise.name)
                                    .font(.ludusTitle(16))
                                    .foregroundStyle(theme.palette.ink)
                                Text("\(exercise.sets) × \(exercise.reps) · \(weightLabel(exercise.weightKg)) · RPE \(exercise.rpe)")
                                    .font(.ludusBody(13))
                                    .foregroundStyle(theme.palette.muted)
                                Text(exercise.muscleGroup)
                                    .font(.ludusBody(12))
                                    .foregroundStyle(theme.palette.muted)
                                LudusButton(title: "Registrar serie", variant: .secondary) {
                                    viewModel.selectExercise(exercise)
                                }
                            }
                        }
                    }
                } else {
                    EmptyState(
                        title: "Sin rutina este día",
                        message: "Toca Actualizar para cargar tu plan de entrenamiento.",
                        actionTitle: "Actualizar",
                        action: { Task { await viewModel.refresh() } }
                    )
                }

                if let message = viewModel.message {
                    Text(message)
                        .font(.ludusBody(14))
                        .foregroundStyle(theme.palette.volt)
                }

                LudusButton(title: "Volver", variant: .ghost) { router.back() }
            }
            .padding(24)
        }
        .background(theme.palette.canvas.ignoresSafeArea())
        .task { await viewModel.refresh() }
        .sheet(item: $viewModel.selectedExercise) { _ in
            logSheet
                .background(theme.palette.canvas)
                .presentationDetents([.large])
        }
    }

    private func weightLabel(_ weight: Double) -> String {
        weight.truncatingRemainder(dividingBy: 1) == 0
            ? "\(Int(weight)) kg"
            : "\(weight) kg"
    }

    private var logSheet: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                LudusScreenHeader(title: "Registrar serie", subtitle: "Series, reps, peso e intensidad")
                LudusTextField(title: "Series", placeholder: "3", text: $viewModel.sets, keyboard: .numberPad)
                LudusTextField(title: "Reps", placeholder: "10", text: $viewModel.reps, keyboard: .numberPad)
                LudusTextField(title: "Peso", placeholder: "0", text: $viewModel.weight, keyboard: .decimalPad)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Intensidad (RPE): \(viewModel.rpe)")
                        .font(.ludusTitle(15))
                        .foregroundStyle(theme.palette.ink)
                    Slider(value: Binding(
                        get: { Double(viewModel.rpe) },
                        set: { viewModel.rpe = Int($0.rounded()) }
                    ), in: 1...10, step: 1)
                    .tint(theme.palette.volt)
                }

                LudusButton(title: "Guardar serie", isLoading: viewModel.isLogging) {
                    Task { await viewModel.logSet() }
                }

                LudusButton(title: "Volver", variant: .ghost) {
                    viewModel.selectedExercise = nil
                }
            }
            .padding(24)
        }
        .keyboardAware()
    }
}
