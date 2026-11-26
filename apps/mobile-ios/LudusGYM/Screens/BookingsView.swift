import SwiftUI

struct BookingsView: View {
    @Environment(AppRouter.self) private var router
    @Environment(ThemeStore.self) private var theme
    @State private var viewModel = BookingViewModel()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                LudusScreenHeader(
                    title: "Reservas",
                    subtitle: "Clases y comprobantes",
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

                SectionHeader(title: "Próximas clases")

                if viewModel.classes.isEmpty {
                    EmptyState(
                        title: "Sin clases disponibles",
                        message: "Toca Actualizar para cargar el horario.",
                        actionTitle: "Actualizar",
                        action: { Task { await viewModel.refresh() } }
                    )
                } else {
                    ForEach(viewModel.classes) { item in
                        LudusCard {
                            Text(item.title)
                                .font(.ludusTitle(18))
                                .foregroundStyle(theme.palette.ink)
                            Text("\(item.startAt) · \(item.durationMinutes) min · \(item.coach)")
                                .font(.ludusBody(13))
                                .foregroundStyle(theme.palette.muted)
                            Text("\(item.spotsLeft) plazas libres")
                                .font(.ludusBody(13))
                                .foregroundStyle(theme.palette.muted)
                            if item.isBooked {
                                StatusPill(text: "Reservada", tone: .emerald)
                            }
                            LudusButton(
                                title: item.isBooked ? "Cancelar reserva" : "Reservar plaza",
                                variant: item.isBooked ? .secondary : .primary,
                                isLoading: viewModel.busyClassId == item.id
                            ) {
                                if item.isBooked {
                                    viewModel.requestCancel(item)
                                } else {
                                    viewModel.requestBook(item)
                                }
                            }
                        }
                    }
                }

                SectionHeader(title: "Comprobantes")
                LudusButton(
                    title: viewModel.showReceipts ? "Ocultar" : "Ver recibos",
                    variant: .ghost
                ) {
                    viewModel.showReceipts.toggle()
                }

                if viewModel.showReceipts {
                    if viewModel.receipts.isEmpty {
                        EmptyState(
                            title: "Sin comprobantes",
                            message: "Todavía no hay pagos registrados."
                        )
                    } else {
                        ForEach(viewModel.receipts) { receipt in
                            LudusCard {
                                HStack {
                                    Text(receipt.concept)
                                        .font(.ludusTitle(15))
                                        .foregroundStyle(theme.palette.ink)
                                    Spacer()
                                    Text(receipt.amountLabel)
                                        .font(.ludusTitle(15))
                                        .monospacedDigit()
                                        .foregroundStyle(theme.palette.volt)
                                }
                                Text("\(receipt.date) · \(receipt.status)")
                                    .font(.ludusBody(12))
                                    .foregroundStyle(theme.palette.muted)
                            }
                        }
                    }
                }

                if let message = viewModel.message {
                    Text(message)
                        .font(.ludusBody(14))
                        .foregroundStyle(theme.palette.volt)
                        .task {
                            try? await Task.sleep(nanoseconds: 4_000_000_000)
                            viewModel.consumeMessage()
                        }
                }

                LudusButton(title: "Volver", variant: .ghost) { router.back() }
            }
            .padding(24)
        }
        .background(theme.palette.canvas.ignoresSafeArea())
        .task { await viewModel.refresh() }
        .confirmationDialog(
            viewModel.confirmationFor?.isBooked == true ? "Cancelar reserva" : "Reservar plaza",
            isPresented: Binding(
                get: { viewModel.confirmationFor != nil },
                set: { if !$0 { viewModel.confirmationFor = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Confirmar") {
                Task { await viewModel.confirm() }
            }
            Button("Volver", role: .cancel) {
                viewModel.confirmationFor = nil
            }
        } message: {
            if let item = viewModel.confirmationFor {
                Text("\(item.title) · \(item.startAt)")
            }
        }
    }
}
