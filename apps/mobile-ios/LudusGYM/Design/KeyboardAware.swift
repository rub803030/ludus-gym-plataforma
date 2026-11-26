import SwiftUI
import UIKit

/// Mantiene visibles los campos y botones cuando aparece el teclado.
/// Permite descartarlo deslizando o pulsando "Listo" en la barra del teclado.
struct KeyboardAwareModifier: ViewModifier {
    @State private var keyboardHeight: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .padding(.bottom, keyboardHeight)
            .scrollDismissesKeyboard(.interactively)
            .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { notification in
                guard let frame = notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect else { return }
                withAnimation(.easeOut(duration: 0.2)) {
                    keyboardHeight = frame.height
                }
            }
            .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
                withAnimation(.easeOut(duration: 0.2)) {
                    keyboardHeight = 0
                }
            }
            .toolbar {
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Listo") {
                        UIApplication.shared.sendAction(
                            #selector(UIResponder.resignFirstResponder),
                            to: nil,
                            from: nil,
                            for: nil
                        )
                    }
                }
            }
    }
}

extension View {
    func keyboardAware() -> some View {
        modifier(KeyboardAwareModifier())
    }

    /// Vincula un campo con un `@FocusState` y le asigna una identidad estable
    /// para que `ScrollViewReader` pueda desplazarse hasta él al recibir el foco.
    func focusedField<Field: Hashable>(
        _ field: Field,
        focus: FocusState<Field?>.Binding
    ) -> some View {
        self
            .focused(focus, equals: field)
            .id(field)
    }
}
