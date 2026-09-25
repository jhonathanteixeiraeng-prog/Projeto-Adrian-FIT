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

struct WorkoutItemDetail: Codable, Identifiable, Sendable, LoadPrescription {
    let id: String
    let sets: Int
    let reps: String
    let rest: Int
    let restBySet: String?
    let load: String?
    let rpe: String?
    let notes: String?
    let exercise: Exercise
}

// Corpo do PUT /api/workout-plans/[id]

struct WorkoutPlanUpdateBody: Encodable {
    let title: String
    let startDate: String?
    let endDate: String?
    let active: Bool
    let workoutDays: [WorkoutDayBody]

    init(title: String, startDate: String? = nil, endDate: String? = nil, active: Bool, workoutDays: [WorkoutDayBody]) {
        self.title = title
        self.startDate = startDate
        self.endDate = endDate
        self.active = active
        self.workoutDays = workoutDays
    }
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
    /// Carga (kg) e RPE prescritos; nil limpa a prescrição.
    let load: String?
    let rpe: String?
    let order: Int?

    init(exerciseId: String, sets: Int, reps: String, rest: Int, restBySet: String?, notes: String, load: String?, rpe: String?, order: Int? = nil) {
        self.exerciseId = exerciseId
        self.sets = sets
        self.reps = reps
        self.rest = rest
        self.restBySet = restBySet
        self.notes = notes
        self.load = load
        self.rpe = rpe
        self.order = order
    }

    private enum CodingKeys: String, CodingKey {
        case exerciseId, sets, reps, rest, restBySet, notes, load, rpe, order
    }

    /// `load` e `rpe` vão sempre no JSON, com `null` para limpar: sem a chave o servidor mantém o valor
    /// salvo (compatibilidade com versões do app anteriores a esses campos). As demais chaves seguem como antes.
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(exerciseId, forKey: .exerciseId)
        try container.encode(sets, forKey: .sets)
        try container.encode(reps, forKey: .reps)
        try container.encode(rest, forKey: .rest)
        try container.encodeIfPresent(restBySet, forKey: .restBySet)
        try container.encode(notes, forKey: .notes)
        try container.encode(load, forKey: .load)
        try container.encode(rpe, forKey: .rpe)
        try container.encodeIfPresent(order, forKey: .order)
    }
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
    /// Texto dos campos "Carga (kg)" e "RPE" como aparece/é digitado em pt-BR ("20/22,5/25", "7-8").
    var load: String = ""
    var rpe: String = ""
    var notes: String

    /// Mesma validação do servidor (mensagens idênticas), recalculada a cada edição.
    var normalizedLoad: WorkoutLoad.Normalized { WorkoutLoad.normalizeLoad(load, sets: sets) }
    var normalizedRpe: WorkoutLoad.Normalized { WorkoutLoad.normalizeRpe(rpe) }

    /// Valores para o corpo do PUT/POST: normalizados (nil limpa). Um texto inválido segue como está para o
    /// servidor recusar com a mesma mensagem — nunca vira nil, o que apagaria a prescrição salva.
    var loadPayload: String? {
        switch normalizedLoad {
        case .valid(let value): value
        case .invalid: load
        }
    }

    var rpePayload: String? {
        switch normalizedRpe {
        case .valid(let value): value
        case .invalid: rpe
        }
    }
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
    let title: String
    let meals: [GeneratedDietMeal]
    let warnings: [String]
}

struct GeneratedDietMeal: Codable, Sendable {
    let name: String
    let time: String
    let foods: [GeneratedDietFood]
}

struct GeneratedDietFood: Codable, Sendable {
    let name: String
    let quantity: Double
    let portion: String
    let calories: Double
    let protein: Double
    let carbs: Double
    let fat: Double
    let notes: String
}

// MARK: - Criação de planos vazios

struct WorkoutPlanCreateBody: Encodable {
    let title: String
    let studentId: String
    let startDate: String
    let endDate: String
    let active: Bool
    let saveAsTemplate: Bool?
    let workoutDays: [WorkoutDayBody]

    init(
        title: String,
        studentId: String,
        startDate: String,
        endDate: String,
        active: Bool,
        saveAsTemplate: Bool? = nil,
        workoutDays: [WorkoutDayBody]
    ) {
        self.title = title
        self.studentId = studentId
        self.startDate = startDate
        self.endDate = endDate
        self.active = active
        self.saveAsTemplate = saveAsTemplate
        self.workoutDays = workoutDays
    }
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
    let foodId: String?
    let name: String
    let portion: String
    let quantity: Double
    let calories: Double
    let protein: Double
    let carbs: Double
    let fat: Double
    let notes: String?
}

struct DietTemplateCreateBody: Encodable {
    let title: String
    let meals: [DietCreateMealBody]
}
