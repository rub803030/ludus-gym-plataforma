import SwiftUI

struct LoginView: View {
    @Environment(AppRouter.self) private var router
    @Environment(ThemeStore.self) private var theme
    @State private var viewModel = LoginViewModel()
    @FocusState private var focus: Field?

    private enum Field: Hashable {
        case email, password
    }

    var body: some View {
        ScrollView {
            ScrollViewReader { proxy in
                VStack(alignment: .leading, spacing: 20) {
                    Text("Ludus.")
                        .font(.ludusDisplay(44))
                        .kerning(-0.03 * 44)
                        .foregroundStyle(theme.palette.volt)

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Acceso de socios")
                            .font(.ludusDisplay(30))
                            .kerning(-0.03 * 30)
                            .foregroundStyle(theme.palette.ink)
                        Text("Solo socios activos. El equipo opera desde la consola web.")
                            .font(.ludusBody(14))
                            .foregroundStyle(theme.palette.muted)
                    }

                    LudusTextField(
                        title: "Correo",
                        placeholder: "socio@ludusgym.com",
                        text: $viewModel.email,
                        keyboard: .emailAddress,
                        autocapitalization: .never,
                        submitLabel: .next,
                        onSubmit: { focus = .password }
                    )
                    .focusedField(Field.email, focus: $focus)

                    VStack(alignment: .leading, spacing: 6) {
                        LudusTextField(
                            title: "Contraseña",
                            placeholder: "Contraseña",
                            text: $viewModel.password,
                            isSecure: !viewModel.passwordVisible,
                            submitLabel: .done,
                            onSubmit: { focus = nil }
                        )
                        .focusedField(Field.password, focus: $focus)
                        Button(action: { viewModel.passwordVisible.toggle() }) {
                            Text(viewModel.passwordVisible ? "Ocultar" : "Ver")
                                .font(.ludusTitle(13))
                                .frame(minHeight: 48)
                        }
                        .foregroundStyle(theme.palette.volt)
                    }

                    if let error = viewModel.errorMessage {
                        Text(error)
                            .font(.ludusBody(14))
                            .foregroundStyle(theme.palette.ignition)
                    }

                    LudusButton(title: "Entrar", isLoading: viewModel.isLoading) {
                        Task {
                            if let member = await viewModel.submit() {
                                if (member.activeGymId?.isEmpty ?? true) && SecureStore.activeGymId == nil {
                                    router.replace(with: .vincularGimnasio)
                                } else {
                                    router.goHome(name: member.name)
                                }
                            }
                        }
                    }

                    LudusButton(title: "Crear cuenta", variant: .secondary) {
                        router.goTo(.registro)
                    }

                    LudusButton(title: "Registrar mi gimnasio", variant: .ghost) {
                        router.goTo(.registroGimnasio)
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
        .safeAreaInset(edge: .top) {
            HStack {
                Spacer()
                ThemeToggleButton()
            }
            .padding(.horizontal, 16)
        }
        .keyboardAware()
    }
}

struct RegisterView: View {
    @Environment(AppRouter.self) private var router
    @Environment(ThemeStore.self) private var theme
    @State private var viewModel = RegisterViewModel()
    @FocusState private var focus: Field?

    private enum Field: Hashable {
        case firstName, lastName, email, password, phone, documentNumber, birthDate
    }

    var body: some View {
        ScrollView {
            ScrollViewReader { proxy in
                VStack(alignment: .leading, spacing: 18) {
                    LudusScreenHeader(
                        title: "Crear cuenta de socio",
                        subtitle: "Después de confirmar tu correo podrás vincular tu gimnasio.",
                        showsBack: true,
                        back: { router.back() }
                    )

                    LudusTextField(
                        title: "Nombre",
                        placeholder: "Luis",
                        text: $viewModel.firstName,
                        submitLabel: .next,
                        onSubmit: { focus = .lastName }
                    )
                    .focusedField(Field.firstName, focus: $focus)

                    LudusTextField(
                        title: "Apellidos",
                        placeholder: "Pérez",
                        text: $viewModel.lastName,
                        submitLabel: .next,
                        onSubmit: { focus = .email }
                    )
                    .focusedField(Field.lastName, focus: $focus)

                    LudusTextField(
                        title: "Correo",
                        placeholder: "luis@example.com",
                        text: $viewModel.email,
                        keyboard: .emailAddress,
                        submitLabel: .next,
                        onSubmit: { focus = .password }
                    )
                    .focusedField(Field.email, focus: $focus)

                    LudusTextField(
                        title: "Contraseña (mínimo 12 caracteres)",
                        placeholder: "ClaveSegura2026!",
                        text: $viewModel.password,
                        isSecure: !viewModel.passwordVisible,
                        submitLabel: .next,
                        onSubmit: { focus = .phone }
                    )
                    .focusedField(Field.password, focus: $focus)

                    Button(action: { viewModel.passwordVisible.toggle() }) {
                        Text(viewModel.passwordVisible ? "Ocultar" : "Ver")
                            .font(.ludusTitle(13))
                            .frame(minHeight: 48)
                    }
                    .foregroundStyle(theme.palette.volt)

                    LudusTextField(
                        title: "Teléfono (opcional)",
                        placeholder: "5512345678",
                        text: $viewModel.phone,
                        keyboard: .numberPad,
                        submitLabel: .next,
                        onSubmit: { focus = .documentNumber }
                    )
                    .focusedField(Field.phone, focus: $focus)

                    LudusTextField(
                        title: "Documento (opcional)",
                        placeholder: "ABC123456",
                        text: $viewModel.documentNumber,
                        submitLabel: .next,
                        onSubmit: { focus = .birthDate }
                    )
                    .focusedField(Field.documentNumber, focus: $focus)

                    LudusTextField(
                        title: "Nacimiento AAAA-MM-DD (opcional)",
                        placeholder: "1995-04-10",
                        text: $viewModel.birthDate,
                        submitLabel: .done,
                        onSubmit: { focus = nil }
                    )
                    .focusedField(Field.birthDate, focus: $focus)

                    if let error = viewModel.errorMessage {
                        Text(error)
                            .font(.ludusBody(14))
                            .foregroundStyle(theme.palette.ignition)
                    }

                    LudusButton(title: "Crear cuenta", isLoading: viewModel.isLoading) {
                        Task {
                            if let info = await viewModel.submit() {
                                router.verificationEmail = info.email
                                router.devLink = info.devLink
                                router.replace(with: .verificacion(token: info.devToken))
                            }
                        }
                    }

                    LudusButton(title: "Registrar un gimnasio", variant: .secondary) {
                        router.goTo(.registroGimnasio)
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
}

struct VerifyEmailView: View {
    @Environment(AppRouter.self) private var router
    @Environment(ThemeStore.self) private var theme
    @State private var viewModel: VerifyEmailViewModel
    @FocusState private var focus: Field?

    private enum Field: Hashable { case code }

    let token: String?
    let email: String?

    init(token: String?, email: String?) {
        self.token = token
        self.email = email
        _viewModel = State(initialValue: VerifyEmailViewModel(token: token, email: email))
    }

    var body: some View {
        ScrollView {
            ScrollViewReader { proxy in
                VStack(alignment: .leading, spacing: 18) {
                    LudusScreenHeader(
                        title: "Verificación de correo",
                        subtitle: "Ir a iniciar sesión",
                        showsBack: true,
                        back: { router.replace(with: .login) }
                    )

                    Text("Tu correo no está verificado. Confirma el enlace para poder entrar.")
                        .font(.ludusBody(15))
                        .foregroundStyle(theme.palette.muted)

                    LudusTextField(
                        title: "Pega aquí el enlace o código",
                        placeholder: "Pega aquí el enlace o código",
                        text: $viewModel.code,
                        autocapitalization: .never,
                        submitLabel: .done,
                        onSubmit: { focus = nil }
                    )
                    .focusedField(Field.code, focus: $focus)

                    if let message = viewModel.message {
                        Text(message)
                            .font(.ludusBody(14))
                            .foregroundStyle(theme.palette.volt)
                    }

                    LudusButton(title: "Verificar correo", isLoading: viewModel.isLoading) {
                        Task {
                            if await viewModel.verify() {
                                router.verificationEmail = viewModel.email
                                router.replace(with: .login)
                            }
                        }
                    }

                    LudusButton(title: "Reenviar", variant: .secondary) {
                        Task { await viewModel.resend() }
                    }

                    if let devLink = viewModel.devLink ?? router.devLink,
                       let url = URL(string: devLink) {
                        Link("Abrir web", destination: url)
                            .font(.ludusTitle(15))
                            .foregroundStyle(theme.palette.volt)
                            .frame(minHeight: 48)
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
        .task { viewModel.prepare() }
        .keyboardAware()
    }
}
