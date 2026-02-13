import SwiftUI

// MARK: - Enums

enum AppMode: String, CaseIterable {
    case conversation = "Conversation"
    case ambient = "Ambient"
}

enum TranslationDirection: String, CaseIterable {
    case nepaliToEnglish = "NE → EN"
    case englishToNepali = "EN → NE"
}

enum FormalityStyle: String, CaseIterable {
    case formal = "Formal"
    case informal = "Informal"
}

enum ConnectionStatus: String {
    case disconnected = "Disconnected"
    case searching = "Searching…"
    case connected = "Connected"
}

// MARK: - Data Model

struct TranscriptEntry: Identifiable {
    let id = UUID()
    let speaker: String
    let sourceText: String
    let translatedText: String
    let timestamp: Date
    let direction: TranslationDirection
}

// MARK: - App State

@Observable
final class AppState {
    var currentMode: AppMode = .conversation
    var translationDirection: TranslationDirection = .nepaliToEnglish
    var formalityStyle: FormalityStyle = .formal
    var isListening: Bool = false
    var transcriptEntries: [TranscriptEntry] = []
    var connectionStatus: ConnectionStatus = .disconnected
    var audioLevel: Float = 0.0
    var isSpeechDetected: Bool = false

    func addEntry(speaker: String, source: String, translated: String, direction: TranslationDirection) {
        let entry = TranscriptEntry(
            speaker: speaker,
            sourceText: source,
            translatedText: translated,
            timestamp: Date(),
            direction: direction
        )
        transcriptEntries.append(entry)
    }

    func clearTranscript() {
        transcriptEntries.removeAll()
    }
}
