import SwiftUI

struct HomeView: View {
    @Environment(AppRouter.self) private var router
    @Environment(ThemeStore.self) private var theme
    @State private var viewModel: HomeViewModel

    let memberId: String
    let name: String

    init(memberId: String, name: String) {
        self.memberId = memberId
        self.name = name
        _viewModel = State(initialValue: HomeViewModel(fallbackName: name))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Ludus.")
                            .font(.ludusDisplay(34))
                            .kerning(-0.03 * 34)
                            .foregroundStyle(theme.palette.volt)
                        Text("Panel del socio")
                            .font(.ludusBody(14))
                            .foregroundStyle(theme.palette.muted)
                    }
                    Spacer()
                    Button(action: { Task { await viewModel.refresh() } }) {
                        Text(viewModel.isRefreshing ? "Actualizando…" : "Actualizar")
                            .font(.ludusTitle(13))
                            .frame(minHeight: 48)
                    }
                    .foregroundStyle(theme.palette.volt)
                    ThemeToggleButton()
                }

                let displayName = viewModel.member?.name ?? (name.isEmpty ? "Socio Ludus" : name)
                Text("Hola, \(displayName)")
                    .font(.ludusDisplay(28))
                    .kerning(-0.03 * 28)
                    .foregroundStyle(theme.palette.ink)

                LudusCard {
                    Text(viewModel.member?.planName ?? "Ludus Pro")
                        .font(.ludusTitle(20))
                        .foregroundStyle(theme.palette.ink)

                    StatusPill(
                        text: viewModel.member?.status == .pending ? "Membresía pendiente" : "Membresía activa",
                        tone: viewModel.member?.status == .pending ? .ignition : .emerald
                    )

                    HStack(spacing: 6) {
                        Text("\(viewModel.member?.daysRemaining ?? 28) días")
                            .font(.ludusTitle(16))
                            .monospacedDigit()
                            .foregroundStyle(theme.palette.ink)
                        Text("·")
                            .foregroundStyle(theme.palette.muted)
                        Text(gymLabel)
                            .font(.ludusBody(14))
                            .foregroundStyle(theme.palette.muted)
                    }

                    Divider().background(theme.palette.hairline)

                    Text("Aforo en vivo")
                        .font(.ludusTitle(14))
                        .foregroundStyle(theme.palette.muted)
                    Text(occupancyLabel)
                        .font(.ludusTitle(17))
                        .monospacedDigit()
                        .foregroundStyle(theme.palette.ink)
                }

                SectionHeader(title: "Acciones rápidas")

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    QuickAction(title: "Mi pase QR", systemImage: "qrcode") {
                        router.goTo(.qr)
                    }
                    QuickAction(title: "Mi rutina", systemImage: "dumbbell.fill") {
                        router.goTo(.workout)
                    }
                    QuickAction(title: "Nutrición", systemImage: "leaf.fill") {
                        router.goTo(.nutrition)
                    }
                    QuickAction(title: "Reservas", systemImage: "calendar.badge.clock") {
                        router.goTo(.bookings)
                    }
                }

                if viewModel.activeGymId == nil {
                    LudusButton(title: "Vincular gimnasio", variant: .secondary) {
                        router.goTo(.vincularGimnasio)
                    }
                } else {
                    LudusButton(title: "Mis gimnasios", variant: .secondary) {
                        router.goTo(.misGimnasios)
                    }
                }

                LudusButton(title: "Cerrar sesión", variant: .ghost) {
                    Task {
                        await viewModel.signOut()
                        router.goToLogin()
                    }
                }
            }
            .padding(24)
        }
        .background(theme.palette.canvas.ignoresSafeArea())
        .task { await viewModel.refresh() }
    }

    private var gymLabel: String {
        if let name = viewModel.gymName { return "Gimnasio: \(name)" }
        if viewModel.activeGymId != nil { return "Gimnasio activo" }
        return "Sin gimnasio vinculado"
    }

    private var occupancyLabel: String {
        guard let occupancy = viewModel.occupancy else { return "Aforo no disponible" }
        return "\(occupancy.current) de \(occupancy.capacity) personas"
    }
}

private struct QuickAction: View {
    @Environment(ThemeStore.self) private var theme
    let title: String
    let systemImage: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 10) {
                Image(systemName: systemImage)
                    .font(.system(size: 26))
                    .foregroundStyle(theme.palette.volt)
                Text(title)
                    .font(.ludusTitle(14))
                    .foregroundStyle(theme.palette.ink)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity, minHeight: 110)
            .padding(12)
            .background(theme.palette.surface, in: RoundedRectangle(cornerRadius: 18))
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(theme.palette.hairline, lineWidth: 1))
        }
        .frame(minHeight: 110)
    }
}
