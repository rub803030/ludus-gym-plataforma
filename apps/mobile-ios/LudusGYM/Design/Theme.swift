import SwiftUI

enum ThemeMode: String, Codable {
    case system
    case dark
    case light

    var label: String {
        switch self {
        case .system: return "Tema del sistema"
        case .dark: return "Tema oscuro"
        case .light: return "Tema claro"
        }
    }
}

struct Palette {
    let canvas: Color
    let surface: Color
    let raised: Color
    let ink: Color
    let muted: Color
    let volt: Color
    let ignition: Color
    let emerald: Color
    let hairline: Color

    static let moon = Palette(
        canvas: Color(hex: "#0D0F12"),
        surface: Color(hex: "#16191E"),
        raised: Color(hex: "#1F242D"),
        ink: Color(hex: "#E2E2E6"),
        muted: Color(hex: "#94A3B8"),
        volt: Color(hex: "#CCFF00"),
        ignition: Color(hex: "#FF5500"),
        emerald: Color(hex: "#10B981"),
        hairline: Color.white.opacity(0.08)
    )

    static let sun = Palette(
        canvas: Color(hex: "#F6F5F2"),
        surface: Color(hex: "#ECEAE4"),
        raised: Color(hex: "#FFFFFF"),
        ink: Color(hex: "#181816"),
        muted: Color(hex: "#5E5D58"),
        volt: Color(hex: "#B8E600"),
        ignition: Color(hex: "#FF5500"),
        emerald: Color(hex: "#10B981"),
        hairline: Color(hex: "#181816").opacity(0.14)
    )
}

/// Selección luna/sol. La preferencia se guarda en UserDefaults (no es secreto)
/// con la misma clave que la web: `ludus-theme`.
@Observable
@MainActor
final class ThemeStore {
    @MainActor static let shared = ThemeStore()

    private(set) var mode: ThemeMode
    private(set) var systemIsDark = true

    init() {
        let stored = UserDefaults.standard.string(forKey: "ludus-theme")
        switch stored {
        case "dark": mode = .dark
        case "light": mode = .light
        default: mode = .system
        }
    }

    var isDark: Bool {
        mode == .system ? systemIsDark : mode == .dark
    }

    var palette: Palette { isDark ? .moon : .sun }

    func apply(colorScheme: ColorScheme) {
        systemIsDark = (colorScheme == .dark)
    }

    func setMode(_ newMode: ThemeMode) {
        mode = newMode
        UserDefaults.standard.set(
            newMode == .system ? nil : (newMode == .dark ? "dark" : "light"),
            forKey: "ludus-theme"
        )
    }

    func toggle() {
        setMode(isDark ? .light : .dark)
    }
}

extension Color {
    init(hex: String) {
        let clean = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        guard clean.count == 6,
              let value = Int(clean, radix: 16) else {
            self = .primary
            return
        }
        self.init(
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255
        )
    }
}

extension Font {
    /// Montserrat 800 con tracking -0.03em. Si la fuente no está instalada,
    /// SwiftUI usa la fuente del sistema con el mismo peso.
    static func ludusDisplay(_ size: CGFloat) -> Font {
        .system(size: size, weight: .heavy, design: .default)
    }

    static func ludusTitle(_ size: CGFloat) -> Font {
        .system(size: size, weight: .bold, design: .default)
    }

    static func ludusBody(_ size: CGFloat = 16) -> Font {
        .system(size: size, weight: .regular, design: .default)
    }
}
