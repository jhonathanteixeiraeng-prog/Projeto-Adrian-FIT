import ActivityKit
import Foundation

struct RestLiveActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        let endDate: Date
        let isFinished: Bool
    }

    let exerciseName: String
}
