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

enum FitnessCopy {
    static func workoutName(_ value: String) -> String {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        let folded = trimmed.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "pt_BR"))
        if folded.contains("day off") || folded == "off" || folded.contains("folga") { return "Descanso ativo" }

        var result = trimmed.replacingOccurrences(of: "_", with: " ")
        let replacements = [
            "triceps": "tríceps", "biceps": "bíceps", "gluteo": "glúteo",
            "quadriceps": "quadríceps", "estimulo": "estímulo", "sabado": "sábado",
            "terca": "terça", "ombro": "ombros", "abdomen": "abdômen"
        ]
        for (plain, accented) in replacements {
            result = result.replacingOccurrences(of: plain, with: accented, options: [.caseInsensitive, .diacriticInsensitive])
        }
        result = result.split(whereSeparator: \.isWhitespace).joined(separator: " ")
        guard let first = result.first else { return "Treino" }
        return String(first).uppercased() + result.dropFirst()
    }
}

extension FitnessCopy {
    /// Versão curta para barras de navegação e cards: remove o prefixo de dia
    /// da semana ("SABADO - ...") e limita a dois grupos musculares.
    static func compactWorkoutName(_ value: String) -> String {
        let normalized = workoutName(value)
        var content = normalized

        for separator in [" - ", " – ", " — ", ": ", " | "] where normalized.contains(separator) {
            let parts = normalized.components(separatedBy: separator)
            if parts.count >= 2, isWeekdayLike(parts[0]) {
                content = parts.dropFirst().joined(separator: separator)
                break
            }
        }

        content = content.trimmingCharacters(in: .whitespacesAndNewlines)
        let groups = content
            .replacingOccurrences(of: " e ", with: ", ")
            .components(separatedBy: ", ")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        if groups.count > 2 {
            content = groups.prefix(2).joined(separator: ", ") + " +\(groups.count - 2)"
        }

        guard let first = content.first else { return "Treino" }
        return String(first).uppercased() + content.dropFirst()
    }

    private static func isWeekdayLike(_ text: String) -> Bool {
        let folded = text.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "pt_BR"))
            .trimmingCharacters(in: .whitespaces)
        let weekdays = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"]
        return weekdays.contains { folded.hasPrefix($0) } || folded.hasSuffix("feira")
    }
}

extension TodayWorkout {
    var displayName: String { FitnessCopy.workoutName(name) }
    var compactName: String { FitnessCopy.compactWorkoutName(name) }
}

struct TodayExercise: Codable, Identifiable, Sendable, LoadPrescription {
    let id: String
    let name: String
    let sets: Int
    let reps: String
    let rest: Int
    /// Carga (kg) e RPE prescritos; ausentes nas respostas de versões antigas da API.
    let load: String?
    let rpe: String?
    let completed: Bool

    var prescriptionIssue: String? {
        ExercisePrescription.issue(sets: sets, reps: reps, rest: rest)
    }
}

extension TodayWorkout {
    var prescriptionIssue: String? { exercises.compactMap(\.prescriptionIssue).first }
}

struct WorkoutPlan: Codable, Identifiable, Sendable {
    let id: String
    let title: String
    let startDate: String
    let endDate: String
    let workoutDays: [WorkoutDay]
}

extension WorkoutPlan { var displayTitle: String { FitnessCopy.workoutName(title) } }

extension WorkoutDay { var compactName: String { FitnessCopy.compactWorkoutName(name) } }

struct WorkoutDay: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let dayOfWeek: Int
    let exercises: [ExerciseItem]
}

extension WorkoutDay {
    var displayName: String { FitnessCopy.workoutName(name) }
    var isRestDay: Bool {
        let value = name.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
        return value.contains("day off") || value.contains("descanso") || value.contains("folga")
    }
    var prescriptionIssue: String? { exercises.compactMap(\.prescriptionIssue).first }
}

