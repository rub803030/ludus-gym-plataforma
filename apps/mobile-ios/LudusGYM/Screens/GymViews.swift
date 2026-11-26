import AVFoundation
import SwiftUI

struct LinkGymView: View {
    @Environment(AppRouter.self) private var router
    @Environment(ThemeStore.self) private var theme
    @State private var viewModel = LinkGymViewModel()
    @FocusState private var focus: Field?

    private enum Field: Hashable { case code }

    var body: some View {
        ScrollView {
            ScrollViewReader { proxy in
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
                        autocapitalization: .allCharacters,
                        submitLabel: .done,
                        onSubmit: { focus = nil }
                    )
                    .focusedField(Field.code, focus: $focus)

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
                .onChange(of: focus) { _, newValue in
                    guard let newValue else { return }
                    withAnimation(.easeOut(duration: 0.2)) {
                        proxy.scrollTo(newValue, anchor: .center)
                    }
                }
            }
        }
        .background(theme.palette.canvas.ignoresSafeArea())
        .keyboardAware()
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

/// Registro público de gimnasios: no pide sesión ni comprueba el rol del socio.
struct RegisterGymView: View {
    @Environment(AppRouter.self) private var router
    @Environment(ThemeStore.self) private var theme
    @State private var viewModel = RegisterGymViewModel()
    @FocusState private var focus: Field?

    private enum Field: Hashable {
        case gymName, slug, ownerName, email, password, contactEmail, phone, address,
             city, state, postalCode, legalRepresentative, rfc, website, socialMedia,
             description, branchCount, timezone, capacity, openingHours
    }

    var body: some View {
        ScrollView {
            ScrollViewReader { proxy in
                VStack(alignment: .leading, spacing: 18) {
                    LudusScreenHeader(
                        title: "Registrar gimnasio",
                        subtitle: "Necesitas la autorización de un administrador",
                        showsBack: true,
                        back: { router.back() }
                    )

                    if let info = viewModel.success {
                        successView(info)
                    } else {
                        formFields

                        if let error = viewModel.errorMessage {
                            Text(error)
                                .font(.ludusBody(14))
                                .foregroundStyle(theme.palette.ignition)
                        }

                        LudusButton(title: "Enviar registro", isLoading: viewModel.isLoading) {
                            Task { await viewModel.submit() }
                        }
                    }

                    LudusButton(title: "Volver al inicio de sesión", variant: .ghost) {
                        router.replace(with: .login)
                    }
                }
                .padding(24)
                .onChange(of: focus) { _, newValue in
                    guard let newValue else { return }
                    withAnimation(.easeOut(duration: 0.2)) {
                        proxy.scrollTo(newValue, anchor: .center)
                    }
                }
            }
        }
        .background(theme.palette.canvas.ignoresSafeArea())
        .keyboardAware()
    }

