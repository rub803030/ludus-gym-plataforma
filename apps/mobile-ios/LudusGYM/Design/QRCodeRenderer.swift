import CoreImage
import UIKit

/// Genera el QR localmente a partir del token YA FIRMADO por el servidor.
/// No se crea ni se modifica ninguna firma en el dispositivo.
enum QRCodeRenderer {
    static func image(from token: String, points: CGFloat = 260) -> UIImage? {
        guard let data = token.data(using: .utf8),
              let filter = CIFilter(name: "CIQRCodeGenerator") else { return nil }
        filter.setValue(data, forKey: "inputMessage")
        filter.setValue("M", forKey: "inputCorrectionLevel")
        guard let output = filter.outputImage else { return nil }

        let scale = max(1, Int(ceil(points / output.extent.width)))
        let transformed = output.transformed(
            by: CGAffineTransform(scaleX: CGFloat(scale), y: CGFloat(scale))
        )
        return UIImage(ciImage: transformed)
    }
}
