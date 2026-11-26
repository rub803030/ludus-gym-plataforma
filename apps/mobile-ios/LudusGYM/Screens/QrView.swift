import SwiftUI

struct QrView: View {
    @Environment(AppRouter.self) private var router
    @Environment(ThemeStore.self) private var theme
    @State private var viewModel = QrViewModel()

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                LudusScreenHeader(
                    title: "Mi pase QR",
                    subtitle: "Muestra este código en el torniquete. Se renueva automáticamente.",
                    showsBack: true,
                    back: { router.back() }
                )

                if !viewModel.didLoadGyms {
                    LudusCard {
                        ProgressView("Generando pase…")
                            .frame(maxWidth: .infinity, minHeight: 260)
                    }
                } else if !viewModel.hasGym {
                    LudusCard {
                        Text("Unase a algun gimnasio para tener acceso")
                            .font(.ludusBody(15))
                            .foregroundStyle(theme.palette.ink)
                        LudusButton(title: "Vincular gimnasio", variant: .secondary) {
                            router.replace(with: .vincularGimnasio)
                        }
                    }
                } else if let ticket = viewModel.ticket {
                    LudusCard {
                        HStack {
                            StatusPill(
                                text: ticket.offline ? "SIN CONEXIÓN · pase firmado guardado" : "EN LÍNEA · pase dinámico",
                                tone: ticket.offline ? .ignition : .emerald
                            )
                            Spacer()
                            Text("\(ticket.secondsRemaining(now: viewModel.now)) s")
                                .font(.ludusTitle(16))
                                .monospacedDigit()
                                .foregroundStyle(theme.palette.volt)
                        }

                        Text(ticket.offline
                             ? "Válido unos \(ticket.secondsRemaining(now: viewModel.now)) segundos más"
                             : "Se renueva en \(ticket.secondsRemaining(now: viewModel.now)) s")
                            .font(.ludusBody(13))
                            .foregroundStyle(theme.palette.muted)

                        if let name = viewModel.gymName {
                            Text("Gimnasio: \(name)")
                                .font(.ludusBody(14))
                                .foregroundStyle(theme.palette.ink)
                        } else {
                            Text(viewModel.activeGymId == nil ? "Sin gimnasio vinculado" : "Gimnasio activo")
                                .font(.ludusBody(14))
                                .foregroundStyle(theme.palette.muted)
                        }

                        if let image = QRCodeRenderer.image(from: ticket.token) {
                            Image(uiImage: image)
                                .interpolation(.none)
                                .resizable()
                                .scaledToFit()
                                .frame(width: 260, height: 260)
                                .padding(14)
                                .background(Color.white, in: RoundedRectangle(cornerRadius: 12))
                                .accessibilityLabel("Código QR de acceso")
                                .frame(maxWidth: .infinity)
                        } else {
                            ProgressView("Generando pase…")
                                .frame(height: 260)
                        }
                    }
                } else {
                    LudusCard {
                        ProgressView("Generando pase…")
                            .frame(maxWidth: .infinity, minHeight: 260)
                    }
                }

                if let message = viewModel.message {
                    Text(message)
                        .font(.ludusBody(14))
                        .foregroundStyle(theme.palette.ignition)
                }

                LudusButton(title: "Actualizar pase", variant: .secondary) {
                    Task { await viewModel.refresh() }
                }

                LudusButton(title: viewModel.copied ? "Código copiado" : "Copiar código", variant: .secondary) {
                    viewModel.copyCode()
                }

                LudusButton(title: "Mis gimnasios", variant: .ghost) {
                    router.goTo(.misGimnasios)
                }

                LudusButton(title: "Volver", variant: .ghost) {
                    router.back()
                }
            }
            .padding(24)
        }
        .background(theme.palette.canvas.ignoresSafeArea())
        .task { viewModel.start() }
        .onDisappear { viewModel.stop() }
    }
}