    private var formFields: some View {
        VStack(alignment: .leading, spacing: 18) {
            Group {
                sectionTitle("Datos del gimnasio")
                field("Nombre del gimnasio", placeholder: "Ludus Norte", text: $viewModel.gymName,
                      field: .gymName, next: .slug)
                field("Identificador (opcional)", placeholder: "ludus-norte", text: $viewModel.slug,
                      field: .slug, next: .description, autocapitalization: .never)
                field("Descripción (opcional)", placeholder: "Qué ofrece tu gimnasio", text: $viewModel.description,
                      field: .description, next: .website)
                field("Sitio web (opcional)", placeholder: "https://ludusgym.com", text: $viewModel.website,
                      field: .website, next: .socialMedia, keyboard: .URL, autocapitalization: .never)
                field("Redes sociales (opcional)", placeholder: "@ludusgym", text: $viewModel.socialMedia,
                      field: .socialMedia, next: .branchCount, autocapitalization: .never)
                field("Número de sucursales (opcional)", placeholder: "1", text: $viewModel.branchCount,
                      field: .branchCount, next: .timezone, keyboard: .numberPad)
                field("Zona horaria (opcional)", placeholder: "America/Mexico_City", text: $viewModel.timezone,
                      field: .timezone, next: .capacity, autocapitalization: .never)
                field("Capacidad (opcional)", placeholder: "150", text: $viewModel.capacity,
                      field: .capacity, next: .openingHours, keyboard: .numberPad)
                field("Horario (opcional)", placeholder: "Lun–Vie 06:00–22:00", text: $viewModel.openingHours,
                      field: .openingHours, next: .ownerName)
            }

            Group {
                sectionTitle("Propietario y contacto")
                field("Nombre del propietario", placeholder: "María Pérez", text: $viewModel.ownerName,
                      field: .ownerName, next: .email)
                field("Correo de acceso", placeholder: "dueno@ludusgym.com", text: $viewModel.email,
                      field: .email, next: .password, keyboard: .emailAddress, autocapitalization: .never)
                field("Contraseña (mínimo 12 caracteres)", placeholder: "ClaveSegura2026!",
                      text: $viewModel.password, field: .password, next: .contactEmail,
                      secure: !viewModel.passwordVisible)
                Button(action: { viewModel.passwordVisible.toggle() }) {
                    Text(viewModel.passwordVisible ? "Ocultar" : "Ver")
                        .font(.ludusTitle(13))
                        .frame(minHeight: 48)
                }
                .foregroundStyle(theme.palette.volt)
                field("Correo de contacto", placeholder: "contacto@ludusgym.com", text: $viewModel.contactEmail,
                      field: .contactEmail, next: .phone, keyboard: .emailAddress, autocapitalization: .never)
                field("Teléfono", placeholder: "5512345678", text: $viewModel.phone,
                      field: .phone, next: .address, keyboard: .phonePad)
                field("Dirección", placeholder: "Av. Insurgentes 123, Roma Norte", text: $viewModel.address,
                      field: .address, next: .city)
                field("Ciudad", placeholder: "Ciudad de México", text: $viewModel.city,
                      field: .city, next: .state)
            }

            Group {
                field("Estado", placeholder: "CDMX", text: $viewModel.state,
                      field: .state, next: .postalCode)
                field("Código postal", placeholder: "06700", text: $viewModel.postalCode,
                      field: .postalCode, next: .legalRepresentative, keyboard: .numberPad)

                sectionTitle("Representante legal")
                field("Representante legal", placeholder: "María Pérez", text: $viewModel.legalRepresentative,
                      field: .legalRepresentative, next: .rfc)
                field("RFC", placeholder: "PEPM900101ABC", text: $viewModel.rfc,
                      field: .rfc, autocapitalization: .allCharacters)

                sectionTitle("Configuración")
                Text("Moneda: MXN")
                    .font(.ludusBody(14))
                    .foregroundStyle(theme.palette.muted)
            }
        }
    }

    @ViewBuilder
    private func sectionTitle(_ title: String) -> some View {
        Text(title)
            .font(.ludusTitle(17))
            .foregroundStyle(theme.palette.volt)
            .padding(.top, 6)
    }

    @ViewBuilder
    private func field(
        _ title: String,
        placeholder: String,
        text: Binding<String>,
        field: Field,
        next: Field? = nil,
        keyboard: UIKeyboardType = .default,
        autocapitalization: UITextAutocapitalizationType = .none,
        secure: Bool = false
    ) -> some View {
        LudusTextField(
            title: title,
            placeholder: placeholder,
            text: text,
            isSecure: secure,
            keyboard: keyboard,
            autocapitalization: autocapitalization,
            submitLabel: next == nil ? .done : .next,
            onSubmit: {
                if let next { focus = next } else { focus = nil }
            }
        )
        .focusedField(field, focus: $focus)
    }

    @ViewBuilder
    private func successView(_ info: GymRegistrationInfo) -> some View {
        LudusCard {
            Text("Registro recibido. Confirma tu correo y espera la autorización de un administrador.")
                .font(.ludusTitle(18))
                .foregroundStyle(theme.palette.ink)
            Text("Gimnasio: \(info.gymName)")
                .font(.ludusBody(14))
                .foregroundStyle(theme.palette.muted)
            if let email = info.ownerEmail {
                Text("Propietario: \(email)")
                    .font(.ludusBody(14))
                    .foregroundStyle(theme.palette.muted)
            }
            if let email = info.verificationEmail {
                Text("Verificación enviada a: \(email)")
                    .font(.ludusBody(14))
                    .foregroundStyle(theme.palette.muted)
            }
            if let expiresAt = info.verificationExpiresAt {
                Text("Vence: \(expiresAt)")
                    .font(.ludusBody(13))
                    .foregroundStyle(theme.palette.muted)
            }
            if let email = info.approvalEmail {
                Text("Autorización: \(email)")
                    .font(.ludusBody(14))
                    .foregroundStyle(theme.palette.muted)
            }
            if let link = info.verificationDevLink, let url = URL(string: link) {
                Link("Abrir enlace de verificación", destination: url)
                    .font(.ludusTitle(15))
                    .foregroundStyle(theme.palette.volt)
                    .frame(minHeight: 48)
            }
            if let link = info.approvalDevLink, let url = URL(string: link) {
                Link("Abrir enlace de autorización", destination: url)
                    .font(.ludusTitle(15))
                    .foregroundStyle(theme.palette.volt)
                    .frame(minHeight: 48)
            }
        }

        LudusButton(title: "Registrar otro gimnasio", variant: .secondary) {
            viewModel.reset()
        }
    }
}
