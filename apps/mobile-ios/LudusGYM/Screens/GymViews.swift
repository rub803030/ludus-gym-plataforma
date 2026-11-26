import AVFoundation
import SwiftUI

struct LinkGymView: View {
    @Environment(AppRouter.self) private var router
    @Environment(ThemeStore.self) private var theme
    @State private var viewModel = LinkGymViewModel()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                LudusScreenHeader(
                    title: "Vincular gimnasio",
                    subtitle: "Ir al inicio",
                    showsBack: true,
                    back: { router.back() }
                )

                Text("Escribe el código LUDUS-XXXX o escanea el QR del gimnasio")
                    .font(.ludusBody(14))
                    .foregroundStyle(theme.palette.muted)

                LudusTextField(
                    title: "Código del gimnasio",
                    placeholder: "LUDUS-A7K2",
                    text: $viewModel.code,
                    autocapitalization: .allCharacters
                )

                if let error = viewModel.errorMessage {
                    Text(error)
                        .font(.ludusBody(14))
                        .foregroundStyle(theme.palette.ignition)
                }
                if let message = viewModel.message {
                    Text(message)
                        .font(.ludusBody(14))
                        .foregroundStyle(theme.palette.emerald)
                }

                LudusButton(title: "Vincularme", isLoading: viewModel.isLoading) {
                    Task {
                        if await viewModel.submit() { router.goHome() }
                    }
                }

                LudusButton(title: "Escanear QR del gimnasio", variant: .secondary) {
                    router.goTo(.escanearQRGimnasio)
                }

                LudusButton(title: "Mis gimnasios", variant: .ghost) {
                    router.goTo(.misGimnasios)
                }
            }
            .padding(24)
        }
        .background(theme.palette.canvas.ignoresSafeArea())
    }
}

struct GymQrScannerView: View {
    @Environment(AppRouter.self) private var router
    @Environment(ThemeStore.self) private var theme
    @State private var viewModel = LinkGymViewModel()
    @State private var status = AVCaptureDevice.authorizationStatus(for: .video)

    var body: some View {
        VStack(spacing: 16) {
            LudusScreenHeader(
                title: "Escanear QR del gimnasio",
                subtitle: "Apunta al QR estático del gimnasio",
                showsBack: true,
                back: { router.back() }
            )

            Text("El código se valida en el servidor antes de vincularte")
                .font(.ludusBody(13))
                .foregroundStyle(theme.palette.muted)

            switch status {
            case .authorized:
                QRScannerRepresentable { raw in
                    viewModel.message = "QR leído. Vinculando con el gimnasio…"
                    Task {
                        if await viewModel.onScanned(raw) { router.goHome() }
                    }
                }
                .frame(maxWidth: .infinity, minHeight: 320)
                .clipShape(RoundedRectangle(cornerRadius: 18))
                .overlay(RoundedRectangle(cornerRadius: 18).stroke(theme.palette.hairline, lineWidth: 1))
            case .notDetermined:
                ProgressView("Solicitando cámara…")
                    .frame(maxWidth: .infinity, minHeight: 320)
            case .denied, .restricted:
                VStack(spacing: 12) {
                    Text("Necesitamos permiso de cámara para leer el QR.")
                        .foregroundStyle(theme.palette.muted)
                    LudusButton(title: "Conceder permiso", variant: .secondary) {
                        if let url = URL(string: UIApplication.openSettingsURLString) {
                            UIApplication.shared.open(url)
                        }
                    }
                    LudusButton(title: "Escribir código manualmente", variant: .ghost) {
                        router.back()
                    }
                }
                .frame(maxWidth: .infinity, minHeight: 320)
            @unknown default:
                Text("La cámara no está disponible en este dispositivo.")
                    .foregroundStyle(theme.palette.ignition)
            }

            if let error = viewModel.errorMessage {
                Text(error)
                    .font(.ludusBody(14))
                    .foregroundStyle(theme.palette.ignition)
            }
            if let message = viewModel.message {
                Text(message)
                    .font(.ludusBody(14))
                    .foregroundStyle(theme.palette.volt)
            }

            Spacer(minLength: 0)
        }
        .padding(24)
        .background(theme.palette.canvas.ignoresSafeArea())
        .task {
            if status == .notDetermined {
                let granted = await AVCaptureDevice.requestAccess(for: .video)
                status = granted ? .authorized : .denied
            }
        }
    }
}

