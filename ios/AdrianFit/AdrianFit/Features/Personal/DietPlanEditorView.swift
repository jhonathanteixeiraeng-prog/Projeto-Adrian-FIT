import SwiftUI

struct DietPlanEditorView: View {
    @Environment(\.apiClient) private var api
    @Environment(\.dismiss) private var dismiss

    let planId: String?
    let studentId: String?

    init(planId: String, studentId: String? = nil) {
        self.planId = planId
        self.studentId = studentId
        _loading = State(initialValue: true)
        _resolvedStudentId = State(initialValue: studentId)
        _creationMode = State(initialValue: .student)
    }

    init(newFor studentId: String? = nil, asTemplate: Bool = false) {
        planId = nil
        self.studentId = studentId
        _loading = State(initialValue: true)
        _resolvedStudentId = State(initialValue: studentId)
        _creationMode = State(initialValue: asTemplate ? .template : .student)
    }

    @State private var title = ""
    @State private var meals: [EditableDietMeal] = []
    @State private var loading: Bool
    @State private var saving = false
    @State private var generating = false
    @State private var error: String?
    @State private var pickerMealId: UUID?
    @State private var showSaved = false
    @State private var showGenerationOptions = false
    @State private var resolvedStudentId: String?
    @State private var students: [StudentListItem] = []
    @State private var creationMode: DietCreationMode
    @State private var active = true
    @State private var warnings: [String] = []
    @State private var startDate = Date.now
    @State private var endDate = Calendar.current.date(byAdding: .day, value: 90, to: .now) ?? .now

