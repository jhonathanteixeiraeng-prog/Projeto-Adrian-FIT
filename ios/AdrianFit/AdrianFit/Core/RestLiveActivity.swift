import ActivityKit
import Foundation

@MainActor
enum RestLiveActivity {
    private static var endDate: Date?
    private static var exerciseName = "Próxima série"
    private static var isRunning = false

    static func start(exerciseName: String, endDate: Date) {
        self.exerciseName = exerciseName
        self.endDate = endDate
        isRunning = true

        Task {
            await endExistingActivities(finished: false)
            guard isRunning, let endDate = self.endDate else { return }

            let attributes = RestLiveActivityAttributes(exerciseName: self.exerciseName)
            let content = activityContent(endDate: endDate, isFinished: false)
            do {
                _ = try Activity.request(attributes: attributes, content: content, pushType: nil)
            } catch {
                // Live Activities podem estar desativadas pelo usuário ou sistema.
                // A notificação local continua sendo o aviso de término.
            }
        }
    }

    static func update(endDate: Date) {
        guard isRunning else { return }
        self.endDate = endDate
        let content = activityContent(endDate: endDate, isFinished: false)

        Task {
            for activity in Activity<RestLiveActivityAttributes>.activities {
                await activity.update(content)
            }
        }
    }

    static func finish() {
        guard isRunning else { return }
        isRunning = false
        let completionDate = Date.now
        endDate = nil

        Task {
            await endExistingActivities(finished: true, endDate: completionDate)
        }
    }

    static func cancel() {
        guard isRunning else { return }
        isRunning = false
        endDate = nil

        Task {
            await endExistingActivities(finished: false)
        }
    }

    private static func endExistingActivities(finished: Bool, endDate: Date = .now) async {
        let content = activityContent(endDate: endDate, isFinished: finished)
        for activity in Activity<RestLiveActivityAttributes>.activities {
            await activity.end(content, dismissalPolicy: .immediate)
        }
    }

    private static func activityContent(endDate: Date, isFinished: Bool) -> ActivityContent<RestLiveActivityAttributes.ContentState> {
        ActivityContent(
            state: RestLiveActivityAttributes.ContentState(endDate: endDate, isFinished: isFinished),
            staleDate: isFinished ? nil : endDate
        )
    }
}
