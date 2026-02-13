import SwiftUI

/// Compact status indicator for Multipeer Connectivity state.
struct ConnectionBadge: View {
    let status: ConnectionStatus

    private var color: Color {
        switch status {
        case .connected:    .green
        case .searching:    .orange
        case .disconnected: .red
        }
    }

    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(color)
                .frame(width: 8, height: 8)

            Text(status.rawValue)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(.ultraThinMaterial)
        .clipShape(Capsule())
    }
}
