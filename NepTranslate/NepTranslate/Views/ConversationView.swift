import SwiftUI

/// Conversation Mode — two devices, one speaker each.
///
/// Hub phone:   captures local mic (speaker2) + receives remote audio (speaker1).
/// Remote phone: streams mic audio to hub, displays received translations.
///
/// In MVP, two iPhones stand in for two pairs of smart glasses.
/// Speaker labels are deterministic: hub mic = speaker2, remote mic = speaker1.
struct ConversationView: View {
    @Environment(AppState.self) private var appState
    @StateObject private var multipeer = MultipeerManager()
    @StateObject private var audioEngine = AudioEngine()

    @State private var isHub = true

    var body: some View {
        VStack(spacing: 0) {

            // Connection status
            ConnectionBadge(status: multipeer.connectionStatus)
                .padding(.top, 8)

            // Role selector
            Picker("Role", selection: $isHub) {
                Text("Hub (Edge Compute)").tag(true)
                Text("Remote (Mic Only)").tag(false)
            }
            .pickerStyle(.segmented)
            .padding()

            Divider()

            // Transcript
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 8) {
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
        .navigationTitle("Conversation")
        .navigationBarTitleDisplayMode(.inline)
        .onDisappear {
            stopAll()
        }
    }

    // MARK: - Actions

    private func toggleListening() {
        if appState.isListening {
            stopAll()
        } else {
            startAll()
        }
    }

    private func startAll() {
        do {
            try audioEngine.configure()
            try audioEngine.start()

            if isHub {
                multipeer.startAsHub()
            } else {
                multipeer.startAsRemote()
            }

            appState.isListening = true
        } catch {
            print("ConversationView: failed to start — \(error)")
        }
    }

    private func stopAll() {
        audioEngine.stop()
        multipeer.stop()
        appState.isListening = false
    }
}