    var body: some View {
        Group {
            if loading { ProgressView("Carregando dieta…").frame(maxWidth: .infinity, maxHeight: .infinity) }
            else if let error, meals.isEmpty && title.isEmpty {
                ContentUnavailableView("Dieta indisponível", systemImage: "fork.knife", description: Text(error))
            } else { editor }
        }
        .fitScreen()
        .navigationTitle(planId == nil ? (creationMode == .template ? "Novo modelo" : "Nova dieta") : "Editar dieta")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button(saveButtonTitle) { Task { await save() } }
                    .disabled(saving || loading || generating || safetyIssue != nil)
                    .fontWeight(.semibold)
            }
        }
        .task { await load() }
        .sheet(isPresented: Binding(get: { pickerMealId != nil }, set: { if !$0 { pickerMealId = nil } })) {
            FoodPickerView { food in
                addFood(food)
                pickerMealId = nil
            }
        }
        .sheet(isPresented: $showGenerationOptions) {
            DietGenerationOptionsView(
                destination: creationMode,
                studentId: creationMode == .student ? (resolvedStudentId ?? studentId) : nil
            ) { request in
                showGenerationOptions = false
                Task { await generate(request: request) }
            }
        }
        .alert(creationMode == .template ? "Modelo salvo" : "Dieta salva", isPresented: $showSaved) {
            Button("OK") { dismiss() }
        } message: { Text(savedMessage) }
        .alert("Erro", isPresented: Binding(get: { error != nil && !loading && !(meals.isEmpty && title.isEmpty) }, set: { if !$0 { error = nil } })) {
            Button("OK", role: .cancel) {}
        } message: { Text(error ?? "") }
    }

    private var saveButtonTitle: String {
        if saving { return "Salvando…" }
        if creationMode == .template { return "Salvar modelo" }
        return active ? "Salvar e enviar" : "Salvar inativa"
    }

    private var savedMessage: String {
        if creationMode == .template { return "O modelo já está disponível na biblioteca para ser atribuído depois." }
        return active
            ? "A dieta já está disponível no aplicativo do aluno."
            : "A dieta foi salva como inativa e não aparecerá para o aluno."
    }

    private var totals: (calories: Int, protein: Int, carbs: Int, fat: Int) {
        var cal = 0.0, prot = 0.0, carb = 0.0, fat = 0.0
        for meal in meals {
            for food in meal.foods {
                let qty = Self.nutritionFactor(food.quantity, name: food.name, portion: food.portion)
                cal += food.calories * qty
                prot += food.protein * qty
                carb += food.carbs * qty
                fat += food.fat * qty
            }
        }
        return (Int(cal.rounded()), Int(prot.rounded()), Int(carb.rounded()), Int(fat.rounded()))
    }

    static func enteredAmount(_ text: String) -> Double {
        let normalized = text.replacingOccurrences(of: ",", with: ".")
        let prefix = normalized.prefix { "0123456789.".contains($0) }
        return Double(prefix) ?? 0
    }

    static func usesUnits(name: String, portion: String) -> Bool {
        let text = name.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
        let countableFoods = [
            "ovo", "pao frances", "pao de queijo", "pao de forma", "bisnaguinha", "torrada",
            "banana", "laranja", "maca", "pera", "kiwi", "tangerina", "mexerica"
        ]
        return countableFoods.contains { text.contains($0) }
    }

    static func isLiquid(name: String) -> Bool {
        let text = name.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
        return ["cafe", "leite", "cha", "suco", "agua", "bebida", "vitamina", "caldo", "refrigerante", "isotonico"].contains { text.contains($0) }
    }

    static func displayUnit(name: String, portion: String) -> String {
        if usesUnits(name: name, portion: portion) { return "unidade(s)" }
        return isLiquid(name: name) ? "ml" : "g"
    }

    static func baseGrams(portion: String) -> Double {
        let normalized = portion.replacingOccurrences(of: ",", with: ".").lowercased()
        let patterns = [#"\((\d+(?:\.\d+)?)\s*(?:g|ml)\)"#, #"^(\d+(?:\.\d+)?)\s*(?:g|ml)"#]
        for pattern in patterns {
            if let regex = try? NSRegularExpression(pattern: pattern),
               let match = regex.firstMatch(in: normalized, range: NSRange(normalized.startIndex..., in: normalized)),
               let range = Range(match.range(at: 1), in: normalized), let value = Double(normalized[range]), value > 0 {
                return value
            }
        }
        return 100
    }

    static func baseUnits(portion: String) -> Double {
        let normalized = portion.replacingOccurrences(of: ",", with: ".").folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
        guard normalized.contains("unidade") || normalized.contains("fatia") else { return 1 }
        let prefix = normalized.prefix { "0123456789.".contains($0) }
        return max(Double(prefix) ?? 1, 1)
    }

    static func nutritionFactor(_ text: String, name: String, portion: String) -> Double {
        let amount = enteredAmount(text)
        guard amount > 0 else { return 0 }
        return usesUnits(name: name, portion: portion) ? amount / baseUnits(portion: portion) : amount / baseGrams(portion: portion)
    }

    static func displayAmount(canonicalQuantity: String, name: String, portion: String) -> String {
        let factor = enteredAmount(canonicalQuantity)
        let value = usesUnits(name: name, portion: portion) ? factor * baseUnits(portion: portion) : factor * baseGrams(portion: portion)
        return value == value.rounded() ? String(Int(value)) : String(format: "%.1f", value).replacingOccurrences(of: ".", with: ",")
    }

    private var safetyIssue: String? {
        if planId == nil, creationMode == .student, resolvedStudentId == nil { return "Selecione o aluno que receberá a dieta." }
        if creationMode == .student, endDate < startDate { return "A data final deve ser posterior à data inicial." }
        if title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return "Informe o título do plano." }
        if meals.isEmpty { return "Adicione pelo menos uma refeição." }
        for meal in meals {
            if meal.foods.isEmpty { return "A refeição \(meal.name) está sem alimentos." }
            for food in meal.foods {
                let quantity = Self.nutritionFactor(food.quantity, name: food.name, portion: food.portion)
                let entered = Self.enteredAmount(food.quantity)
                let calories = food.calories * quantity
                let maximum = Self.usesUnits(name: food.name, portion: food.portion) ? 20.0 : 2_000.0
                if entered <= 0 || entered > maximum { return "Revise a quantidade de \(food.name)." }
                if calories <= 0 || calories > 2_500 { return "Revise as calorias de \(food.name)." }
            }
        }
        let values = totals
        if values.calories < 800 || values.calories > 6_000 { return "O total diário deve ficar entre 800 e 6.000 kcal." }
        if values.protein < 20 || values.protein > 400 { return "Revise a meta diária de proteína." }
        if values.carbs < 20 || values.carbs > 800 { return "Revise a meta diária de carboidratos." }
        if values.fat < 10 || values.fat > 300 { return "Revise a meta diária de gorduras." }
        return nil
    }

    private var editor: some View {
        List {
            if planId == nil {
                Section("Destino") {
                    Picker("Destino", selection: $creationMode) {
                        ForEach(DietCreationMode.allCases) { mode in
                            Text(mode.title).tag(mode)
                        }
                    }
                    .pickerStyle(.segmented)

                    if creationMode == .student {
                        Picker("Aluno", selection: Binding(
                            get: { resolvedStudentId ?? "" },
                            set: { resolvedStudentId = $0.isEmpty ? nil : $0 }
                        )) {
                            Text("Selecione o aluno").tag("")
                            ForEach(students) { student in
                                Text(student.user.name).tag(student.id)
                            }
                        }
                        DatePicker("Início", selection: $startDate, displayedComponents: .date)
                        DatePicker("Término", selection: $endDate, displayedComponents: .date)
                    }
                }
                .listRowBackground(FitTheme.surface)
            }

            Section {
                TextField("Título do plano", text: $title).font(.headline)
                HStack(spacing: 14) {
                    MacroBadge(value: totals.calories, unit: "kcal", tint: FitTheme.orange)
                    MacroBadge(value: totals.protein, unit: "g prot", tint: FitTheme.green)
                    MacroBadge(value: totals.carbs, unit: "g carb", tint: FitTheme.blue)
                    MacroBadge(value: totals.fat, unit: "g gord", tint: FitTheme.orangeSoft)
                }
                Button {
                    showGenerationOptions = true
                } label: {
                    Label(generating ? "Gerando…" : "Gerar dieta automática", systemImage: "wand.and.stars")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                }
                .disabled(generating)
                .foregroundStyle(FitTheme.orange)
                if creationMode == .student {
                    Toggle("Ativa no app do aluno", isOn: $active)
                        .tint(FitTheme.orange)
                }
                if !warnings.isEmpty {
                    ForEach(warnings, id: \.self) { warning in
                        Label(warning, systemImage: "exclamationmark.triangle.fill")
                            .font(.caption)
                            .foregroundStyle(FitTheme.orangeSoft)
                    }
                }
                if let safetyIssue {
                    Label(safetyIssue, systemImage: "exclamationmark.triangle.fill")
                        .font(.caption)
                        .foregroundStyle(.red)
                }
            } header: { Text("Plano") }
                .listRowBackground(FitTheme.surface)

            ForEach($meals) { $meal in
                Section {
                    HStack {
                        TextField("Nome da refeição", text: $meal.name).font(.subheadline.weight(.semibold))
                        TextField("07:00", text: $meal.time)
                            .frame(width: 62)
                            .multilineTextAlignment(.trailing)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(FitTheme.orange)
                    }

                    ForEach($meal.foods) { $food in
                        FoodEditorRow(food: $food)
                    }
                    .onDelete { offsets in meal.foods.remove(atOffsets: offsets) }

                    Button {
                        pickerMealId = meal.id
                    } label: {
                        Label("Adicionar alimento", systemImage: "plus.circle.fill")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(FitTheme.orange)
                    }
                } header: {
                    HStack {
                        Text(meal.name.isEmpty ? "Refeição" : meal.name)
                        Spacer()
                        Button(role: .destructive) {
                            meals.removeAll { $0.id == meal.id }
                        } label: { Image(systemName: "trash").font(.caption) }
                    }
                }
                .listRowBackground(FitTheme.surface)
            }

            Section {
                Button {
                    meals.append(EditableDietMeal(name: "Nova refeição", time: "12:00", notes: "", foods: []))
                } label: {
                    Label("Adicionar refeição", systemImage: "plus.square.on.square")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                }
                .foregroundStyle(FitTheme.orange)
            }
            .listRowBackground(FitTheme.surface)
        }
        .scrollContentBackground(.hidden)
    }

    private func addFood(_ item: FoodSearchItem) {
        guard let mealId = pickerMealId, let index = meals.firstIndex(where: { $0.id == mealId }) else { return }
        meals[index].foods.append(EditableDietFood(
            foodId: item.id,
            name: item.name,
            quantity: Self.usesUnits(name: item.name, portion: item.portion ?? "100g") ? "1" : Self.displayAmount(canonicalQuantity: "1", name: item.name, portion: item.portion ?? "100g"),
            portion: item.portion ?? "100g",
            notes: "",
            calories: item.calories?.value ?? 0,
            protein: item.protein?.value ?? 0,
            carbs: item.carbs?.value ?? 0,
            fat: item.fat?.value ?? 0
        ))
    }

    private func load() async {
        loading = true
        defer { loading = false }
        do {
            async let studentRequest: [StudentListItem] = api.get("/api/students")

            guard let planId else {
                students = try await studentRequest
                error = nil
                return
            }

            async let planRequest: DietPlanDetail = api.get("/api/diets/\(planId)")
            let (plan, loadedStudents) = try await (planRequest, studentRequest)
            students = loadedStudents
            resolvedStudentId = plan.student?.id ?? studentId
            title = plan.title
            active = plan.active
            meals = plan.meals.map { meal in
                let foods = (try? JSONDecoder().decode([DietFoodRaw].self, from: Data(meal.foods.utf8))) ?? []
                return EditableDietMeal(
                    name: meal.name,
                    time: meal.time,
                    notes: meal.notes ?? "",
                    foods: foods.map { raw in
                        EditableDietFood(
                            foodId: raw.foodId,
                            name: raw.name,
                            quantity: Self.displayAmount(canonicalQuantity: raw.quantity?.value ?? "1", name: raw.name, portion: raw.portion ?? "100g"),
                            portion: raw.portion ?? "",
                            notes: raw.notes ?? raw.substitutionNote ?? "",
                            calories: raw.calories?.value ?? 0,
                            protein: raw.protein?.value ?? 0,
                            carbs: raw.carbs?.value ?? 0,
                            fat: raw.fat?.value ?? 0
                        )
                    }
                )
            }
            error = nil
        } catch { self.error = error.localizedDescription }
    }

    private func generate(request: DietGenerationRequest) async {
        generating = true
        defer { generating = false }
        struct GenerateBody: Encodable {
            let mode: String
            let studentId: String?
            let studentInfo: String
            let requiredFoods: String
            let mealCount: Int
        }

        let targetStudentId = resolvedStudentId ?? studentId
        if creationMode == .student, targetStudentId == nil {
            error = "Selecione o aluno antes de gerar a dieta."
            return
        }

        do {
            let plan: GeneratedDietPlan = try await api.post("/api/diets/generate", body: GenerateBody(
                mode: creationMode.rawValue,
                studentId: creationMode == .student ? targetStudentId : nil,
                studentInfo: request.studentInfo,
                requiredFoods: request.requiredFoods,
                mealCount: request.mealCount
            ))
            meals = plan.meals.map { meal in
                EditableDietMeal(
                    name: meal.name,
                    time: meal.time,
                    notes: "",
                    foods: meal.foods.map { food in
                        EditableDietFood(
                            foodId: nil,
                            name: food.name,
                            quantity: Self.displayAmount(
                                canonicalQuantity: food.quantity == food.quantity.rounded() ? String(Int(food.quantity)) : String(food.quantity),
                                name: food.name, portion: food.portion
                            ),
                            portion: food.portion,
                            notes: food.notes,
                            calories: food.calories,
                            protein: food.protein,
                            carbs: food.carbs,
                            fat: food.fat
                        )
                    }
                )
            }
            title = plan.title
            warnings = plan.warnings
            error = nil
        } catch { self.error = error.localizedDescription }
    }

    private func save() async {
        if let safetyIssue { error = safetyIssue; return }
        saving = true
        defer { saving = false }
        let totals = totals
        let updateMeals = meals.map { meal in
            DietMealBody(
                name: meal.name.isEmpty ? "Refeição" : meal.name,
                time: meal.time,
                notes: meal.notes,
                foods: meal.foods.map { food in
                    DietFoodBody(
                        foodId: food.foodId,
                        name: food.name,
                        quantity: String(Self.nutritionFactor(food.quantity, name: food.name, portion: food.portion)),
                        portion: food.portion,
                        notes: food.notes,
                        calories: food.calories,
                        protein: food.protein,
                        carbs: food.carbs,
                        fat: food.fat
                    )
                }
            )
        }
        let createMeals = meals.map { meal in
            DietCreateMealBody(
                name: meal.name.isEmpty ? "Refeição" : meal.name,
                time: meal.time,
                items: meal.foods.map { food in
                    DietCreateItemBody(
                        foodId: food.foodId,
                        name: food.name,
                        portion: food.portion,
                        quantity: Self.nutritionFactor(food.quantity, name: food.name, portion: food.portion),
                        calories: food.calories,
                        protein: food.protein,
                        carbs: food.carbs,
                        fat: food.fat,
                        notes: food.notes.isEmpty ? nil : food.notes
                    )
                },
                notes: meal.notes.isEmpty ? nil : meal.notes
            )
        }

        do {
            if let planId {
                let body = DietPlanUpdateBody(
                    title: title,
                    calories: totals.calories,
                    protein: totals.protein,
                    carbs: totals.carbs,
                    fat: totals.fat,
                    active: active,
                    meals: updateMeals
                )
                let _: DietPlanDetail = try await api.put("/api/diets/\(planId)", body: body)
            } else if creationMode == .template {
                let _: IdentifiedValue = try await api.post(
                    "/api/diet-templates",
                    body: DietTemplateCreateBody(title: title, meals: createMeals)
                )
            } else {
                guard let targetStudentId = resolvedStudentId else {
                    error = "Selecione o aluno que receberá a dieta."
                    return
                }
                let body = DietPlanCreateBody(
                    title: title,
                    studentId: targetStudentId,
                    startDate: ISO8601DateFormatter().string(from: startDate),
                    endDate: ISO8601DateFormatter().string(from: endDate),
                    active: active,
                    meals: createMeals
                )
                let _: IdentifiedValue = try await api.postRaw("/api/diet-plans", body: body)
            }
            showSaved = true
        } catch { self.error = error.localizedDescription }
    }
}

