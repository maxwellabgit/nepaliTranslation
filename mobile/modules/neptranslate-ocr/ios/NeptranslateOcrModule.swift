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
            let image = UIImage(data: data) else {
        promise.reject("empty", "The capture had no readable image.")
        return
      }
      let vision = VisionImage(image: image)
      vision.orientation = image.imageOrientation
      let latin = TextRecognizer.textRecognizer()
      let devanagari = TextRecognizer.textRecognizer(options: DevanagariTextRecognizerOptions())
      latin.process(vision) { latinResult, latinError in
        if let latinError {
          promise.reject("ocr", latinError.localizedDescription)
          return
        }
        devanagari.process(vision) { devaResult, devaError in
          if let devaError {
            promise.reject("ocr", devaError.localizedDescription)
            return
          }
          let blocks = Self.blocks(from: latinResult) + Self.blocks(from: devaResult, language: "ne")
          promise.resolve([
            "width": image.size.width,
            "height": image.size.height,
            "rotation": 0,
            "blocks": blocks,
          ])
        }
      }
    }
  }

  private static func blocks(from result: Text?, language: String = "en") -> [[String: Any]] {
    guard let result else { return [] }
    return result.blocks.map { block in
      [
        "text": block.text,
        "language": language,
        "confidence": 0.9,
        "frame": frame(block.frame),
        "cornerPoints": points(block.cornerPoints),
        "lines": block.lines.map { line in
          [
            "text": line.text,
            "confidence": 0.9,
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