struct ExerciseItem: Codable, Identifiable, Sendable, LoadPrescription {
    let id: String
    let exerciseId: String?
    let name: String
    let muscleGroup: String
    let sets: Int
    let reps: String
    let rest: Int
    let restBySet: [Int]?
    /// Carga (kg) e RPE prescritos; ausentes nas respostas de versões antigas da API.
    let load: String?
    let rpe: String?
    let notes: String?
    let videoUrl: String?
    let instructions: String?
    let equipment: String?

    var displayReps: String {
        let cleaned = reps.trimmingCharacters(in: .whitespacesAndNewlines)
        return cleaned.isEmpty ? "reps a definir" : cleaned
    }

    var prescriptionIssue: String? {
        ExercisePrescription.issue(sets: sets, reps: reps, rest: rest)
    }

    func restAfterSet(_ index: Int) -> Int {
        guard let values = restBySet, values.indices.contains(index) else { return rest }
        return min(max(values[index], 0), 600)
    }
}

private enum ExercisePrescription {
    static func issue(sets: Int, reps: String, rest: Int) -> String? {
        let value = reps.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if !(1...12).contains(sets) { return "Quantidade de séries inválida." }
        if value.isEmpty || value == "reps" || value.contains("definir") { return "Repetições ainda não foram definidas pelo personal." }
        if !(0...600).contains(rest) { return "Tempo de descanso inválido." }
        return nil
    }
}

// MARK: - Carga (kg) e RPE prescritos

/// Itens de treino que trazem a carga (kg) e o RPE prescritos pelo personal (texto, como as reps).
protocol LoadPrescription {
    var load: String? { get }
    var rpe: String? { get }
}

extension LoadPrescription {
    /// Carga prescrita da série (índice a partir de 0); com menos valores que séries, o último se repete.
    func loadForSet(_ index: Int) -> Double? { WorkoutLoad.loadForSet(load, index: index) }

    /// "20 kg", "20/22,5/25 kg" ou "" quando não há carga prescrita.
    var displayLoad: String { WorkoutLoad.formatLoad(load) }

    /// "RPE 8", "RPE 7-8" ou "" quando não há RPE prescrito.
    var displayRpe: String { WorkoutLoad.formatRpe(rpe) }

    /// "20 kg · RPE 8" com as partes presentes, ou nil quando não há prescrição.
    var loadPrescriptionSummary: String? {
        let parts = [displayLoad, displayRpe].filter { !$0.isEmpty }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}

/// Regras de carga (kg) e RPE — port de src/lib/workout-load.ts (mantenha os dois iguais).
///
/// Formato salvo:
/// - load: "20" para todas as séries ou um valor por série "20/22.5/25" (kg, decimal com ponto, 0–500);
/// - rpe: "8", "8.5" ou uma faixa "7-8" (escala de 1 a 10, passos de 0,5).
/// Na digitação aceitamos vírgula decimal e as formas usadas em pt-BR ("12,5/15", "20 kg", "7 a 8", "RPE 8").
enum WorkoutLoad {
    static let maxLoadKg = 500

    /// Resultado da validação: valor normalizado (nil = sem prescrição) ou a mesma mensagem de erro do servidor.
    enum Normalized: Equatable, Sendable {
        case valid(String?)
        case invalid(String)

        var value: String? {
            if case .valid(let value) = self { return value }
            return nil
        }

        var error: String? {
            if case .invalid(let message) = self { return message }
            return nil
        }
    }

    /// "20", "20 kg", "12,5/15/17,5" → [20] / [12.5, 15, 17.5]; [] quando vazio; nil quando não é uma lista de cargas.
    static func parseLoad(_ raw: String?) -> [Double]? {
        let text = removingKilogramSuffix((raw ?? "").trimmingCharacters(in: .whitespacesAndNewlines))
        if text.isEmpty { return [] }
        // Ao contrário das reps, a vírgula é decimal ("12,5 kg"): só "/", "|" e ";" separam as séries.
        let parts = text
            .split(whereSeparator: { "/|;".contains($0) })
            .map { removingKilogramSuffix($0.trimmingCharacters(in: .whitespacesAndNewlines)) }
            .filter { !$0.isEmpty }
        if parts.isEmpty { return [] }
        var values: [Double] = []
        for part in parts {
            guard let value = decimal(part, integerDigits: 1...3, fractionDigits: 1...2),
                  value >= 0, value <= Double(maxLoadKg) else { return nil }
            values.append(value)
        }
        return values
    }

