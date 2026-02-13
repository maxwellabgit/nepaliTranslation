import Foundation
import AVFoundation

/// Wraps whisper.cpp for on-device speech-to-text.
///
/// Integration steps (once in Xcode on a Mac):
/// 1. Add whisper.cpp SPM package: https://github.com/ggerganov/whisper.cpp
/// 2. Bundle the Whisper small GGML model in Resources/Models/
/// 3. Uncomment the whisper C API calls below.
///
/// The placeholder returns a marker string so the full pipeline can be tested
/// before the actual model is integrated.
final class WhisperManager {

    private var context: OpaquePointer?   // whisper_context pointer
    private let queue = DispatchQueue(label: "com.neptranslate.whisper", qos: .userInitiated)

    var isLoaded: Bool { context != nil }

    // MARK: - Model Lifecycle

    /// Load a GGML Whisper model from disk.
    /// - Parameter path: Absolute path to the .bin model file.
    func loadModel(path: String) throws {
        // TODO: Uncomment when whisper.cpp SPM is added in Xcode
        // var params = whisper_context_default_params()
        // params.use_gpu = true
        // context = whisper_init_from_file_with_params(path, params)
        // guard context != nil else { throw WhisperError.modelLoadFailed }
    }

    /// Load the bundled model from the app's Resources/Models directory.
    func loadBundledModel(named name: String = "ggml-small") throws {
        guard let url = Bundle.main.url(forResource: name, withExtension: "bin") else {
            throw WhisperError.modelNotFound
        }
        try loadModel(path: url.path)
    }

    func unload() {
        // whisper_free(context)
        context = nil
    }

    deinit { unload() }

    // MARK: - Transcription

    /// Transcribe a speech segment (array of PCM buffers from VAD) into text.
    /// - Parameters:
    ///   - buffers: Audio buffers captured during one speech segment.
    ///   - language: ISO 639-1 code ("ne" for Nepali, "en" for English, "auto" to detect).
    /// - Returns: Transcribed text.
    func transcribe(buffers: [AVAudioPCMBuffer], language: String = "auto") async throws -> String {
        let samples = Self.concatenateBuffers(buffers)
        guard !samples.isEmpty else { return "" }

        return try await withCheckedThrowingContinuation { continuation in
            queue.async { [weak self] in
                guard self != nil else {
                    continuation.resume(throwing: WhisperError.modelNotLoaded)
                    return
                }

                // TODO: Uncomment when whisper.cpp SPM is added
                // var params = whisper_full_default_params(WHISPER_SAMPLING_GREEDY)
                // if language != "auto" {
                //     params.language = (language as NSString).utf8String
                // }
                // params.n_threads = 4
                // params.no_timestamps = true
                //
                // samples.withUnsafeBufferPointer { ptr in
                //     let result = whisper_full(self!.context, params, ptr.baseAddress, Int32(samples.count))
                //     if result != 0 {
                //         continuation.resume(throwing: WhisperError.transcriptionFailed)
                //         return
                //     }
                // }
                //
                // let segmentCount = whisper_full_n_segments(self!.context)
                // var text = ""
                // for i in 0..<segmentCount {
                //     if let cStr = whisper_full_get_segment_text(self!.context, i) {
                //         text += String(cString: cStr)
                //     }
                // }
                // continuation.resume(returning: text.trimmingCharacters(in: .whitespacesAndNewlines))

                // Placeholder until model is integrated
                continuation.resume(returning: "[STT placeholder — \(samples.count) samples]")
            }
        }
    }

    // MARK: - Helpers

    /// Merge multiple PCM buffers into a single contiguous Float array.
    static func concatenateBuffers(_ buffers: [AVAudioPCMBuffer]) -> [Float] {
        var samples: [Float] = []
        for buffer in buffers {
            guard let data = buffer.floatChannelData?[0] else { continue }
            let count = Int(buffer.frameLength)
            samples.append(contentsOf: UnsafeBufferPointer(start: data, count: count))
        }
        return samples
    }
}

// MARK: - Errors

enum WhisperError: LocalizedError {
    case modelNotFound
    case modelLoadFailed
    case modelNotLoaded
    case transcriptionFailed

    var errorDescription: String? {
        switch self {
        case .modelNotFound:       return "Whisper model file not found in bundle"
        case .modelLoadFailed:     return "Failed to initialize Whisper context"
        case .modelNotLoaded:      return "Whisper model is not loaded"
        case .transcriptionFailed: return "Whisper transcription failed"
        }
    }
}
