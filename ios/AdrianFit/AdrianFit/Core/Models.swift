import Foundation

enum UserRole: String, Codable, Sendable { case personal = "PERSONAL", student = "STUDENT" }

struct AppUser: Codable, Hashable, Sendable {
    let id: String
    let name: String
    let email: String
    let role: UserRole
    let personalId: String?
    let studentId: String?
    let personalTrainerName: String?
}

struct SessionResponse: Codable, Sendable {
    let user: AppUser?
    let expires: String?
}

struct APIEnvelope<Value: Decodable & Sendable>: Decodable, Sendable {
    let success: Bool
    let data: Value?
    let error: String?
    let message: String?
}

struct StudentDashboard: Codable, Sendable {
    let personal: PersonalSummary
    let workout: TodayWorkout?
    let diet: DietPlan?
    let stats: StudentStats
}

struct PersonalSummary: Codable, Sendable {
    let name: String
    let brandName: String
    let avatar: String?
}

struct StudentStats: Codable, Sendable {
    let streak: Int
    let weeklyWorkouts: Int
    let weeklyGoal: Int
    let nextCheckin: String
}

struct TodayWorkout: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let exercises: [TodayExercise]
}

struct TodayExercise: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let sets: Int
    let reps: String
    let rest: Int
    let completed: Bool
}

struct WorkoutPlan: Codable, Identifiable, Sendable {
    let id: String
    let title: String
    let startDate: String
    let endDate: String
    let workoutDays: [WorkoutDay]
}

struct WorkoutDay: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let dayOfWeek: Int
    let exercises: [ExerciseItem]
}

struct ExerciseItem: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let muscleGroup: String
    let sets: Int
    let reps: String
    let rest: Int
    let notes: String?
    let videoUrl: String?
    let instructions: String?
    let equipment: String?
}

struct DietPlan: Codable, Identifiable, Sendable {
    let id: String
    let title: String
    let calories: Int?
    let protein: Int?
    let carbs: Int?
    let fat: Int?
    let meals: [DietMeal]
}

struct DietMeal: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let time: String
    let foods: [DietFood]
    let notes: String?
    let calories: Int?
    let completed: Bool?
}

struct DietFood: Codable, Identifiable, Sendable {
    var id: String { foodId ?? name }
    let foodId: String?
    let name: String
    let portion: String?
    let quantity: FlexibleNumber?
    let calories: FlexibleNumber?
    let protein: FlexibleNumber?
    let carbs: FlexibleNumber?
    let fat: FlexibleNumber?
}

struct FlexibleNumber: Codable, Sendable {
    let value: Double
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let number = try? container.decode(Double.self) { value = number; return }
        let text = try container.decode(String.self).replacingOccurrences(of: ",", with: ".")
        value = Double(text) ?? 0
    }
}

struct PersonalDashboard: Codable, Sendable {
    let totalStudents: Int
    let activeStudents: Int
    let studentsWithoutWorkout72h: Int
    let averageWorkoutAdherence: Int
    let averageDietAdherence: Int
    let pendingCheckins: Int
    let lowAdherenceStudents: [AttentionStudent]
    let studentsWithoutWorkout72hList: [AttentionStudent]
}

struct AttentionStudent: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let email: String?
    let workoutAdherence: Int?
    let dietAdherence: Int?
}

struct StudentListItem: Codable, Identifiable, Sendable {
    let id: String
    let user: StudentUser
    let status: String
    let goal: String?
    let weight: Double?
    let workoutPlans: [PlanSummary]
    let dietPlans: [PlanSummary]
    let checkins: [CheckinSummary]
}

struct StudentUser: Codable, Sendable {
    let id: String
    let name: String
    let email: String
    let phone: String?
    let avatar: String?
}

struct PlanSummary: Codable, Identifiable, Sendable {
    let id: String
    let title: String
}

struct CheckinSummary: Codable, Identifiable, Sendable {
    let id: String
    let date: String
    let weight: Double
    let workoutAdherence: Int
    let dietAdherence: Int
}

struct ChatMessage: Codable, Identifiable, Sendable {
    let id: String
    let fromMe: Bool
    let text: String
    let time: String
    let read: Bool
    let createdAt: String
}

struct RelatedStudent: Codable, Sendable {
    let user: RelatedUser
}

struct RelatedUser: Codable, Sendable {
    let name: String
    let email: String?
}

struct ItemCount: Codable, Sendable {
    let workoutDays: Int?
    let templateDays: Int?
}

struct PersonalWorkoutPlan: Codable, Identifiable, Sendable {
    let id: String
    let title: String
    let startDate: String
    let endDate: String
    let active: Bool
    let version: Int
    let student: RelatedStudent
    let count: ItemCount?

    enum CodingKeys: String, CodingKey {
        case id, title, startDate, endDate, active, version, student
        case count = "_count"
    }
}

struct IdentifiedValue: Codable, Identifiable, Sendable { let id: String }

struct PersonalDietPlan: Codable, Identifiable, Sendable {
    let id: String
    let title: String
    let calories: Int?
    let protein: Int?
    let carbs: Int?
    let fat: Int?
    let active: Bool
    let student: RelatedStudent
    let meals: [IdentifiedValue]
}

struct WorkoutTemplateSummary: Codable, Identifiable, Sendable {
    let id: String
    let title: String
    let description: String?
    let templateDays: [WorkoutTemplateDaySummary]
    let count: ItemCount?

    enum CodingKeys: String, CodingKey {
        case id, title, description, templateDays
        case count = "_count"
    }
}

struct WorkoutTemplateDaySummary: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let dayOfWeek: Int
    let items: [WorkoutTemplateItemSummary]
}

struct WorkoutTemplateItemSummary: Codable, Identifiable, Sendable {
    let id: String
    let sets: Int
    let reps: String
    let rest: Int
    let exercise: TemplateExercise?
}

struct TemplateExercise: Codable, Sendable {
    let name: String
    let muscleGroup: String
}

struct DietTemplateSummary: Codable, Identifiable, Sendable {
    let id: String
    let title: String
    let calories: Int?
    let protein: Int?
    let carbs: Int?
    let fat: Int?
    let meals: [DietTemplateMealSummary]
}

struct DietTemplateMealSummary: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let time: String
    let items: [DietFood]
}