struct QRScannerRepresentable: UIViewRepresentable {
    let onScanned: (String) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onScanned: onScanned)
    }

    func makeUIView(context: Context) -> UIView {
        let container = UIView()
        let session = context.coordinator.session

        guard let device = AVCaptureDevice.default(for: .video),
              let input = try? AVCaptureDeviceInput(device: device),
              session.canAddInput(input) else { return container }
        session.addInput(input)

        let output = AVCaptureMetadataOutput()
        if session.canAddOutput(output) {
            session.addOutput(output)
            output.setMetadataObjectsDelegate(context.coordinator, queue: .main)
            output.metadataObjectTypes = [.qr]
        }

        let preview = AVCaptureVideoPreviewLayer(session: session)
        preview.videoGravity = .resizeAspectFill
        preview.frame = container.bounds
        container.layer.addSublayer(preview)
        context.coordinator.previewLayer = preview

        DispatchQueue.global(qos: .userInitiated).async {
            if !session.isRunning { session.startRunning() }
        }
        return container
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        context.coordinator.previewLayer?.frame = uiView.bounds
    }

    static func dismantleUIView(_ uiView: UIView, coordinator: Coordinator) {
        coordinator.stop()
    }

    final class Coordinator: NSObject, AVCaptureMetadataOutputObjectsDelegate {
        let session = AVCaptureSession()
        var previewLayer: AVCaptureVideoPreviewLayer?
        private let onScanned: (String) -> Void
        private var lastValue: String?
        private var lastDate = Date()

        init(onScanned: @escaping (String) -> Void) {
            self.onScanned = onScanned
        }

        func metadataOutput(
            _ output: AVCaptureMetadataOutput,
            didOutput metadataObjects: [AVMetadataObject],
            from connection: AVCaptureConnection
        ) {
            guard let object = metadataObjects.first as? AVMetadataMachineReadableCodeObject,
                  let value = object.stringValue else { return }
            if value == lastValue, Date().timeIntervalSince(lastDate) < 2 { return }
            lastValue = value
            lastDate = Date()
            onScanned(value)
        }

        func stop() {
            if session.isRunning { session.stopRunning() }
        }
    }
}

struct MyGymsView: View {
    @Environment(AppRouter.self) private var router
    @Environment(ThemeStore.self) private var theme
    @State private var viewModel = MyGymsViewModel()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                LudusScreenHeader(
                    title: "Mis gimnasios",
                    subtitle: "Cambia de gimnasio activo cuando lo necesites",
                    showsBack: true,
                    back: { router.back() }
                )

                HStack {
                    Spacer()
                    Button(action: { Task { await viewModel.refresh() } }) {
                        Text(viewModel.isLoading ? "Actualizando…" : "Actualizar")
                            .font(.ludusTitle(14))
                    }
                    .frame(minHeight: 48)
                    .foregroundStyle(theme.palette.volt)
                }

                if viewModel.gyms.isEmpty && !viewModel.isLoading {
                    EmptyState(
                        title: "Todavía no tienes gimnasios",
                        message: "Vincula uno con su código o con el QR de inscripción.",
                        actionTitle: "Vincular gimnasio",
                        action: { router.goTo(.vincularGimnasio) }
                    )
                } else {
                    ForEach(viewModel.gyms) { gym in
                        LudusCard {
                            Text(gym.displayName)
                                .font(.ludusTitle(18))
                                .foregroundStyle(theme.palette.ink)
                            Text("Código: \(gym.publicCode ?? "—")")
                                .font(.ludusBody(13))
                                .foregroundStyle(theme.palette.muted)
                            StatusPill(
                                text: gym.id == viewModel.activeGymId ? "Gimnasio activo" : "Disponible",
                                tone: gym.id == viewModel.activeGymId ? .emerald : .muted
                            )
                            if gym.id != viewModel.activeGymId {
                                LudusButton(
                                    title: viewModel.switchingGymId == gym.id ? "Cambiando…" : "Usar este gimnasio",
                                    variant: .secondary,
                                    isLoading: viewModel.switchingGymId == gym.id
                                ) {
                                    Task {
                                        if await viewModel.switchGym(gym) { router.goHome() }
                                    }
                                }
                            }
                        }
                    }
                }

                if let error = viewModel.errorMessage {
                    Text(error)
                        .font(.ludusBody(14))
                        .foregroundStyle(theme.palette.ignition)
                }
                if let message = viewModel.message {
                    Text(message)
                        .font(.ludusBody(14))
                        .foregroundStyle(theme.palette.emerald)
                }

                LudusButton(title: "Vincular otro gimnasio", variant: .ghost) {
                    router.goTo(.vincularGimnasio)
                }
            }
            .padding(24)
        }
        .background(theme.palette.canvas.ignoresSafeArea())
        .task { await viewModel.refresh() }
    }
}
