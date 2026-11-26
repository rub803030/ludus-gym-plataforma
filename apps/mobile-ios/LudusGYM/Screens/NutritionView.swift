import SwiftUI

struct NutritionView: View {
    @Environment(AppRouter.self) private var router
    @Environment(ThemeStore.self) private var theme
    @State private var viewModel = NutritionViewModel()

    private let mlPerGlass = 250

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                LudusScreenHeader(
                    title: "Nutrición",
                    subtitle: "Plan y seguimiento diario",
                    showsBack: true,
                    back: { router.back() },
                    trailing: AnyView(
                        Button(action: { Task { await viewModel.load() } }) {
                            Text("Actualizar")
                                .font(.ludusTitle(13))
                                .frame(minHeight: 48)
                        }
                        .foregroundStyle(theme.palette.volt)
                    )
                )

                LudusCard {
                    Text(viewModel.plan.title)
                        .font(.ludusTitle(20))
                        .foregroundStyle(theme.palette.ink)

                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                        MacroTile(title: "kcal", value: "\(viewModel.plan.calories)")
                        MacroTile(title: "Proteína", value: "\(viewModel.plan.proteinG) g")
                        MacroTile(title: "Carbos", value: "\(viewModel.plan.carbsG) g")
                        MacroTile(title: "Grasa", value: "\(viewModel.plan.fatG) g")
                    }

                    Divider().background(theme.palette.hairline)

                    Text("Hidratación")
                        .font(.ludusTitle(16))
                        .foregroundStyle(theme.palette.ink)
                    Text("\(viewModel.hydrationGlasses) vasos · \(viewModel.hydrationGlasses * mlPerGlass) de \(viewModel.plan.hydrationMl) ml")
                        .font(.ludusBody(13))
                        .foregroundStyle(theme.palette.muted)
                        .monospacedDigit()

                    HStack(spacing: 12) {
                        LudusButton(title: "Quitar vaso", variant: .secondary) {
                            viewModel.removeGlass()
                        }
                        LudusButton(title: "Añadir vaso", variant: .secondary) {
                            viewModel.addGlass()
                        }
                    }
                }

                SectionHeader(title: "Comidas del día")

                ForEach(viewModel.plan.meals) { meal in
                    LudusCard {
                        HStack {
                            Text(meal.name)
                                .font(.ludusTitle(17))
                                .foregroundStyle(theme.palette.ink)
                            Spacer()
                            Text("\(meal.calories) kcal")
                                .font(.ludusTitle(14))
                                .monospacedDigit()
                                .foregroundStyle(theme.palette.volt)
                        }
                        if !meal.foods.isEmpty {
                            Text(meal.foods.joined(separator: " · "))
                                .font(.ludusBody(13))
                                .foregroundStyle(theme.palette.muted)
                        }
                        Text("P \(meal.proteinG) g · C \(meal.carbsG) g · G \(meal.fatG) g")
                            .font(.ludusBody(13))
                            .foregroundStyle(theme.palette.muted)
                    }
                }

                LudusButton(title: "Volver", variant: .ghost) { router.back() }
            }
            .padding(24)
        }
        .background(theme.palette.canvas.ignoresSafeArea())
        .task { await viewModel.load() }
    }
}

private struct MacroTile: View {
    @Environment(ThemeStore.self) private var theme
    let title: String
    let value: String

    var body: some View {
        VStack(spacing: 6) {
            Text(value)
                .font(.ludusTitle(20))
                .monospacedDigit()
                .foregroundStyle(theme.palette.ink)
            Text(title)
                .font(.ludusBody(12))
                .foregroundStyle(theme.palette.muted)
        }
        .frame(maxWidth: .infinity, minHeight: 80)
        .padding(10)
        .background(theme.palette.raised, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(theme.palette.hairline, lineWidth: 1))
    }
}
