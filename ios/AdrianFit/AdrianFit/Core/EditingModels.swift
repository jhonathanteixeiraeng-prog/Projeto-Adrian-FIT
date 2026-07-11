import Foundation

// MARK: - Biblioteca de exercícios

struct Exercise: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    let muscleGroup: String
    let equipment: String?
    let difficulty: String?
}

// MARK: - Plano de treino (detalhe para edição)
// GET /api/workout-plans/[id] retorna o objeto direto (sem envelope).

struct WorkoutPlanDetail: Codable, Identifiable, Sendable {
    let id: String
    let title: String
    let startDate: String
    let endDate: String
    let active: Bool
    let workoutDays: [WorkoutDayDetail]
}

struct WorkoutDayDetail: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let dayOfWeek: Int
    let items: [WorkoutItemDetail]
}

struct WorkoutItemDetail: Codable, Identifiable, Sendable {
    let id: String
    let sets: Int
    let reps: String
    let rest: Int
    let restBySet: String?
    let notes: String?
    let exercise: Exercise
}

// Corpo do PUT /api/workout-plans/[id]

struct WorkoutPlanUpdateBody: Encodable {
    let title: String
    let active: Bool
    let workoutDays: [WorkoutDayBody]
}

struct WorkoutDayBody: Encodable {
    let name: String
    let dayOfWeek: Int
    let items: [WorkoutItemBody]
}

struct WorkoutItemBody: Encodable {
    let exerciseId: String
    let sets: Int
    let reps: String
    let rest: Int
    let restBySet: String?
    let notes: String
}

// Estado editável em memória

struct EditableWorkoutDay: Identifiable, Hashable {
    let id = UUID()
    var name: String
    var dayOfWeek: Int
    var items: [EditableWorkoutItem]
}

struct EditableWorkoutItem: Identifiable, Hashable {
    let id = UUID()
    var exerciseId: String
    var exerciseName: String
    var muscleGroup: String
    var sets: Int
    var reps: String
    var rest: Int
    var customRest: Bool
    var restBySet: [Int]
    var notes: String
}

// MARK: - Plano alimentar (detalhe para edição)
// GET /api/diets/[id] retorna envelope; meals[].foods vem como string JSON.

struct DietPlanDetail: Codable, Identifiable, Sendable {
    let id: String
    let title: String
    let calories: Int?
    let protein: Int?
    let carbs: Int?
    let fat: Int?
    let active: Bool
    let meals: [DietMealRaw]
    let student: DietPlanStudentRef?
}

struct DietPlanStudentRef: Codable, Sendable {
    let id: String
}

struct DietMealRaw: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let time: String
    let foods: String // JSON string
    let notes: String?
}

struct DietFoodRaw: Codable, Sendable {
    let foodId: String?
    let name: String
    let quantity: FlexibleString?
    let portion: String?
    let notes: String?
    let calories: FlexibleNumber?
    let protein: FlexibleNumber?
    let carbs: FlexibleNumber?
    let fat: FlexibleNumber?
    let substitutionNote: String?
}

/// Aceita número ou string (o campo quantity é texto livre na web).
struct FlexibleString: Codable, Sendable {
    let value: String
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let text = try? container.decode(String.self) { value = text; return }
        if let number = try? container.decode(Double.self) {
            value = number == number.rounded() ? String(Int(number)) : String(number).replacingOccurrences(of: ".", with: ",")
            return
        }
        value = ""
    }
    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(value)
    }
}

// Corpo do PUT /api/diets/[id]

struct DietPlanUpdateBody: Encodable {
    let title: String
    let calories: Int
    let protein: Int
    let carbs: Int
    let fat: Int
    let active: Bool
    let meals: [DietMealBody]
}

struct DietMealBody: Encodable {
    let name: String
    let time: String
    let notes: String
    let foods: [DietFoodBody]
}

struct DietFoodBody: Encodable {
    let foodId: String?
    let name: String
    let quantity: String
    let portion: String
    let notes: String
    let calories: Double
    let protein: Double
    let carbs: Double
    let fat: Double
}

// Estado editável em memória

struct EditableDietMeal: Identifiable, Hashable {
    let id = UUID()
    var name: String
    var time: String
    var notes: String
    var foods: [EditableDietFood]
}

struct EditableDietFood: Identifiable, Hashable {
    let id = UUID()
    var foodId: String?
    var name: String
    var quantity: String
    var portion: String
    var notes: String
    var calories: Double
    var protein: Double
    var carbs: Double
    var fat: Double
}

// MARK: - Busca de alimentos

struct FoodSearchItem: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let portion: String?
    let calories: FlexibleNumber?
    let protein: FlexibleNumber?
    let carbs: FlexibleNumber?
    let fat: FlexibleNumber?
}

// MARK: - Geração automática de dieta (POST /api/diets/generate)

struct GeneratedDietPlan: Codable, Sendable {
    let calories: Int
    let protein: Int
    let carbs: Int
    let fat: Int
    let meals: [GeneratedDietMeal]
}

struct GeneratedDietMeal: Codable, Sendable {
    let name: String
    let time: String
    let foods: [GeneratedDietFood]
}

struct GeneratedDietFood: Codable, Sendable {
    let foodId: String
    let name: String
    let quantity: Double
    let portion: String
    let calories: Double
    let protein: Double
    let carbs: Double
    let fat: Double
    let substitutionNote: String?
}

// MARK: - Criação de planos vazios

struct WorkoutPlanCreateBody: Encodable {
    let title: String
    let studentId: String
    let startDate: String
    let endDate: String
    let active: Bool
    let workoutDays: [WorkoutDayBody]
}

struct DietPlanCreateBody: Encodable {
    let title: String
    let studentId: String
    let startDate: String
    let endDate: String
    let active: Bool
    let meals: [DietCreateMealBody]
}

struct DietCreateMealBody: Encodable {
    let name: String
    let time: String
    let items: [DietCreateItemBody]
    let notes: String?
}

struct DietCreateItemBody: Encodable {
    let name: String
    let portion: String
    let quantity: Double
    let calories: Double
    let protein: Double
    let carbs: Double
    let fat: Double
}
