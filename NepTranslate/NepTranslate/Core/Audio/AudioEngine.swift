import AVFoundation
import Combine

/// Wraps AVAudioEngine with iOS voice-processing mode.
/// Voice-processing activates the iPhone's multi-mic beamforming, echo cancellation,
/// and noise suppression — critical for isolating close-talk speech in noisy environments.
final class AudioEngine: ObservableObject {
    private let engine = AVAudioEngine()
    private let audioSession = AVAudioSession.sharedInstance()

    @Published var audioLevel: Float = 0.0
    @Published var isRunning: Bool = false

    /// Called for every audio buffer captured from the mic.
    /// Buffer format: 16 kHz, mono, Float32 (what Whisper expects).
    var onAudioBuffer: ((AVAudioPCMBuffer, AVAudioTime) -> Void)?

    /// Target format for the processing pipeline.
    private let processingFormat: AVAudioFormat = {
        AVAudioFormat(
            commonFormat: .pcmFormatFloat32,
            sampleRate: 16_000,
            channels: 1,
            interleaved: false
        )!
    }()

    // MARK: - Lifecycle

    /// Configure the audio session for voice chat (enables beamforming).
    func configure() throws {
        try audioSession.setCategory(
            .playAndRecord,
            mode: .voiceChat,
            options: [.defaultToSpeaker, .allowBluetooth]
        )
        try audioSession.setActive(true)
    }

    /// Start capturing audio from the mic.
    func start() throws {
        let inputNode = engine.inputNode
        let inputFormat = inputNode.outputFormat(forBus: 0)

        inputNode.installTap(onBus: 0, bufferSize: 1024, format: inputFormat) { [weak self] buffer, time in
            guard let self else { return }
            self.updateAudioLevel(buffer: buffer)

            if let converted = self.convert(buffer, from: inputFormat) {
                self.onAudioBuffer?(converted, time)
            }
        }

        engine.prepare()
        try engine.start()
        isRunning = true
    }

    /// Stop capturing audio.
    func stop() {
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        isRunning = false
        DispatchQueue.main.async { self.audioLevel = 0.0 }
    }

    // MARK: - Private

    private func updateAudioLevel(buffer: AVAudioPCMBuffer) {
        guard let data = buffer.floatChannelData?[0] else { return }
        let count = Int(buffer.frameLength)
        guard count > 0 else { return }

        var sum: Float = 0
        for i in 0..<count { sum += data[i] * data[i] }
        let rms = sqrtf(sum / Float(count))

        DispatchQueue.main.async { self.audioLevel = rms }
    }

    private func convert(_ buffer: AVAudioPCMBuffer, from source: AVAudioFormat) -> AVAudioPCMBuffer? {
        if source == processingFormat { return buffer }

        guard let converter = AVAudioConverter(from: source, to: processingFormat) else { return nil }

        let ratio = processingFormat.sampleRate / source.sampleRate
        let capacity = AVAudioFrameCount(Double(buffer.frameLength) * ratio)
        guard let output = AVAudioPCMBuffer(pcmFormat: processingFormat, frameCapacity: capacity) else { return nil }

        var error: NSError?
        converter.convert(to: output, error: &error) { _, outStatus in
            outStatus.pointee = .haveData
            return buffer
        }

        return error == nil ? output : nil
    }
}