    /// Valida e converte a carga digitada para o formato salvo, ajustada ao número de séries:
    /// menos valores que séries repetem o último e valores iguais viram um só ("20/20/20" → "20").
    static func normalizeLoad(_ raw: String?, sets: Int) -> Normalized {
        guard let values = parseLoad(raw) else {
            return .invalid("Carga: use kg por série, ex.: 20 ou 20/22,5/25 (até \(maxLoadKg) kg)")
        }
        guard let last = values.last else { return .valid(nil) }
        let totalSets = max(1, sets)
        if values.count > totalSets {
            return .invalid("Carga: \(values.count) valores para \(totalSets) série\(totalSets == 1 ? "" : "s")")
        }
        let fitted = (0..<totalSets).map { values.indices.contains($0) ? values[$0] : last }
        let value = fitted.allSatisfy { $0 == fitted[0] }
            ? formatNumber(fitted[0])
            : fitted.map(formatNumber).joined(separator: "/")
        return .valid(value)
    }

    /// Carga prescrita de uma série (índice a partir de 0), ou nil quando não há.
    static func loadForSet(_ stored: String?, index: Int) -> Double? {
        guard index >= 0, let values = parseLoad(stored), !values.isEmpty else { return nil }
        return values[min(index, values.count - 1)]
    }

    /// Texto para campos e telas em pt-BR: "20", "20/22,5/25"; "" quando não há carga.
    static func formatLoadInput(_ stored: String?) -> String {
        guard let values = parseLoad(stored), !values.isEmpty else { return "" }
        return values.map(formatDecimal).joined(separator: "/")
    }

    /// "20 kg", "20/22,5/25 kg" ou "" quando não há carga prescrita.
    static func formatLoad(_ stored: String?) -> String {
        let text = formatLoadInput(stored)
        return text.isEmpty ? "" : "\(text) kg"
    }

    /// Uma carga em pt-BR: 22.5 → "22,5 kg".
    static func formatKilograms(_ value: Double) -> String {
        "\(formatDecimal(value)) kg"
    }