private enum DietCreationMode: String, CaseIterable, Identifiable {
    case student
    case template

    var id: String { rawValue }
    var title: String { self == .student ? "Para aluno" : "Modelo" }
}

private struct DietGenerationRequest {
    let studentInfo: String
    let requiredFoods: String
    let mealCount: Int
}

private struct DietGenerationOptionsView: View {
    @Environment(\.apiClient) private var api
    @Environment(\.dismiss) private var dismiss
    let destination: DietCreationMode
    let studentId: String?
    let onGenerate: (DietGenerationRequest) -> Void

    @State private var studentInfo = ""
    @State private var requiredFoods = ""
    @State private var mealCount = 4
    @State private var weight = ""
    @State private var height = ""
    @State private var birthDate = Calendar.current.date(byAdding: .year, value: -25, to: .now) ?? .now
    @State private var hasBirthDate = false
    @State private var profileLoading = false
    @State private var preparing = false
    @State private var error: String?

    private var validationMessage: String? {
        if destination == .student {
            guard studentId != nil else { return "Selecione o aluno antes de gerar a dieta." }
            guard let weightValue = Double(weight.replacingOccurrences(of: ",", with: ".")), (20...400).contains(weightValue) else {
                return "Informe um peso válido entre 20 e 400 kg."
            }
            guard let heightValue = Double(height.replacingOccurrences(of: ",", with: ".")), (100...250).contains(heightValue) else {
                return "Informe uma altura válida entre 100 e 250 cm."
            }
            if !hasBirthDate { return "Informe a data de nascimento do aluno." }
        }
        if studentInfo.trimmingCharacters(in: .whitespacesAndNewlines).count < 10 {
            return "Descreva objetivo, rotina, horários e necessidades com mais detalhes."
        }
        if requiredFoods.trimmingCharacters(in: .whitespacesAndNewlines).count < 2 {
            return "Informe os alimentos que devem fazer parte da dieta."
        }
        return nil
    }

