import ExpoModulesCore
import MLKitTextRecognition
import MLKitTextRecognitionDevanagari
import MLKitVision

public class NeptranslateOcrModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NeptranslateOcr")

    AsyncFunction("recognize") { (uri: String, promise: Promise) in
      guard let url = URL(string: uri),
            let data = try? Data(contentsOf: url),
            let source = UIImage(data: data) else {
        promise.reject("empty", "The capture had no readable image.")
        return
      }
      // Phone cameras store portrait shots sideways and set EXIF.
      // ML Kit still returns boxes in that sensor space, which the preview
      // paints as tall strips beside the text. Draw the oriented bitmap
      // first so recognition and the preview share one upright pixel space.
      let image = Self.upright(source)
      let vision = VisionImage(image: image)
      vision.orientation = image.imageOrientation
      let latin = TextRecognizer.textRecognizer()
      let devanagari = TextRecognizer.textRecognizer(options: DevanagariTextRecognizerOptions())
      // Both scripts run together. Dropping one would miss mixed-script signs.
      let group = DispatchGroup()
      let lock = NSLock()
      var latinText: MLKitTextRecognition.Text?
      var devaText: MLKitTextRecognition.Text?
      var ocrError: Error?
      group.enter()
      latin.process(vision) { result, error in
        lock.lock()
        if ocrError == nil { ocrError = error }
        latinText = result
        lock.unlock()
        group.leave()
      }
      group.enter()
      devanagari.process(vision) { result, error in
        lock.lock()
        if ocrError == nil { ocrError = error }
        devaText = result
        lock.unlock()
        group.leave()
      }
      group.notify(queue: .main) {
        if let ocrError {
          promise.reject("ocr", ocrError.localizedDescription)
          return
        }
        let blocks = Self.blocks(from: latinText) + Self.blocks(from: devaText, language: "ne")
        promise.resolve([
          "width": image.size.width,
          "height": image.size.height,
          "rotation": 0,
          "blocks": blocks,
        ])
      }
    }
  }

  /// Bake EXIF into pixels. The result is `.up` and `size` matches the preview.
  private static func upright(_ image: UIImage) -> UIImage {
    if image.imageOrientation == .up { return image }
    let format = UIGraphicsImageRendererFormat()
    format.scale = image.scale
    format.opaque = true
    let renderer = UIGraphicsImageRenderer(size: image.size, format: format)
    return renderer.image { _ in
      image.draw(in: CGRect(origin: .zero, size: image.size))
    }
  }

  private static func blocks(from result: MLKitTextRecognition.Text?, language: String = "en") -> [[String: Any]] {
    guard let result else { return [] }
    // ML Kit Text Recognition on iOS does not expose confidence; do not invent one.
    return result.blocks.map { block in
      [
        "text": block.text,
        "language": language,
        "confidence": NSNull(),
        "frame": frame(block.frame),
        "cornerPoints": points(block.cornerPoints),
        "lines": block.lines.map { line -> [String: Any] in
          [
            "text": line.text,
            "confidence": NSNull(),
            "frame": frame(line.frame),
            "cornerPoints": points(line.cornerPoints),
          ]
        },
      ]
    }
  }

  private static func frame(_ rect: CGRect) -> [String: Double] {
    [
      "x": rect.origin.x,
      "y": rect.origin.y,
      "width": rect.size.width,
      "height": rect.size.height,
    ]
  }

  private static func points(_ points: [NSValue]) -> [[String: Double]] {
    points.map { value in
      let point = value.cgPointValue
      return ["x": point.x, "y": point.y]
    }
  }
}
