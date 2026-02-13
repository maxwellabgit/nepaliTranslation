import Foundation
import CoreML

/// Wraps OPUS-MT CoreML models for on-device Nepali ↔ English translation.
///
/// Three model slots:
///   - ne → en  (one model)
///   - en → ne  formal   (MVP: same base model as informal)
///   - en → ne  informal (MVP: same base model as formal)
///
/// The formal/informal toggle is wired in the UI now; when fine-tuned models
/// are ready, drop them into Resources/Models/ and they'll be picked up
/// automatically — no pipeline changes needed.
final class TranslationManager {

    private var neToEnModel: MLModel?
    private var enToNeFormalModel: MLModel?
    private var enToNeInformalModel: MLModel?

    var isLoaded: Bool {
        neToEnModel != nil && enToNeFormalModel != nil
    }

    // MARK: - Model Lifecycle

    /// Load all translation models from the app bundle.
    func loadModels() throws {
        let config = MLModelConfiguration()
        config.computeUnits = .cpuAndNeuralEngine

        // TODO: Uncomment when CoreML models are converted and added to the bundle
        // guard let neEnURL = Bundle.main.url(forResource: "opus_mt_ne_en", withExtension: "mlmodelc"),
        //       let enNeFormalURL = Bundle.main.url(forResource: "opus_mt_en_ne_formal", withExtension: "mlmodelc"),
        //       let enNeInformalURL = Bundle.main.url(forResource: "opus_mt_en_ne_informal", withExtension: "mlmodelc")
        // else { throw TranslationError.modelNotFound }
        //
        // neToEnModel = try MLModel(contentsOf: neEnURL, configuration: config)
        // enToNeFormalModel = try MLModel(contentsOf: enNeFormalURL, configuration: config)
        // enToNeInformalModel = try MLModel(contentsOf: enNeInformalURL, configuration: config)
    }

    func unloadModels() {
        neToEnModel = nil
        enToNeFormalModel = nil
        enToNeInformalModel = nil
    }

    // MARK: - Translation

    /// Translate a string between Nepali and English.
    /// - Parameters:
    ///   - text: Source text to translate.
    ///   - direction: Which way to translate.
    ///   - style: Formal or informal Nepali register (only affects en→ne).
    /// - Returns: Translated text.
    func translate(
        text: String,
        direction: TranslationDirection,
        style: FormalityStyle = .formal
    ) async throws -> String {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return "" }

        // Select model based on direction + style
        // let model: MLModel? = switch direction {
        // case .nepaliToEnglish:
        //     neToEnModel
        // case .englishToNepali:
        //     style == .formal ? enToNeFormalModel : enToNeInformalModel
        // }
        //
        // guard let model else { throw TranslationError.modelNotLoaded }
        //
        // TODO: Implement MarianMT tokenization + CoreML inference
        // 1. Tokenize input using SentencePiece vocabulary
        // 2. Create MLMultiArray with token IDs
        // 3. Run model prediction
        // 4. Decode output token IDs back to text

        // Placeholder until models are converted
        let tag = direction == .nepaliToEnglish ? "ne→en" : "en→ne(\(style.rawValue))"
        return "[\(tag) placeholder] \(text)"
    }
}

// MARK: - Errors

enum TranslationError: LocalizedError {
    case modelNotFound
    case modelNotLoaded
    case translationFailed

    var errorDescription: String? {
        switch self {
        case .modelNotFound:       return "Translation model not found in bundle"
        case .modelNotLoaded:      return "Translation model is not loaded"
        case .translationFailed:   return "Translation inference failed"
        }
    }
}
