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
    // Supersets (bi-set, tri-set, circuito). Opcionais: ausentes quando o exercício atual não está em grupo ou
    // quando o iPhone roda uma versão anterior do app; um relógio antigo ignora as chaves novas.
    /// Grupo do exercício atual: "Bi-set A".
    var groupTitle: String? = nil
    /// Posição do exercício atual no grupo: "A1".
    var groupPosition: String? = nil
    /// Falso quando concluir a série atual leva direto ao próximo exercício do grupo, sem descanso.
    /// Ausente = há descanso (comportamento anterior).
    var restAfterCurrentSet: Bool? = nil
    /// Exercício que vem em seguida, sem descanso, quando `restAfterCurrentSet` é falso: "A2 · Remada curvada".
    var nextExerciseName: String? = nil
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
