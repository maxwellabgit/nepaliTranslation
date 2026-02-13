import Foundation
import AVFoundation
import CoreML

/// Extracts speaker embedding vectors from audio segments using ECAPA-TDNN (CoreML).
///
/// Each VAD speech segment is converted to a fixed-length embedding vector.
/// These embeddings are then fed to `SpeakerClusterer` to assign speaker labels.
final class EmbeddingExtractor {

    private var model: MLModel?

    /// Standard ECAPA-TDNN embedding dimension.
    let embeddingDimension = 192

    var isLoaded: Bool { model != nil }

    // MARK: - Model Lifecycle

    func loadModel() throws {
        let config = MLModelConfiguration()
        config.computeUnits = .cpuAndNeuralEngine

        // TODO: Uncomment when ECAPA-TDNN CoreML model is converted and bundled
        // guard let url = Bundle.main.url(forResource: "ecapa_tdnn", withExtension: "mlmodelc") else {
        //     throw EmbeddingError.modelNotFound
        // }
        // model = try MLModel(contentsOf: url, configuration: config)
    }

    func unload() {
        model = nil
    }

    // MARK: - Extraction

    /// Extract a speaker embedding from a speech segment.
    /// - Parameter buffers: PCM audio buffers from one VAD speech segment.
    /// - Returns: Float array of length `embeddingDimension`.
    func extractEmbedding(from buffers: [AVAudioPCMBuffer]) async throws -> [Float] {
        let samples = WhisperManager.concatenateBuffers(buffers)
        guard !samples.isEmpty else {
            return Array(repeating: 0, count: embeddingDimension)
        }

        // TODO: Implement when CoreML model is available
        // 1. Compute mel spectrogram from PCM samples (80-band, 25ms window, 10ms hop)
        // 2. Create MLMultiArray with mel features
        // 3. Run model.prediction()
        // 4. Read embedding vector from output

        // Placeholder: return a deterministic-ish vector based on audio energy
        // so clustering can at least be exercised during testing
        var embedding = Array(repeating: Float(0), count: embeddingDimension)
        let energy = samples.reduce(Float(0)) { $0 + $1 * $1 } / Float(samples.count)
        for i in 0..<embeddingDimension {
            embedding[i] = sin(Float(i) * energy * 1000)
        }
        return embedding
    }
}

// MARK: - Errors

enum EmbeddingError: LocalizedError {
    case modelNotFound
    case extractionFailed

    var errorDescription: String? {
        switch self {
        case .modelNotFound:     return "ECAPA-TDNN model not found in bundle"
        case .extractionFailed:  return "Speaker embedding extraction failed"
        }
    }
}
