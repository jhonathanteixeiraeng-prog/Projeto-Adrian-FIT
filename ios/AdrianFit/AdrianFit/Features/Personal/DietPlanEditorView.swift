import SwiftUI

struct DietPlanEditorView: View {
    @Environment(\.apiClient) private var api
    @Environment(\.dismiss) private var dismiss

    let planId: String
    let studentId: String?

    init(planId: String, studentId: String? = nil) {
        self.planId = planId
        self.studentId = studentId
    }

    @State private var title = ""
    @State private var meals: [EditableDietMeal] = []
    @State private var loading = true
    @State private var saving = false
    @State private var generating = false
    @State private var error: String?
    @State private var pickerMealId: UUID?
    @State private var showSaved = false
    @State private var showGenerationOptions = false
    @State private var resolvedStudentId: String?

    var body: some View {
        Group {
            if loading { ProgressView("Carregando dieta…").frame(maxWidth: .infinity, maxHeight: .infinity) }
            else if let error, meals.isEmpty && title.isEmpty {
                ContentUnavailableView("Dieta indisponível", systemImage: "fork.knife", description: Text(error))
            } else { editor }
        }
        .fitScreen()
        .navigationTitle("Editar dieta")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button(saving ? "Salvando…" : "Salvar") { Task { await save() } }
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
            DietGenerationOptionsView { targets in
                showGenerationOptions = false
                Task { await generate(targets: targets) }
            }
        }
        .alert("Dieta salva", isPresented: $showSaved) {
            Button("OK") { dismiss() }
        } message: { Text("As alterações já estão disponíveis para o aluno.") }
        .alert("Erro", isPresented: Binding(get: { error != nil && !loading && !(meals.isEmpty && title.isEmpty) }, set: { if !$0 { error = nil } })) {
            Button("OK", role: .cancel) {}
        } message: { Text(error ?? "") }
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
            let plan: DietPlanDetail = try await api.get("/api/diets/\(planId)")
            resolvedStudentId = plan.student?.id ?? studentId
            title = plan.title
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

    private func generate(targets: DietGenerationTargets) async {
        generating = true
        defer { generating = false }
        struct GenerateBody: Encodable {
            let studentId: String
            let calories: Int?
            let protein: Int?
            let carbs: Int?
            let fat: Int?
        }
        guard let targetStudentId = resolvedStudentId ?? studentId else {
            error = "Não foi possível identificar o aluno deste plano."
            return
        }
        do {
            let plan: GeneratedDietPlan = try await api.post("/api/diets/generate", body: GenerateBody(
                studentId: targetStudentId, calories: targets.calories, protein: targets.protein, carbs: targets.carbs, fat: targets.fat
            ))
            meals = plan.meals.map { meal in
                EditableDietMeal(
                    name: meal.name,
                    time: meal.time,
                    notes: "",
                    foods: meal.foods.map { food in
                        EditableDietFood(
                            foodId: food.foodId,
                            name: food.name,
                            quantity: Self.displayAmount(
                                canonicalQuantity: food.quantity == food.quantity.rounded() ? String(Int(food.quantity)) : String(food.quantity),
                                name: food.name, portion: food.portion
                            ),
                            portion: food.portion,
                            notes: food.substitutionNote ?? "",
                            calories: food.calories,
                            protein: food.protein,
                            carbs: food.carbs,
                            fat: food.fat
                        )
                    }
                )
            }
            if title.isEmpty { title = "Plano Gerado - \(plan.calories) kcal" }
            error = nil
        } catch { self.error = error.localizedDescription }
    }

    private func save() async {
        if let safetyIssue { error = safetyIssue; return }
        saving = true
        defer { saving = false }
        let totals = totals
        let body = DietPlanUpdateBody(
            title: title.isEmpty ? "Plano alimentar" : title,
            calories: totals.calories,
            protein: totals.protein,
            carbs: totals.carbs,
            fat: totals.fat,
            active: true,
            meals: meals.map { meal in
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
        )
        do {
            let _: DietPlanDetail = try await api.put("/api/diets/\(planId)", body: body)
            showSaved = true
        } catch { self.error = error.localizedDescription }
    }
}

private struct DietGenerationTargets {
    let calories: Int?
    let protein: Int?
    let carbs: Int?
    let fat: Int?
}

private struct DietGenerationOptionsView: View {
    @Environment(\.dismiss) private var dismiss
    let onGenerate: (DietGenerationTargets) -> Void

    @State private var custom = false
    @State private var calories = ""
    @State private var protein = ""
    @State private var carbs = ""
    @State private var fat = ""

    private var values: DietGenerationTargets {
        DietGenerationTargets(calories: Int(calories), protein: Int(protein), carbs: Int(carbs), fat: Int(fat))
    }

    private var validationMessage: String? {
        guard custom else { return nil }
        let targets = values
        if let value = targets.calories, !(800...6000).contains(value) { return "Calorias devem ficar entre 800 e 6.000 kcal." }
        if let value = targets.protein, !(20...400).contains(value) { return "Proteínas devem ficar entre 20 e 400 g." }
        if let value = targets.carbs, !(20...800).contains(value) { return "Carboidratos devem ficar entre 20 e 800 g." }
        if let value = targets.fat, !(10...300).contains(value) { return "Gorduras devem ficar entre 10 e 300 g." }
        if targets.calories == nil && targets.protein == nil && targets.carbs == nil && targets.fat == nil { return "Preencha ao menos uma meta ou use o cálculo automático." }
        if let kcal = targets.calories, let p = targets.protein, let c = targets.carbs, let f = targets.fat {
            let macroCalories = p * 4 + c * 4 + f * 9
            if Double(abs(macroCalories - kcal)) / Double(kcal) > 0.15 { return "Os macros não correspondem às calorias informadas (tolerância de 15%)." }
        }
        return nil
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Toggle("Definir metas manualmente", isOn: $custom)
                } footer: {
                    Text(custom ? "Preencha somente as metas que deseja controlar. As demais serão calculadas pelo sistema." : "O sistema calculará as metas usando peso, altura, idade, objetivo e nível de atividade do aluno.")
                }
                .listRowBackground(FitTheme.surface)

                if custom {
                    Section("Metas diárias") {
                        TargetInputRow(title: "Calorias", unit: "kcal", text: $calories)
                        TargetInputRow(title: "Proteínas", unit: "g", text: $protein)
                        TargetInputRow(title: "Carboidratos", unit: "g", text: $carbs)
                        TargetInputRow(title: "Gorduras", unit: "g", text: $fat)
                    }
                    .listRowBackground(FitTheme.surface)
                    if let validationMessage {
                        Section { Label(validationMessage, systemImage: "exclamationmark.triangle.fill").font(.caption).foregroundStyle(.red) }
                            .listRowBackground(FitTheme.surface)
                    }
                }
            }
            .scrollContentBackground(.hidden).fitScreen()
            .navigationTitle("Gerar dieta").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Gerar") { onGenerate(custom ? values : DietGenerationTargets(calories: nil, protein: nil, carbs: nil, fat: nil)) }
                        .disabled(validationMessage != nil)
                        .fontWeight(.semibold)
                }
            }
        }
    }
}

private struct TargetInputRow: View {
    let title: String
    let unit: String
    @Binding var text: String
    var body: some View {
        HStack {
            Text(title)
            Spacer()
            TextField("Automático", text: $text).keyboardType(.numberPad).multilineTextAlignment(.trailing).frame(width: 100)
            Text(unit).foregroundStyle(FitTheme.secondaryText).frame(width: 34, alignment: .leading)
        }
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
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Fechar") { dismiss() } } }
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