    var body: some View {
        NavigationStack {
            Form {
                if destination == .student {
                    Section {
                        HStack {
                            Text("Peso")
                            Spacer()
                            TextField("80", text: $weight)
                                .keyboardType(.decimalPad)
                                .multilineTextAlignment(.trailing)
                                .frame(width: 85)
                            Text("kg").foregroundStyle(FitTheme.secondaryText)
                        }
                        HStack {
                            Text("Altura")
                            Spacer()
                            TextField("175", text: $height)
                                .keyboardType(.decimalPad)
                                .multilineTextAlignment(.trailing)
                                .frame(width: 85)
                            Text("cm").foregroundStyle(FitTheme.secondaryText)
                        }
                        Toggle("Informar nascimento", isOn: $hasBirthDate.animation())
                        if hasBirthDate {
                            DatePicker("Data de nascimento", selection: $birthDate, in: ...Date.now, displayedComponents: .date)
                        }
                    } header: {
                        Text("Dados físicos do aluno")
                    } footer: {
                        Text("Esses dados serão atualizados no cadastro e usados para calcular a dieta.")
                    }
                    .listRowBackground(FitTheme.surface)
                }

                Section {
                    TextEditor(text: $studentInfo)
                        .frame(minHeight: 120)
                        .overlay(alignment: .topLeading) {
                            if studentInfo.isEmpty {
                                Text(destination == .student
                                     ? "Ex.: emagrecimento, treina às 18h, precisa de refeições simples para o trabalho…"
                                     : "Ex.: modelo para hipertrofia, rotina de treino no fim da tarde…")
                                    .foregroundStyle(FitTheme.secondaryText)
                                    .padding(.top, 8)
                                    .allowsHitTesting(false)
                            }
                        }
                } header: {
                    Text("Informações e necessidades")
                } footer: {
                    Text("Inclua rotina, objetivo, preferências, restrições e horários relevantes.")
                }
                .listRowBackground(FitTheme.surface)

                Section {
                    TextEditor(text: $requiredFoods)
                        .frame(minHeight: 90)
                        .overlay(alignment: .topLeading) {
                            if requiredFoods.isEmpty {
                                Text("Ex.: arroz, feijão, ovos, frango, banana…")
                                    .foregroundStyle(FitTheme.secondaryText)
                                    .padding(.top, 8)
                                    .allowsHitTesting(false)
                            }
                        }
                } header: {
                    Text("Alimentos obrigatórios")
                } footer: {
                    Text("Separe por vírgulas ou descreva combinações e condições de uso.")
                }
                .listRowBackground(FitTheme.surface)

                Section("Estrutura") {
                    Stepper("\(mealCount) refeições", value: $mealCount, in: 2...8)
                }
                .listRowBackground(FitTheme.surface)

                if let validationMessage {
                    Section {
                        Label(validationMessage, systemImage: "exclamationmark.triangle.fill")
                            .font(.caption)
                            .foregroundStyle(.red)
                    }
                    .listRowBackground(FitTheme.surface)
                }
                if let error {
                    Section {
                        Label(error, systemImage: "exclamationmark.triangle.fill")
                            .font(.caption)
                            .foregroundStyle(.red)
                    }
                    .listRowBackground(FitTheme.surface)
                }
            }
            .scrollContentBackground(.hidden).fitScreen()
            .navigationTitle("Gerar dieta").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(preparing ? "Preparando…" : "Gerar") { Task { await prepareAndGenerate() } }
                        .disabled(validationMessage != nil || preparing || profileLoading)
                        .fontWeight(.semibold)
                }
            }
            .task { await loadStudentProfile() }
        }
    }

    private func loadStudentProfile() async {
        guard destination == .student, let studentId else { return }
        profileLoading = true
        defer { profileLoading = false }
        do {
            let student: StudentFull = try await api.get("/api/students/\(studentId)")
            weight = student.weight.map { String(format: "%.1f", $0).replacingOccurrences(of: ".0", with: "") } ?? ""
            height = student.height.map { String(format: "%.0f", $0) } ?? ""
            if let value = student.birthDate,
               let parsed = (try? Date(value, strategy: .iso8601.year().month().day().timeZone(separator: .omitted).time(includingFractionalSeconds: true)))
                ?? (try? Date(value, strategy: .iso8601)) {
                birthDate = parsed
                hasBirthDate = true
            }
            error = nil
        } catch { self.error = error.localizedDescription }
    }

    private func prepareAndGenerate() async {
        guard validationMessage == nil else { return }
        preparing = true
        defer { preparing = false }
        do {
            if destination == .student, let studentId {
                struct PhysicalDataBody: Encodable {
                    let weight: Double
                    let height: Double
                    let birthDate: String
                }
                let body = PhysicalDataBody(
                    weight: Double(weight.replacingOccurrences(of: ",", with: ".")) ?? 0,
                    height: Double(height.replacingOccurrences(of: ",", with: ".")) ?? 0,
                    birthDate: ISO8601DateFormatter().string(from: birthDate)
                )
                try await api.putAck("/api/students/\(studentId)", body: body)
            }
            onGenerate(DietGenerationRequest(
                studentInfo: studentInfo.trimmingCharacters(in: .whitespacesAndNewlines),
                requiredFoods: requiredFoods.trimmingCharacters(in: .whitespacesAndNewlines),
                mealCount: mealCount
            ))
        } catch { self.error = error.localizedDescription }
    }
}

