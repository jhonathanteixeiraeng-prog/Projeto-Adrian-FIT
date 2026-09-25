import Foundation

struct WatchWorkoutState: Codable, Equatable, Sendable {
    let dayId: String
    let dayName: String
    let exerciseId: String?
    let exerciseName: String?
    let targetReps: String?
    /// Carga prescrita da série atual já formatada ("22,5 kg"); ausente quando não há prescrição
    /// ou quando o iPhone roda uma versão anterior do app.
    var targetLoad: String? = nil
    let currentSetIndex: Int?
    let exerciseSetCount: Int
    let completedSetCount: Int
    let totalSetCount: Int
    var restEndDate: Date?
    var restTotal: Int
    let isWorkoutFinished: Bool
}

enum WatchWorkoutCommand: Codable, Equatable, Sendable {
    case requestState
    case startWorkout
    case completeSet(exerciseId: String, setIndex: Int)
    case extendRest(seconds: Int)
    case skipRest
}

struct WatchWorkoutMetrics: Codable, Equatable, Sendable {
    let dayId: String
    let localDate: String
    let timezoneOffsetMinutes: Int
    let startedAt: Date
    var endedAt: Date?
    var durationSeconds: Int
    var activeEnergyKilocalories: Double
    var currentHeartRateBPM: Double
    var averageHeartRateBPM: Double
    var maxHeartRateBPM: Double
    var healthWorkoutUUID: String?
    var isFinal: Bool
}

enum WatchWorkoutPayloadKey {
    static let state = "workoutState"
    static let command = "workoutCommand"
    static let metrics = "workoutMetrics"
}
