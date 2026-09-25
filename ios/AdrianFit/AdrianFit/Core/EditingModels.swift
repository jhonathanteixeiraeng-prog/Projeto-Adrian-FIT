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

struct WorkoutItemDetail: Codable, Identifiable, Sendable, LoadPrescription, GroupableWorkoutItem {
    let id: String
    let sets: Int
    let reps: String
    let rest: Int
    let restBySet: String?
    let load: String?
    let rpe: String?
    /// Superset (bi-set, tri-set, circuito); ausente nas respostas de versões antigas da API.
    let groupId: String?
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
    /// Superset (bi-set, tri-set, circuito); nil tira o exercício do grupo.
    let groupId: String?
    let order: Int?

    init(
        exerciseId: String, sets: Int, reps: String, rest: Int, restBySet: String?, notes: String,
        load: String?, rpe: String?, groupId: String?, order: Int? = nil
    ) {
        self.exerciseId = exerciseId
        self.sets = sets
        self.reps = reps
        self.rest = rest
        self.restBySet = restBySet
        self.notes = notes
        self.load = load
        self.rpe = rpe
        self.groupId = groupId
        self.order = order
    }

    private enum CodingKeys: String, CodingKey {
        case exerciseId, sets, reps, rest, restBySet, notes, load, rpe, groupId, order
    }

    /// `load`, `rpe` e `groupId` vão sempre no JSON, com `null` para limpar: sem a chave o servidor mantém o
    /// valor salvo (compatibilidade com versões do app anteriores a esses campos) — e, sem `groupId`, desfaz os
    /// grupos que o salvamento deixou inválidos. As demais chaves seguem como antes.
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
        try container.encode(groupId, forKey: .groupId)
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

struct EditableWorkoutItem: Identifiable, Hashable, GroupableWorkoutItem {
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
    /// Superset (bi-set, tri-set, circuito): exercícios seguidos do dia com o mesmo id; nil = sem grupo.
    /// Mude pelos métodos de `EditableWorkoutDay`, que mantêm as regras dos grupos.
    var groupId: String? = nil

    /// Muda o número de séries mantendo um descanso por série para cada série.
    mutating func setSets(_ value: Int) {
        sets = value
        fitRestBySet()
    }

    fileprivate mutating func fitRestBySet() {
        let count = max(sets, 0)
        if restBySet.count < count {
            restBySet.append(contentsOf: Array(repeating: rest, count: count - restBySet.count))
        } else if restBySet.count > count {
            restBySet = Array(restBySet.prefix(count))
        }
    }

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

// MARK: Supersets no editor

/// Regras dos grupos no editor (as mesmas da web): grupos sempre em sequência, grupo de um exercício só se
/// desfaz, todos os exercícios de um grupo com o mesmo número de séries e descanso só depois do último — os
/// anteriores mostram "—", vão com 0 e voltam ao descanso do grupo quando saem dele.
extension EditableWorkoutDay {
    /// Grupo de cada exercício (letra, posição…); nil fora de grupo.
    var groupInfo: [WorkoutGroups.Info?] { WorkoutGroups.describe(items) }

    /// Exercício de um grupo antes do último: o descanso vem só depois da volta, então o dele fica oculto.
    static func hidesRest(_ info: WorkoutGroups.Info?) -> Bool {
        info.map { !$0.isLast } ?? false
    }

