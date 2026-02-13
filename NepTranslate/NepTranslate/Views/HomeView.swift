import SwiftUI

/// Root screen — pick Conversation or Ambient mode.
struct HomeView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        NavigationStack {
            VStack(spacing: 32) {

                // Title
                VStack(spacing: 8) {
                    Text("NepTranslate")
                        .font(.largeTitle.bold())
                    Text("Nepali ↔ English · On-Device")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(.top, 40)

                Spacer()

                // Mode cards
                VStack(spacing: 16) {
                    NavigationLink {
                        ConversationView()
                    } label: {
                        ModeCard(
                            title: "Conversation",
                            description: "Two devices, one speaker each. No diarization needed.",
                            systemImage: "person.2.fill"
                        )
                    }

                    NavigationLink {
                        AmbientView()
                    } label: {
                        ModeCard(
                            title: "Ambient",
                            description: "Single device captures all audio. Automatic speaker separation.",
                            systemImage: "waveform.circle.fill"
                        )
                    }
                }
                .padding(.horizontal)

                Spacer()

                // Global style toggle
                VStack(spacing: 12) {
                    StyleToggle()
                }
                .padding(.horizontal)
                .padding(.bottom, 32)
            }
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

// MARK: - Mode Card

private struct ModeCard: View {
    let title: String
    let description: String
    let systemImage: String

    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: systemImage)
                .font(.title)
                .frame(width: 50)

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                Text(description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.leading)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .foregroundStyle(.secondary)
        }
        .padding()
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}