private struct MacroBadge: View {
    let value: Int
    let unit: String
    let tint: Color

    var body: some View {
        VStack(spacing: 2) {
            Text("\(value)").font(.subheadline.bold()).foregroundStyle(tint)
            Text(unit).font(.caption2).foregroundStyle(FitTheme.secondaryText)
        }
        .frame(maxWidth: .infinity)
    }
}

private struct FoodEditorRow: View {
    @Binding var food: EditableDietFood

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(food.name).font(.subheadline.weight(.semibold))
            HStack(spacing: 8) {
                TextField(DietPlanEditorView.usesUnits(name: food.name, portion: food.portion) ? "2" : "150", text: $food.quantity)
                    .keyboardType(.decimalPad)
                    .frame(width: 76)
                    .textFieldStyle(.roundedBorder)
                    .font(.caption)
                Text(DietPlanEditorView.displayUnit(name: food.name, portion: food.portion))
                    .font(.caption)
                    .foregroundStyle(FitTheme.secondaryText)
                Spacer()
                Text("\(Int((food.calories * DietPlanEditorView.nutritionFactor(food.quantity, name: food.name, portion: food.portion)).rounded())) kcal")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(FitTheme.orange)
            }
            if !food.notes.isEmpty {
                Text(food.notes.localizedCaseInsensitiveContains(" x ") || food.notes.contains("×") ? "Substituição equivalente disponível" : food.notes)
                    .font(.caption2).foregroundStyle(FitTheme.secondaryText).lineLimit(2)
            }
        }
        .padding(.vertical, 3)
    }
}