    /// "8", "8,5", "7-8", "7 a 8", "RPE 8" → "8" / "8.5" / "7-8"; nil quando vazio.
    static func normalizeRpe(_ raw: String?) -> Normalized {
        let text = removingRpePrefix(raw ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if text.isEmpty { return .valid(nil) }
        let parts = rangeParts(text)
        let values = parts.compactMap { decimal($0, integerDigits: 1...2, fractionDigits: 1...1) }
        let valid = (1...2).contains(parts.count)
            && values.count == parts.count
            && values.allSatisfy { $0 >= 1 && $0 <= 10 && ($0 * 2).rounded() == $0 * 2 }
            && (values.count == 1 || values[0] < values[1])
        guard valid else { return .invalid("RPE: use de 1 a 10, ex.: 8, 8,5 ou 7-8") }
        return .valid(values.map(formatNumber).joined(separator: "-"))
    }

    /// "RPE 8", "RPE 7-8", "RPE 8,5" ou "" quando não há RPE.
    static func formatRpe(_ stored: String?) -> String {
        let text = (stored ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return text.isEmpty ? "" : "RPE \(text.replacingOccurrences(of: ".", with: ","))"
    }

    /// Texto inicial do campo de carga no editor. Um valor salvo fora do formato aparece como está (e não vazio),
    /// para a validação apontar o problema em vez de o app apagar a prescrição ao salvar.
    static func loadEditorText(_ stored: String?) -> String {
        let formatted = formatLoadInput(stored)
        return formatted.isEmpty ? (stored ?? "").trimmingCharacters(in: .whitespacesAndNewlines) : formatted
    }

    /// Texto inicial do campo de RPE no editor: "8,5", "7-8".
    static func rpeEditorText(_ stored: String?) -> String {
        (stored ?? "").trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: ".", with: ",")
    }

    /// Igual a `String(Math.round(value * 100) / 100)` na web: 20 → "20", 22.5 → "22.5", 12.25 → "12.25".
    private static func formatNumber(_ value: Double) -> String {
        let rounded = (value * 100).rounded(.toNearestOrAwayFromZero) / 100
        return rounded == rounded.rounded() ? String(Int(rounded)) : String(rounded)
    }

    /// Um número em pt-BR: 22.5 → "22,5", 20 → "20".
    static func formatDecimal(_ value: Double) -> String {
        formatNumber(value).replacingOccurrences(of: ".", with: ",")
    }

    /// Remove "kg", "quilo" ou "quilos" do fim do texto (`/\s*(kg|quilos?)\s*$/i` na web).
    private static func removingKilogramSuffix(_ text: String) -> String {
        for suffix in ["quilos", "quilo", "kg"] {
            if let range = text.range(of: suffix, options: [.caseInsensitive, .anchored, .backwards]) {
                return text[..<range.lowerBound].trimmingCharacters(in: .whitespacesAndNewlines)
            }
        }
        return text
    }

    /// Remove o prefixo "RPE"/"PSE" com ":" ou "=" opcional (`/^\s*(rpe|pse)\s*[:=]?\s*/i` na web).
    private static func removingRpePrefix(_ raw: String) -> String {
        let text = raw.drop(while: \.isWhitespace)
        for prefix in ["rpe", "pse"] {
            guard let range = text.range(of: prefix, options: [.caseInsensitive, .anchored]) else { continue }
            var rest = text[range.upperBound...].drop(while: \.isWhitespace)
            if rest.first == ":" || rest.first == "=" { rest = rest.dropFirst() }
            return String(rest.drop(while: \.isWhitespace))
        }
        return raw
    }

    /// Separa uma faixa de RPE em "-", "–", "até" ou "a" (`/\s*(?:-|–|até|a)\s*/i` na web), sem partes vazias.
    private static func rangeParts(_ text: String) -> [String] {
        var parts: [String] = []
        var current = ""
        var index = text.startIndex
        while index < text.endIndex {
            if let range = text[index...].range(of: "até", options: [.caseInsensitive, .anchored]) {
                parts.append(current)
                current = ""
                index = range.upperBound
            } else if ["-", "\u{2013}", "a", "A"].contains(text[index]) {
                parts.append(current)
                current = ""
                index = text.index(after: index)
            } else {
                current.append(text[index])
                index = text.index(after: index)
            }
        }
        parts.append(current)
        return parts.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
    }

    /// Número com algarismos ASCII e no máximo um separador decimal ("," ou "."), como `^\d{1,3}([.,]\d{1,2})?$`.
    private static func decimal(_ text: String, integerDigits: ClosedRange<Int>, fractionDigits: ClosedRange<Int>) -> Double? {
        var integer = ""
        var fraction: String?
        for character in text {
            if character == "." || character == "," {
                guard fraction == nil else { return nil }
                fraction = ""
            } else if let ascii = character.asciiValue, (48...57).contains(ascii) {
                if fraction == nil { integer.append(character) } else { fraction?.append(character) }
            } else {
                return nil
            }
        }
        guard integerDigits.contains(integer.count) else { return nil }
        if let fraction, !fractionDigits.contains(fraction.count) { return nil }
        return Double(fraction.map { "\(integer).\($0)" } ?? integer)
    }
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
    let notes: String?
    let substitutionNote: String?
    // Totais calculados pelo backend; usados quando disponíveis para evitar
    // inconsistências de cálculo no cliente.
    let totalCalories: FlexibleNumber?
    let totalProtein: FlexibleNumber?
    let totalCarbs: FlexibleNumber?
    let totalFat: FlexibleNumber?

    /// Sugestão de troca vinda do gerador (gravada em notes ou substitutionNote).
    var substitutionText: String? {
        let candidates = [substitutionNote, notes]
        return candidates.compactMap { $0 }.first { $0.localizedCaseInsensitiveContains("substitu") }
    }

    var studentSubstitutionText: String? {
        guard let text = substitutionText else { return nil }
        let normalized = text.replacingOccurrences(of: ",", with: ".")
        let pattern = #"(?i)(?:por:\s*)?([^\(]+)\(\s*(\d+(?:\.\d+)?)\s*[x×].*?\((\d+(?:\.\d+)?)\s*g\)"#
        if let regex = try? NSRegularExpression(pattern: pattern),
           let match = regex.firstMatch(in: normalized, range: NSRange(normalized.startIndex..., in: normalized)),
           let nameRange = Range(match.range(at: 1), in: normalized),
           let factorRange = Range(match.range(at: 2), in: normalized),
           let gramRange = Range(match.range(at: 3), in: normalized),
           let factor = Double(normalized[factorRange]), let grams = Double(normalized[gramRange]) {
            let name = normalized[nameRange].trimmingCharacters(in: .whitespacesAndNewlines)
                .replacingOccurrences(of: "Pode substituir por:", with: "", options: .caseInsensitive)
            return "Substituição: \(name) — \(Int((factor * grams).rounded())) g"
        }
        if text.localizedCaseInsensitiveContains(" x ") || text.contains("×") {
            return "Substituição equivalente disponível; confirme a quantidade com o personal."
        }
        return text
    }

    var studentFriendlyName: String {
        let lower = name.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
        if lower.contains("ovo") { return "Ovo cozido" }
        if lower.contains("arroz") { return "Arroz cozido" }
        if lower.contains("frango") && lower.contains("peito") { return "Peito de frango" }
        if lower.contains("frango") && lower.contains("coxa") { return "Coxa de frango" }
        if lower.contains("frango") { return "Frango" }
        if lower.contains("carne") && lower.contains("patinho") { return "Patinho grelhado" }
        if lower.contains("queijo") && lower.contains("minas") { return "Queijo minas" }
        if lower.contains("queijo") && lower.contains("mozarela") { return "Queijo muçarela" }
        if lower.contains("cafe") { return "Café" }
        if lower.contains("tapioca") { return "Tapioca" }
        if lower.contains("banana") && lower.contains("doce") { return "Banana" }
        if lower.contains("batata") && lower.contains("chips") { return "Batata-doce assada" }
        if lower.contains("macarrao") && lower.contains("instantaneo") { return "Aveia com banana" }
        if lower.contains("pacoca") { return "Banana com aveia" }
        return name
    }

    var studentPortionText: String {
        let rawQuantity = quantity?.value ?? 0
        let unit = (portion ?? "porção").trimmingCharacters(in: .whitespacesAndNewlines)
        let quantity = rawQuantity > 0 ? rawQuantity : inferredDefaultQuantity
        let lowerName = name.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
        let lowerUnit = unit.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)

        let countableFoods = [
            "ovo", "pao frances", "pao de queijo", "pao de forma", "bisnaguinha", "torrada",
            "banana", "laranja", "maca", "pera", "kiwi", "tangerina", "mexerica"
        ]
        if countableFoods.contains(where: { lowerName.contains($0) }) {
            let baseUnits = DietFood.unitReference(in: lowerUnit)
            let count = quantity * baseUnits
            let formatted = DietFood.formatQuantity(count)
            if lowerName.contains("ovo") { return count == 1 ? "1 ovo" : "\(formatted) ovos" }
            return count == 1 ? "1 unidade" : "\(formatted) unidades"
        }

        let baseAmount = DietFood.gramReference(in: lowerUnit) ?? 100
        let finalAmount = Int((quantity * baseAmount).rounded())
        let liquidNames = ["cafe", "leite", "cha", "suco", "agua", "bebida", "vitamina", "caldo", "refrigerante", "isotonico"]
        let isLiquid = liquidNames.contains { lowerName.contains($0) }
        return "\(max(finalAmount, 1)) \(isLiquid ? "ml" : "g")"
    }

