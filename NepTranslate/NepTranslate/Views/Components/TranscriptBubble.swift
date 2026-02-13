import SwiftUI

/// A single translation entry in the scrolling transcript.
/// Shows speaker label, source text (dimmed), and translated text (prominent).
struct TranscriptBubble: View {
    let entry: TranscriptEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            // Speaker label + timestamp
            HStack {
                Text(entry.speaker)
                    .font(.caption.bold())
                    .foregroundStyle(.blue)

                Spacer()

                Text(entry.timestamp, style: .time)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }

            // Original text
            Text(entry.sourceText)
                .font(.subheadline)
                .foregroundStyle(.secondary)

            // Translated text
            Text(entry.translatedText)
                .font(.body)
        }
        .padding(12)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}
