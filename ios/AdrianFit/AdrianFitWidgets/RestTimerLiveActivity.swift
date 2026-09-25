import ActivityKit
import Foundation
import SwiftUI
import WidgetKit

@main
struct AdrianFitWidgets: WidgetBundle {
    var body: some Widget {
        RestTimerLiveActivity()
    }
}

private struct RestTimerLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RestLiveActivityAttributes.self) { context in
            lockScreenView(context: context)
                .activityBackgroundTint(Color.black.opacity(0.94))
                .activitySystemActionForegroundColor(.white)
                .widgetURL(URL(string: "adrianfit://workout"))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label("Descanso", systemImage: "timer")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.orange)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    timerText(context.state)
                        .font(.headline.monospacedDigit())
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.attributes.exerciseName)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            } compactLeading: {
                Image(systemName: "timer")
                    .foregroundStyle(.orange)
            } compactTrailing: {
                timerText(context.state)
                    .font(.caption2.monospacedDigit())
            } minimal: {
                Image(systemName: "timer")
                    .foregroundStyle(.orange)
            }
            .widgetURL(URL(string: "adrianfit://workout"))
            .keylineTint(.orange)
        }
    }

    private func lockScreenView(context: ActivityViewContext<RestLiveActivityAttributes>) -> some View {
        HStack(spacing: 14) {
            Image(systemName: context.state.isFinished ? "checkmark.circle.fill" : "timer")
                .font(.title2)
                .foregroundStyle(context.state.isFinished ? .green : .orange)

            VStack(alignment: .leading, spacing: 3) {
                Text(context.state.isFinished ? "Descanso concluído" : "Descanso")
                    .font(.headline)
                Text(context.attributes.exerciseName)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer(minLength: 8)

            timerText(context.state)
                .font(.system(size: 30, weight: .bold, design: .rounded).monospacedDigit())
        }
        .padding(.horizontal, 4)
    }

    @ViewBuilder
    private func timerText(_ state: RestLiveActivityAttributes.ContentState) -> some View {
        if state.isFinished {
            Text("00:00")
        } else {
            let now = Date.now
            Text(timerInterval: now...max(now, state.endDate), countsDown: true)
        }
    }
}
