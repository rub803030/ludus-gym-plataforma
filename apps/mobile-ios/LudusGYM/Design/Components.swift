import SwiftUI

enum LudusButtonVariant {
    case primary, secondary, ghost
}

struct LudusButton: View {
    @Environment(ThemeStore.self) private var theme

    let title: String
    var variant: LudusButtonVariant = .primary
    var isLoading = false
    var isEnabled = true
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if isLoading {
                    ProgressView()
                        .tint(foreground)
                }
                Text(isLoading ? "Procesando…" : title)
                    .font(.ludusTitle(16))
                    .frame(maxWidth: .infinity)
            }
            .frame(maxWidth: .infinity, minHeight: 56)
            .padding(.horizontal, 16)
            .background(background, in: RoundedRectangle(cornerRadius: 16))
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(border, lineWidth: 1)
            )
            .contentShape(Rectangle())
        }
        .disabled(isLoading || !isEnabled)
        .opacity(isEnabled ? 1 : 0.5)
        .accessibilityLabel(title)
    }

    private var background: Color {
        switch variant {
        case .primary: return theme.palette.volt
        case .secondary: return theme.palette.raised
        case .ghost: return Color.clear
        }
    }

    private var foreground: Color {
        switch variant {
        case .primary: return Color(hex: "#101214")
        case .secondary: return theme.palette.ink
        case .ghost: return theme.palette.volt
        }
    }

    private var border: Color {
        variant == .secondary ? theme.palette.hairline : Color.clear
    }
}

struct LudusCard<Content: View>: View {
    @Environment(ThemeStore.self) private var theme
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .background(theme.palette.surface, in: RoundedRectangle(cornerRadius: 18))
        .overlay(
            RoundedRectangle(cornerRadius: 18)
                .stroke(theme.palette.hairline, lineWidth: 1)
        )
    }
}

enum PillTone {
    case volt, emerald, ignition, muted

    func color(_ palette: Palette) -> Color {
        switch self {
        case .volt: return palette.volt
        case .emerald: return palette.emerald
        case .ignition: return palette.ignition
        case .muted: return palette.muted
        }
    }
}

struct StatusPill: View {
    @Environment(ThemeStore.self) private var theme
    let text: String
    var tone: PillTone = .volt

    var body: some View {
        Text(text)
            .font(.ludusTitle(12))
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(tone.color(theme.palette).opacity(0.14), in: Capsule())
            .overlay(Capsule().stroke(tone.color(theme.palette).opacity(0.35), lineWidth: 1))
            .foregroundStyle(tone.color(theme.palette))
            .frame(minHeight: 32)
    }
}

struct SectionHeader: View {
    let title: String
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        HStack {
            Text(title)
                .font(.ludusTitle(18))
            Spacer(minLength: 8)
            if let actionTitle, let action {
                Button(action: action) {
                    Text(actionTitle)
                        .font(.ludusTitle(14))
                }
                .frame(minHeight: 48)
            }
        }
    }
}

struct EmptyState: View {
    @Environment(ThemeStore.self) private var theme
    let title: String
    let message: String
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: "dumbbell.fill")
                .font(.system(size: 34))
                .foregroundStyle(theme.palette.muted)
            Text(title)
                .font(.ludusTitle(17))
            Text(message)
                .font(.ludusBody(14))
                .foregroundStyle(theme.palette.muted)
                .multilineTextAlignment(.center)
            if let actionTitle, let action {
                LudusButton(title: actionTitle, variant: .secondary, action: action)
                    .padding(.top, 8)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 28)
    }
}

struct LudusTextField: View {
    @Environment(ThemeStore.self) private var theme
    let title: String
    let placeholder: String
    @Binding var text: String
    var isSecure = false
    var keyboard: UIKeyboardType = .default
    var autocapitalization: UITextAutocapitalizationType = .none
    var submitLabel: SubmitLabel = .done
    var onSubmit: (() -> Void)? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.ludusTitle(13))
                .foregroundStyle(theme.palette.muted)
            Group {
                if isSecure {
                    SecureField(placeholder, text: $text)
                } else {
                    TextField(placeholder, text: $text)
                        .keyboardType(keyboard)
                        .textInputAutocapitalization(autocapitalization)
                }
            }
            .submitLabel(submitLabel)
            .onSubmit { onSubmit?() }
            .font(.ludusBody(16))
            .foregroundStyle(theme.palette.ink)
            .padding(.horizontal, 14)
            .frame(minHeight: 52)
            .background(theme.palette.raised, in: RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(theme.palette.hairline, lineWidth: 1)
            )
        }
    }
}

struct LudusScreenHeader: View {
    @Environment(ThemeStore.self) private var theme
    let title: String
    var subtitle: String?
    var showsBack = false
    var back: (() -> Void)?
    var trailing: AnyView?

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            if showsBack {
                Button(action: { back?() }) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 20, weight: .semibold))
                        .frame(width: 48, height: 48)
                        .foregroundStyle(theme.palette.ink)
                        .accessibilityLabel("Volver")
                }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.ludusDisplay(32))
                    .kerning(-0.03 * 32)
                    .foregroundStyle(theme.palette.ink)
                if let subtitle {
                    Text(subtitle)
                        .font(.ludusBody(14))
                        .foregroundStyle(theme.palette.muted)
                }
            }
            Spacer(minLength: 0)
            if let trailing {
                trailing
            }
        }
        .padding(.bottom, 8)
    }
}

struct ThemeToggleButton: View {
    @Environment(ThemeStore.self) private var theme

    var body: some View {
        Button(action: { theme.toggle() }) {
            Image(systemName: theme.isDark ? "moon.fill" : "sun.max.fill")
                .font(.system(size: 18))
                .frame(width: 48, height: 48)
                .foregroundStyle(theme.palette.volt)
                .accessibilityLabel(theme.mode.label)
        }
        .frame(minWidth: 48, minHeight: 48)
    }
}
