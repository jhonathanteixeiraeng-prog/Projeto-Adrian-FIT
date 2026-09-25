import Foundation

struct WorkoutCompletionRequest: Codable, Sendable {
    let dayId: String
    let completedSets: Int
    let totalSets: Int
    let startedAt: String?
    let completedAt: String
    let durationSeconds: Int
    let localDate: String
    let timezoneOffsetMinutes: Int

    var storageID: String { "\(dayId)-\(localDate)" }
}

struct WorkoutCompletionResult: Codable, Sendable {
    let id: String
    let percentage: Int
}

struct WorkoutHistoryResponse: Codable, Sendable {
    let summary: WorkoutHistorySummary
    let sessions: [WorkoutSessionRecord]
    let exerciseProgress: [ExerciseProgressRecord]
}

struct WorkoutHistorySummary: Codable, Sendable {
    let workoutsThisWeek: Int
    let totalWorkouts: Int
    let weeklyGoal: Int
    let weeklyStreak: Int
    let totalVolume: Double
    let averageDurationSeconds: Int
    let averageCompletionPercentage: Int
}

struct WorkoutSessionRecord: Codable, Identifiable, Sendable {
    let id: String
    let workoutDayId: String
    let dayName: String
    let localDate: String
    let status: String
    let startedAt: String
    let completedAt: String
    let completedSets: Int
    let totalSets: Int
    let percentage: Int
    let durationSeconds: Int
    let totalVolume: Double
    let activeEnergyKilocalories: Double?
    let averageHeartRateBPM: Double?
    let maxHeartRateBPM: Double?
    let healthWorkoutUUID: String?
    let legacy: Bool?
    let exercises: [WorkoutSessionExercise]

    var isComplete: Bool { status == "COMPLETED" || percentage >= 100 }

    var day: Date {
        (try? Date(localDate, strategy: .iso8601.year().month().day())) ?? .now
    }
}

struct WorkoutSessionExercise: Codable, Identifiable, Sendable {
    let exerciseId: String
    let name: String
    let muscleGroup: String
    let bestWeight: Double
    let totalVolume: Double
    let sets: [WorkoutSessionSet]

    var id: String { exerciseId }
}

struct WorkoutSessionSet: Codable, Identifiable, Sendable {
    let setIndex: Int
    let weight: Double
    let reps: Int
    let volume: Double

    var id: Int { setIndex }
}

struct ExerciseProgressRecord: Codable, Identifiable, Sendable {
    let exerciseId: String
    let name: String
    let muscleGroup: String
    let bestWeight: Double
    let firstWeight: Double
    let latestWeight: Double
    let changePercentage: Int
    let totalSets: Int
    let totalVolume: Double
    let points: [ExerciseProgressPoint]

    var id: String { exerciseId }
}

struct ExerciseProgressPoint: Codable, Identifiable, Sendable {
    let localDate: String
    let bestWeight: Double
    let volume: Double

    var id: String { localDate }
    var day: Date { (try? Date(localDate, strategy: .iso8601.year().month().day())) ?? .now }
}

@MainActor
enum PendingWorkoutCompletionStore {
    private static let key = "pending-workout-completions-v1"

    static func save(_ request: WorkoutCompletionRequest) {
        var values = all().filter { $0.storageID != request.storageID }
        values.append(request)
        persist(values)
    }

    static func all() -> [WorkoutCompletionRequest] {
        guard let data = UserDefaults.standard.data(forKey: key) else { return [] }
        return (try? JSONDecoder().decode([WorkoutCompletionRequest].self, from: data)) ?? []
    }

    static func remove(_ request: WorkoutCompletionRequest) {
        persist(all().filter { $0.storageID != request.storageID })
    }

    private static func persist(_ values: [WorkoutCompletionRequest]) {
        if values.isEmpty {
            UserDefaults.standard.removeObject(forKey: key)
        } else if let data = try? JSONEncoder().encode(values) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }
}

extension Notification.Name {
    static let workoutHistoryDidChange = Notification.Name("workoutHistoryDidChange")
}
