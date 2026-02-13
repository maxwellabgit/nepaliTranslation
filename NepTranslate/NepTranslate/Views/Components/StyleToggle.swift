import SwiftUI

/// Formal / Informal Nepali style toggle.
/// For MVP both styles map to the same base OPUS-MT model.
/// When fine-tuned models are ready, the toggle will automatically
/// select the correct model via TranslationManager.
struct StyleToggle: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        @Bindable var state = appState

        Picker("Style", selection: $state.formalityStyle) {
            ForEach(FormalityStyle.allCases, id: \.self) { style in
                Text(style.rawValue).tag(style)
            }
        }
        .pickerStyle(.segmented)
        .frame(maxWidth: 200)
    }
}
