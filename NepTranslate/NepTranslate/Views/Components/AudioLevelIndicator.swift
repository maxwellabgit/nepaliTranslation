import SwiftUI

/// Vertical bar that reflects real-time mic input level.
struct AudioLevelIndicator: View {
    let level: Float

    var body: some View {
        RoundedRectangle(cornerRadius: 4)
            .fill(.green.opacity(Double(min(level * 10, 1.0))))
            .frame(width: 8, height: 40)
            .animation(.easeOut(duration: 0.1), value: level)
    }
}
