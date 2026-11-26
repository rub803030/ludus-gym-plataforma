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
        // Módulos #0D0F12 sobre blanco. CIQRCodeGenerator produce negro (L=0)
        // y blanco (L=1): se interpola cada canal con `L` para no teñir el fondo.
        let red = 13.0 / 255
        let green = 15.0 / 255
        let blue = 18.0 / 255
        let parameters: [String: Any] = [
            "inputImage": transformed,
            "inputRVector": CIVector(x: 1 - red, y: 0, z: 0, w: 0),
            "inputGVector": CIVector(x: 0, y: 1 - green, z: 0, w: 0),
            "inputBVector": CIVector(x: 0, y: 0, z: 1 - blue, w: 0),
            "inputAVector": CIVector(x: 0, y: 0, z: 0, w: 1),
            "inputBiasVector": CIVector(x: red, y: green, z: blue, w: 0)
        ]
        guard let tinted = CIFilter(name: "CIColorMatrix", parameters: parameters)?.outputImage else {
            return UIImage(ciImage: transformed)
        }
        return UIImage(ciImage: tinted)
    }
}
