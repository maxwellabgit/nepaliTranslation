import AVFoundation

/// Energy-based Voice Activity Detection with smoothing.
/// Segments mic audio into speech chunks separated by silence.
/// Each complete speech segment is emitted via `onSpeechSegment`.
final class VADProcessor {

    // MARK: - Configuration

    /// RMS energy above this threshold counts as speech.
    var energyThreshold: Float = 0.012

    /// Consecutive above-threshold frames required to trigger speech onset.
    var onsetFrames: Int = 3

    /// Consecutive below-threshold frames required to trigger speech offset.
    var offsetFrames: Int = 15

    // MARK: - State

    private(set) var isSpeaking = false
    private var aboveCount = 0
    private var belowCount = 0
    private var speechBuffers: [AVAudioPCMBuffer] = []

    // MARK: - Callbacks

    /// Emitted when a complete speech segment (onset → offset) is captured.
    var onSpeechSegment: (([AVAudioPCMBuffer]) -> Void)?

    /// Emitted when speech state changes (started / stopped).
    var onSpeechStateChanged: ((Bool) -> Void)?

    // MARK: - Processing

    func process(buffer: AVAudioPCMBuffer) {
        let energy = rmsEnergy(of: buffer)

        if energy > energyThreshold {
            aboveCount += 1
            belowCount = 0

            if !isSpeaking && aboveCount >= onsetFrames {
                isSpeaking = true
                onSpeechStateChanged?(true)
            }

            if isSpeaking {
                speechBuffers.append(buffer)
            }
        } else {
            belowCount += 1
            aboveCount = 0

            if isSpeaking {
                speechBuffers.append(buffer) // keep trailing silence for natural phrasing

                if belowCount >= offsetFrames {
                    isSpeaking = false
                    onSpeechStateChanged?(false)

                    let segment = speechBuffers
                    speechBuffers.removeAll()
                    onSpeechSegment?(segment)
                }
            }
        }
    }

    func reset() {
        isSpeaking = false
        aboveCount = 0
        belowCount = 0
        speechBuffers.removeAll()
    }

    // MARK: - Helpers

    private func rmsEnergy(of buffer: AVAudioPCMBuffer) -> Float {
        guard let data = buffer.floatChannelData?[0] else { return 0 }
        let count = Int(buffer.frameLength)
        guard count > 0 else { return 0 }

        var sum: Float = 0
        for i in 0..<count { sum += data[i] * data[i] }
        return sqrtf(sum / Float(count))
    }
}
