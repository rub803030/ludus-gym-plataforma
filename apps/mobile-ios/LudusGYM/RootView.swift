import SwiftUI

struct RootView: View {
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.scenePhase) private var scenePhase
    @State private var router = AppRouter()
    private let theme = ThemeStore.shared

    var body: some View {
        NavigationStack(path: $router.path) {
            Color.clear
                .frame(width: 0, height: 0)
                .navigationDestination(for: AppRouter.Route.self) { route in
                    destination(for: route)
                }
        }
        .environment(router)
        .environment(theme)
        .task { theme.apply(colorScheme: colorScheme) }
        .onChange(of: colorScheme) { _, newValue in
            theme.apply(colorScheme: newValue)
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                Task { await SyncCoordinator.syncPending() }
            }
        }
        .onOpenURL { url in
            router.handleDeepLink(url)
        }
    }

    @ViewBuilder
    private func destination(for route: AppRouter.Route) -> some View {
        switch route {
        case .login:
            LoginView()
        case .registro:
            RegisterView()
        case .verificacion(let token):
            VerifyEmailView(token: token, email: router.verificationEmail)
        case .vincularGimnasio:
            LinkGymView()
        case .escanearQRGimnasio:
            GymQrScannerView()
        case .misGimnasios:
            MyGymsView()
        case .home(let memberId, let name):
            HomeView(memberId: memberId, name: name)
        case .qr:
            QrView()
        case .workout:
            WorkoutView()
        case .nutrition:
            NutritionView()
        case .bookings:
            BookingsView()
        }
    }
}
