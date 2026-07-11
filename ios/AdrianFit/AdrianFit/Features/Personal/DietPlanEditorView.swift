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
    @State private var confirmGenerate = false
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
                    .disabled(saving || loading || generating)
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
        .confirmationDialog(
            "Gerar dieta automática?",
            isPresented: $confirmGenerate,
            titleVisibility: .visible
        ) {
            Button("Substituir refeições atuais", role: .destructive) { Task { await generate() } }
            Button("Cancelar", role: .cancel) {}
        } message: {
            Text("As refeições atuais serão substituídas por um plano gerado a partir dos dados e restrições do aluno.")
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
                let qty = Self.numericQuantity(food.quantity)
                cal += food.calories * qty
                prot += food.protein * qty
                carb += food.carbs * qty
                fat += food.fat * qty
            }
        }
        return (Int(cal.rounded()), Int(prot.rounded()), Int(carb.rounded()), Int(fat.rounded()))
    }

    static func numericQuantity(_ text: String) -> Double {
        let normalized = text.replacingOccurrences(of: ",", with: ".")
        let prefix = normalized.prefix { "0123456789.".contains($0) }
        let value = Double(prefix) ?? 1
        return value > 0 ? value : 1
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
                    confirmGenerate = true
                } label: {
                    Label(generating ? "Gerando…" : "Gerar dieta automática", systemImage: "wand.and.stars")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                }
                .disabled(generating)
                .foregroundStyle(FitTheme.orange)
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
            quantity: "1",
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
                            quantity: raw.quantity?.value ?? "1",
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

    private func generate() async {
        generating = true
        defer { generating = false }
        struct GenerateBody: Encodable { let studentId: String }
        guard let targetStudentId = resolvedStudentId ?? studentId else {
            error = "Não foi possível identificar o aluno deste plano."
            return
        }
        do {
            let plan: GeneratedDietPlan = try await api.post("/api/diets/generate", body: GenerateBody(studentId: targetStudentId))
            meals = plan.meals.map { meal in
                EditableDietMeal(
                    name: meal.name,
                    time: meal.time,
                    notes: "",
                    foods: meal.foods.map { food in
                        EditableDietFood(
                            foodId: food.foodId,
                            name: food.name,
                            quantity: food.quantity == food.quantity.rounded()
                                ? String(Int(food.quantity))
                                : String(food.quantity).replacingOccurrences(of: ".", with: ","),
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
                            quantity: food.quantity,
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
                TextField("1", text: $food.quantity)
                    .frame(width: 56)
                    .textFieldStyle(.roundedBorder)
                    .font(.caption)
                Text("× \(food.portion.isEmpty ? "porção" : food.portion)")
                    .font(.caption)
                    .foregroundStyle(FitTheme.secondaryText)
                Spacer()
                Text("\(Int((food.calories * DietPlanEditorView.numericQuantity(food.quantity)).rounded())) kcal")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(FitTheme.orange)
            }
            if !food.notes.isEmpty {
                Text(food.notes).font(.caption2).foregroundStyle(FitTheme.secondaryText).lineLimit(2)
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
                                Text(food.name).font(.subheadline.weight(.semibold)).foregroundStyle(.white)
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