    var needsNutritionReview: Bool {
        let lower = name.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
        let suspiciousFood = [
            "instantaneo", "chips", "pacoca", "doce em barra", "salgado",
            "frango, caipira, inteiro, com pele"
        ].contains { lower.contains($0) }
        let noUsableServing = (quantity?.value ?? 0) <= 0 || ((totalCalories?.value ?? calories?.value ?? 0) <= 0)
        return suspiciousFood || noUsableServing
    }

    var reviewMessage: String {
        let lower = name.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
        if lower.contains("instantaneo") || lower.contains("chips") || lower.contains("pacoca") || lower.contains("doce em barra") {
            return "Sugestão saudável aplicada no app; confirme a troca com o personal."
        }
        return "Porção/calorias precisam de revisão no plano."
    }

    private var inferredDefaultQuantity: Double {
        let lower = name.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
        if lower.contains("ovo") { return 1 }
        if lower.contains("cafe") { return 1 }
        if lower.contains("queijo") { return 0.3 }
        if lower.contains("tapioca") { return 0.5 }
        if lower.contains("banana") { return 1 }
        return 1
    }

    private static func formatQuantity(_ value: Double) -> String {
        value == value.rounded() ? String(Int(value)) : String(format: "%.1f", value).replacingOccurrences(of: ".", with: ",")
    }

