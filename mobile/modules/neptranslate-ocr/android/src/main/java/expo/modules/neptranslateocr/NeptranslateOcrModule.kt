package expo.modules.neptranslateocr

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import com.google.mlkit.vision.text.devanagari.DevanagariTextRecognizerOptions
import android.net.Uri

class NeptranslateOcrModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NeptranslateOcr")

    AsyncFunction("recognize") { uri: String ->
      val context = appContext.reactContext ?: throw Exception("Camera OCR is unavailable.")
      val image = InputImage.fromFilePath(context, Uri.parse(uri))
      val latin = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
      val deva = TextRecognition.getClient(DevanagariTextRecognizerOptions.Builder().build())
      val latinText = com.google.android.gms.tasks.Tasks.await(latin.process(image))
      val devaText = com.google.android.gms.tasks.Tasks.await(deva.process(image))
      mapOf(
        "width" to image.width,
        "height" to image.height,
        "rotation" to image.rotationDegrees,
        "blocks" to (blocks(latinText, "en") + blocks(devaText, "ne"))
      )
    }
  }

  private fun blocks(text: com.google.mlkit.vision.text.Text, language: String): List<Map<String, Any>> {
    return text.textBlocks.map { block ->
      mapOf(
        "text" to block.text,
        "language" to language,
        "confidence" to 0.9,
        "frame" to frame(block.boundingBox),
        "cornerPoints" to points(block.cornerPoints),
        "lines" to block.lines.map { line ->
          mapOf(
            "text" to line.text,
            "confidence" to 0.9,
            "frame" to frame(line.boundingBox),
            "cornerPoints" to points(line.cornerPoints)
          )
        }
      )
    }
  }

  private fun frame(box: android.graphics.Rect?): Map<String, Int> {
    val rect = box ?: android.graphics.Rect()
    return mapOf(
      "x" to rect.left,
      "y" to rect.top,
      "width" to rect.width(),
      "height" to rect.height()
    )
  }

  private fun points(points: Array<android.graphics.Point>?): List<Map<String, Int>> {
    return (points ?: emptyArray()).map { mapOf("x" to it.x, "y" to it.y) }
  }
}
