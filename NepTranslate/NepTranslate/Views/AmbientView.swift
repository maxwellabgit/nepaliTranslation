import SwiftUI

/// Ambient Mode — single device captures all surrounding audio.
///
/// Audio is segmented by VAD, each segment gets a speaker embedding via ECAPA-TDNN,
/// then assigned a speaker label via online clustering, transcribed, translated,
/// and displayed with the speaker label.
///
/// Direction (N→E or E→N) is chosen manually by the user.
struct AmbientView: View {
    @Environment(AppState.self) private var appState
    @StateObject private var audioEngine = AudioEngine()

    var body: some View {
        @Bindable var state = appState

        VStack(spacing: 0) {

            // Direction picker
            Picker("Direction", selection: $state.translationDirection) {
                ForEach(TranslationDirection.allCases, id: \.self) { dir in
                    Text(dir.rawValue).tag(dir)
                }
            }
            .pickerStyle(.segmented)
            .padding()

            Divider()

            // Transcript with speaker labels
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 8) {
                        ForEach(appState.transcriptEntries) { entry in
                            TranscriptBubble(entry: entry)
                                .id(entry.id)
                        }
                    }
                    .padding()
                }
                .onChange(of: appState.transcriptEntries.count) {
                    if let last = appState.transcriptEntries.last {
                        withAnimation {
                            proxy.scrollTo(last.id, anchor: .bottom)
                        }
                    }
                }
            }

            Divider()

            // Controls
            HStack(spacing: 24) {
                AudioLevelIndicator(level: audioEngine.audioLevel)

                Button {
                    toggleListening()
                } label: {
                    Image(systemName: appState.isListening ? "stop.circle.fill" : "mic.circle.fill")
                        .font(.system(size: 56))
                        .foregroundStyle(appState.isListening ? .red : .blue)
                }

                StyleToggle()
            }
            .padding()
        }
        .navigationTitle("Ambient")
        .navigationBarTitleDisplayMode(.inline)
        .onDisappear {
            audioEngine.stop()
            appState.isListening = false
        }
    }

    // MARK: - Actions

    private func toggleListening() {
        if appState.isListening {
            audioEngine.stop()
            appState.isListening = false
        } else {
            do {
                try audioEngine.configure()
                try audioEngine.start()
                appState.isListening = true
            } catch {
                print("AmbientView: failed to start — \(error)")
            }
        }
    }
}