struct FoodPickerView: View {
    @Environment(\.apiClient) private var api
    @Environment(\.dismiss) private var dismiss

    let onSelect: (FoodSearchItem) -> Void

    @State private var query = ""
    @State private var foods: [FoodSearchItem] = []
    @State private var loading = false
    @State private var error: String?
    @State private var showCustomFood = false

    var body: some View {
        NavigationStack {
            Group {
                if query.count < 2 {
                    ContentUnavailableView("Buscar alimentos", systemImage: "magnifyingglass", description: Text("Digite pelo menos 2 letras para buscar na tabela de alimentos."))
                } else if loading && foods.isEmpty {
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let error {
                    ContentUnavailableView("Erro", systemImage: "exclamationmark.triangle", description: Text(error))
                } else if foods.isEmpty {
                    ContentUnavailableView("Nenhum alimento", systemImage: "fork.knife", description: Text("Nenhum resultado para \"\(query)\"."))
                } else {
                    List(foods) { food in
                        Button {
                            onSelect(food)
                            dismiss()
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(food.name).font(.subheadline.weight(.semibold)).foregroundStyle(FitTheme.primaryText)
                                HStack(spacing: 8) {
                                    Text(food.portion ?? "100g")
                                    Text("· \(Int(food.calories?.value ?? 0)) kcal")
                                    Text("· \(Int(food.protein?.value ?? 0))g prot")
                                }
                                .font(.caption2).foregroundStyle(FitTheme.secondaryText)
                            }
                        }
                        .listRowBackground(FitTheme.surface)
                    }
                    .scrollContentBackground(.hidden)
                }
            }
            .fitScreen()
            .navigationTitle("Alimentos")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $query, prompt: "Buscar alimento")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Fechar") { dismiss() } }
                ToolbarItem(placement: .primaryAction) {
                    Button { showCustomFood = true } label: { Label("Novo alimento", systemImage: "plus") }
                }
            }
            .sheet(isPresented: $showCustomFood) {
                CustomFoodFormView { food in
                    onSelect(food)
                    dismiss()
                }
            }
            .task(id: query) {
                guard query.count >= 2 else { return }
                try? await Task.sleep(for: .milliseconds(350))
                guard !Task.isCancelled else { return }
                await search()
            }
        }
    }

    private func search() async {
        loading = true
        defer { loading = false }
        do {
            let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query
            foods = try await api.get("/api/foods/search?q=\(encoded)")
            error = nil
        } catch { self.error = error.localizedDescription }
    }
}