    private static func gramReference(in portion: String) -> Double? {
        let normalized = portion.replacingOccurrences(of: ",", with: ".").lowercased()
        let patterns = [#"\((\d+(?:\.\d+)?)\s*(?:g|ml)\)"#, #"^(\d+(?:\.\d+)?)\s*(?:g|ml)"#]
        for pattern in patterns {
            if let regex = try? NSRegularExpression(pattern: pattern),
               let match = regex.firstMatch(in: normalized, range: NSRange(normalized.startIndex..., in: normalized)),
               let range = Range(match.range(at: 1), in: normalized), let value = Double(normalized[range]), value > 0 {
                return value
            }
        }
        return nil
    }

    private static func unitReference(in portion: String) -> Double {
        guard portion.contains("unidade") || portion.contains("fatia") else { return 1 }
        let normalized = portion.replacingOccurrences(of: ",", with: ".")
        let prefix = normalized.prefix { "0123456789.".contains($0) }
        return max(Double(prefix) ?? 1, 1)
    }
}

struct FlexibleNumber: Codable, Sendable {
    let value: Double
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let number = try? container.decode(Double.self) { value = number; return }
        let text = try container.decode(String.self).replacingOccurrences(of: ",", with: ".")
        value = FlexibleNumber.parseNumber(from: text)
    }

    /// Extrai o primeiro número decimal de strings como "67 g", "1,5 unidades".
    static func parseNumber(from text: String) -> Double {
        let normalized = text.replacingOccurrences(of: ",", with: ".").trimmingCharacters(in: .whitespaces)
        var number = ""
        var hasDecimalSeparator = false

        for character in normalized {
            if character.isNumber {
                number.append(character)
            } else if character == ".", !hasDecimalSeparator, !number.isEmpty {
                hasDecimalSeparator = true
                number.append(character)
            } else if !number.isEmpty {
                break
            }
        }

        return Double(number) ?? 0
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

struct WorkoutTemplateItemSummary: Codable, Identifiable, Sendable, LoadPrescription {
    let id: String
    let sets: Int
    let reps: String
    let rest: Int
    let load: String?
    let rpe: String?
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