    /// Cada grupo vira um bloco seguido de 2+ exercícios: quem ficou longe do bloco sai do grupo (o maior bloco
    /// fica com ele) e grupo de um exercício só se desfaz. Usado ao carregar o plano e depois de cada mudança.
    mutating func normalizeGroups() {
        var runs: [(id: String, start: Int, end: Int)] = []
        for (index, item) in items.enumerated() {
            let id = (item.groupId ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard !id.isEmpty else { continue }
            if let last = runs.last, last.id == id, last.end == index - 1 {
                runs[runs.count - 1].end = index
            } else {
                runs.append((id, index, index))
            }
        }
        var largest: [String: Int] = [:]
        for (runIndex, run) in runs.enumerated() {
            if let kept = largest[run.id], runs[kept].end - runs[kept].start >= run.end - run.start { continue }
            largest[run.id] = runIndex
        }
        var ids = [String?](repeating: nil, count: items.count)
        for (runIndex, run) in runs.enumerated() where largest[run.id] == runIndex && run.end > run.start {
            for index in run.start...run.end { ids[index] = run.id }
        }
        for index in items.indices where items[index].groupId != ids[index] {
            items[index].groupId = ids[index]
        }
    }

    /// Primeiro e último índice do bloco do grupo em `index` (nil fora de grupo).
    private func groupBlock(at index: Int) -> ClosedRange<Int>? {
        guard items.indices.contains(index), let id = items[index].groupId else { return nil }
        var start = index
        while start > 0 && items[start - 1].groupId == id { start -= 1 }
        var end = index
        while end < items.count - 1 && items[end + 1].groupId == id { end += 1 }
        return start...end
    }

    /// "Agrupar com o próximo" vale quando há um próximo exercício e ele ainda não está no mesmo grupo.
    func canGroupWithNext(at index: Int) -> Bool {
        guard items.indices.contains(index), items.indices.contains(index + 1) else { return false }
        let ids = WorkoutGroups.normalizedIds(items)
        return ids[index] == nil || ids[index] != ids[index + 1]
    }

    /// Exercícios do grupo que "Agrupar com o próximo" formaria: os dois e os grupos de cada um.
    func groupingMembers(at index: Int) -> [Int] {
        guard canGroupWithNext(at: index) else { return [] }
        let ids = WorkoutGroups.normalizedIds(items)
        let joined = Set([ids[index], ids[index + 1]].compactMap { $0 })
        return items.indices.filter { member in
            member == index || member == index + 1 || ids[member].map(joined.contains) == true
        }
    }

    /// Algum exercício a agrupar tem séries diferentes das do exercício de origem: é preciso igualar antes.
    func groupingNeedsEqualSets(at index: Int) -> Bool {
        groupingMembers(at: index).contains { items[$0].sets != items[index].sets }
    }

    /// "Agrupar com o próximo": forma ou aumenta o grupo (juntando os grupos dos dois exercícios) e iguala as
    /// séries às do exercício de origem.
    mutating func groupWithNext(at index: Int) {
        let members = groupingMembers(at: index)
        guard !members.isEmpty else { return }
        let ids = WorkoutGroups.normalizedIds(items)
        let groupId = ids[index] ?? ids[index + 1] ?? WorkoutGroups.newGroupId()
        let sets = items[index].sets
        restructure { items in
            for member in members {
                items[member].groupId = groupId
                if items[member].sets != sets { items[member].setSets(sets) }
            }
        }
    }

    /// "Desagrupar": o exercício sai do grupo com o descanso do grupo. Do meio do grupo, ele vai para logo depois
    /// do grupo, que continua com os demais (como na web); se sobrar um exercício só, o grupo se desfaz.
    mutating func ungroup(at index: Int) {
        guard let block = groupBlock(at: index) else { return }
        restructure { items in
            var freed = items[index]
            freed.groupId = nil
            if index == block.lowerBound || index == block.upperBound {
                items[index] = freed
            } else {
                items.remove(at: index)
                items.insert(freed, at: block.upperBound)
            }
        }
    }

    /// Muda as séries de um exercício; num grupo, as de todos os exercícios dele.
    mutating func setSets(_ value: Int, at index: Int) {
        guard items.indices.contains(index) else { return }
        let sets = min(max(value, 1), 12)
        let ids = WorkoutGroups.normalizedIds(items)
        for member in items.indices where member == index || (ids[index] != nil && ids[member] == ids[index]) {
            items[member].setSets(sets)
        }
    }

    mutating func removeItems(atOffsets offsets: IndexSet) {
        restructure { items in
            for index in offsets.sorted(by: >) where items.indices.contains(index) {
                items.remove(at: index)
            }
        }
    }

    /// Reordena como o `onMove` da lista (destino = índice antes da mudança), como na web: um exercício nunca
    /// fica no meio de um grupo do qual não faz parte — vai para a borda do grupo, na direção do movimento — e um
    /// exercício arrastado para longe do seu grupo sai dele.
    mutating func moveItems(fromOffsets source: IndexSet, toOffset destination: Int) {
        let valid = source.filter { items.indices.contains($0) }
        guard let first = valid.first else { return }
        var target = min(max(destination, 0), items.count)
        if valid.count == 1, target > 0, target < items.count, let id = items[target - 1].groupId,
           items[target].groupId == id, items[first].groupId != id, let block = groupBlock(at: target) {
            target = first < block.lowerBound ? block.upperBound + 1 : block.lowerBound
        }
        restructure { items in
            let moving = valid.map { items[$0] }
            var reordered = items.indices.filter { !valid.contains($0) }.map { items[$0] }
            let insertion = target - valid.filter { $0 < target }.count
            reordered.insert(contentsOf: moving, at: min(max(insertion, 0), reordered.count))
            items = reordered
        }
    }

    /// Aplica uma mudança na lista mantendo as regras: grupo de um exercício só se desfaz e o exercício que
    /// tinha o descanso oculto recebe o descanso do grupo (o do último) quando passa a ser o último ou sai dele.
    private mutating func restructure(_ change: (inout [EditableWorkoutItem]) -> Void) {
        let before = WorkoutGroups.describe(items)
        var groupRest: [String: GroupRest] = [:]
        for (index, info) in before.enumerated() {
            if let info, info.isLast { groupRest[info.groupId] = GroupRest(items[index]) }
        }
        var hiddenRest: [UUID: GroupRest] = [:]
        for (index, info) in before.enumerated() {
            guard let info, !info.isLast, let rest = groupRest[info.groupId] else { continue }
            hiddenRest[items[index].id] = rest
        }

        change(&items)

        normalizeGroups()
        for (index, info) in WorkoutGroups.describe(items).enumerated() where !Self.hidesRest(info) {
            if let rest = hiddenRest[items[index].id] { rest.apply(to: &items[index]) }
        }
    }
}

/// Descanso de um grupo: o do último exercício (valor único ou por volta).
private struct GroupRest {
    let rest: Int
    let customRest: Bool
    let restBySet: [Int]

    init(_ item: EditableWorkoutItem) {
        rest = item.rest
        customRest = item.customRest
        restBySet = item.restBySet
    }

    func apply(to item: inout EditableWorkoutItem) {
        item.rest = rest
        item.customRest = customRest
        item.restBySet = restBySet
        item.fitRestBySet()
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