private struct CustomFoodFormView: View {
    @Environment(\.apiClient) private var api
    @Environment(\.dismiss) private var dismiss
    let onSaved: (FoodSearchItem) -> Void

    @State private var name = ""
    @State private var portion = "100g"
    @State private var calories = ""
    @State private var protein = ""
    @State private var carbs = ""
    @State private var fat = ""
    @State private var saving = false
    @State private var error: String?

    private var values: (calories: Double, protein: Double, carbs: Double, fat: Double)? {
        let normalized = [calories, protein, carbs, fat].map { Double($0.replacingOccurrences(of: ",", with: ".")) }
        guard normalized.allSatisfy({ $0 != nil && $0! >= 0 }) else { return nil }
        return (normalized[0]!, normalized[1]!, normalized[2]!, normalized[3]!)
    }

    private var valid: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !portion.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && values != nil
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Alimento") {
                    TextField("Nome", text: $name)
                    TextField("Porção de referência (ex.: 100g)", text: $portion)
                }
                .listRowBackground(FitTheme.surface)

                Section("Informação nutricional da porção") {
                    NutritionInputRow(title: "Calorias", value: $calories, unit: "kcal")
                    NutritionInputRow(title: "Proteínas", value: $protein, unit: "g")
                    NutritionInputRow(title: "Carboidratos", value: $carbs, unit: "g")
                    NutritionInputRow(title: "Gorduras", value: $fat, unit: "g")
                }
                .listRowBackground(FitTheme.surface)

                if let error {
                    Section { Text(error).font(.caption).foregroundStyle(.red) }
                        .listRowBackground(FitTheme.surface)
                }
            }
            .scrollContentBackground(.hidden).fitScreen()
            .navigationTitle("Novo alimento").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(saving ? "Salvando…" : "Salvar") { Task { await save() } }
                        .disabled(!valid || saving)
                        .fontWeight(.semibold)
                }
            }
        }
    }

    private func save() async {
        guard let values else { return }
        saving = true
        defer { saving = false }
        struct Body: Encodable {
            let name: String
            let portion: String
            let calories: Double
            let protein: Double
            let carbs: Double
            let fat: Double
        }
        do {
            let food: FoodSearchItem = try await api.post("/api/foods", body: Body(
                name: name.trimmingCharacters(in: .whitespacesAndNewlines),
                portion: portion.trimmingCharacters(in: .whitespacesAndNewlines),
                calories: values.calories,
                protein: values.protein,
                carbs: values.carbs,
                fat: values.fat
            ))
            onSaved(food)
            dismiss()
        } catch { self.error = error.localizedDescription }
    }
}

private struct NutritionInputRow: View {
    let title: String
    @Binding var value: String
    let unit: String

    var body: some View {
        HStack {
            Text(title)
            Spacer()
            TextField("0", text: $value)
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .frame(width: 85)
            Text(unit).foregroundStyle(FitTheme.secondaryText)
        }
    }
}
