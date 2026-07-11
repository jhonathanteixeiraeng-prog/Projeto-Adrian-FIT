import SwiftUI

struct DietPlanView: View {
    @Environment(\.apiClient) private var api
    @State private var plan: DietPlan?
    @State private var expanded: Set<String> = []
    @State private var completedIds: Set<String> = []
    @State private var error: String?
    @State private var lastCompleted: String?

    var body: some View {
        Group {
            if let plan {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 16) {
                        Text(plan.title).font(.largeTitle.bold())
                        dayProgress(plan)
                        SectionHeading(title: "Refeições de hoje")
                        ForEach(plan.meals) { meal in mealCard(meal) }
                    }.padding(20)
                }
            } else if let error { ContentUnavailableView("Dieta indisponível", systemImage: "fork.knife", description: Text(error)) }
            else { ProgressView() }
        }
        .fitScreen().navigationTitle("Minha dieta").navigationBarTitleDisplayMode(.inline)
        .sensoryFeedback(.success, trigger: lastCompleted)
        .task { await load() }
        .refreshable { await load() }
    }

    // MARK: - Anel do dia

    private struct DayTotals {
        var calories = 0.0, protein = 0.0, carbs = 0.0, fat = 0.0
    }

    private func totals(of meal: DietMeal) -> DayTotals {
        var result = DayTotals()
        for food in meal.foods {
            let qty = food.quantity?.value ?? 1
            result.calories += (food.calories?.value ?? 0) * qty
            result.protein += (food.protein?.value ?? 0) * qty
            result.carbs += (food.carbs?.value ?? 0) * qty
            result.fat += (food.fat?.value ?? 0) * qty
        }
        return result
    }

    private func consumed(_ plan: DietPlan) -> DayTotals {
        plan.meals.filter { completedIds.contains($0.id) }.reduce(into: DayTotals()) { acc, meal in
            let t = totals(of: meal)
            acc.calories += t.calories; acc.protein += t.protein
            acc.carbs += t.carbs; acc.fat += t.fat
        }
    }

    private func planTotal(_ plan: DietPlan) -> DayTotals {
        plan.meals.reduce(into: DayTotals()) { acc, meal in
            let t = totals(of: meal)
            acc.calories += t.calories; acc.protein += t.protein
            acc.carbs += t.carbs; acc.fat += t.fat
        }
    }

    private func dayProgress(_ plan: DietPlan) -> some View {
        let eaten = consumed(plan)
        let target = planTotal(plan)
        let targetCalories = Double(plan.calories ?? 0) > 0 ? Double(plan.calories!) : target.calories
        let fraction = targetCalories > 0 ? min(eaten.calories / targetCalories, 1) : 0

        return SurfaceCard {
            HStack(spacing: 22) {
                ZStack {
                    Circle().stroke(Color.white.opacity(0.09), lineWidth: 11)
                    Circle()
                        .trim(from: 0, to: fraction)
                        .stroke(FitTheme.orange, style: StrokeStyle(lineWidth: 11, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .animation(.snappy, value: fraction)
                    VStack(spacing: 2) {
                        Text("\(Int(eaten.calories.rounded()))")
                            .font(.title3.bold()).monospacedDigit()
                        Text("de \(Int(targetCalories.rounded()))")
                            .font(.caption2).foregroundStyle(FitTheme.secondaryText)
                    }
                }
                .frame(width: 108, height: 108)

                VStack(alignment: .leading, spacing: 10) {
                    Text("Consumido hoje").font(.subheadline.weight(.semibold))
                    MacroLine(label: "Proteína", value: eaten.protein, target: target.protein, tint: FitTheme.green)
                    MacroLine(label: "Carbo", value: eaten.carbs, target: target.carbs, tint: FitTheme.blue)
                    MacroLine(label: "Gordura", value: eaten.fat, target: target.fat, tint: FitTheme.orangeSoft)
                }
            }
        }
    }

    // MARK: - Refeições

    private func mealCard(_ meal: DietMeal) -> some View {
        let isExpanded = expanded.contains(meal.id)
        let isCompleted = completedIds.contains(meal.id)
        let mealCalories = Int(totals(of: meal).calories.rounded())

        return SurfaceCard {
            VStack(spacing: 14) {
                HStack(spacing: 13) {
                    Button {
                        Task { await toggleCompleted(meal) }
                    } label: {
                        Image(systemName: isCompleted ? "checkmark.circle.fill" : "circle")
                            .font(.title2)
                            .foregroundStyle(isCompleted ? FitTheme.green : FitTheme.secondaryText)
                    }
                    .buttonStyle(.plain)

                    Button { withAnimation(.snappy) { toggle(meal.id) } } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(meal.name)
                                    .font(.headline)
                                    .foregroundStyle(isCompleted ? FitTheme.secondaryText : .white)
                                    .strikethrough(isCompleted, color: FitTheme.secondaryText)
                                Label(meal.time, systemImage: "clock").font(.caption).foregroundStyle(FitTheme.secondaryText)
                            }
                            Spacer()
                            Text("\(mealCalories) kcal").font(.caption.bold()).foregroundStyle(FitTheme.orange)
                            Image(systemName: "chevron.down").rotationEffect(.degrees(isExpanded ? 180 : 0)).foregroundStyle(FitTheme.secondaryText)
                        }
                        .contentShape(Rectangle())
                    }.buttonStyle(.plain)
                }
                if isExpanded {
                    Divider().overlay(Color.white.opacity(0.08))
                    ForEach(meal.foods) { food in
                        VStack(alignment: .leading, spacing: 5) {
                            HStack(alignment: .top) {
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(food.name).font(.subheadline.weight(.semibold))
                                    Text(portionText(food)).font(.caption).foregroundStyle(FitTheme.secondaryText)
                                }
                                Spacer()
                                if let calories = food.calories?.value, let quantity = food.quantity?.value {
                                    Text("\(Int(calories * quantity)) kcal").font(.caption).foregroundStyle(FitTheme.secondaryText)
                                }
                            }
                            if let substitution = food.substitutionText {
                                Label(substitution, systemImage: "arrow.triangle.2.circlepath")
                                    .font(.caption2)
                                    .foregroundStyle(FitTheme.blue)
                                    .padding(.top, 1)
                            }
                        }
                    }
                }
            }
        }
        .opacity(isCompleted && !isExpanded ? 0.75 : 1)
    }

    private func portionText(_ food: DietFood) -> String {
        let quantity = food.quantity?.value ?? 1
        let formatted = quantity.rounded() == quantity ? String(Int(quantity)) : String(format: "%.1f", quantity)
        return "\(formatted) × \(food.portion ?? "porção")"
    }

    private func toggle(_ id: String) { if expanded.contains(id) { expanded.remove(id) } else { expanded.insert(id) } }

    private func toggleCompleted(_ meal: DietMeal) async {
        let marking = !completedIds.contains(meal.id)
        // Atualização otimista
        withAnimation(.snappy) {
            if marking { completedIds.insert(meal.id) } else { completedIds.remove(meal.id) }
        }
        if marking { lastCompleted = meal.id }

        struct Body: Encodable { let mealId: String; let completed: Bool }
        struct Result: Codable { let mealId: String; let completed: Bool }
        do {
            let _: Result = try await api.post("/api/student/diet/complete", body: Body(mealId: meal.id, completed: marking))
        } catch {
            // Reverte se o servidor recusar
            withAnimation(.snappy) {
                if marking { completedIds.remove(meal.id) } else { completedIds.insert(meal.id) }
            }
        }
    }

    private func load() async {
        do {
            plan = try await api.get("/api/student/diet")
            expanded = Set(plan?.meals.prefix(1).map(\.id) ?? [])
            completedIds = Set(plan?.meals.filter { $0.completed == true }.map(\.id) ?? [])
        } catch { self.error = error.localizedDescription }
    }
}

private struct MacroLine: View {
    let label: String
    let value: Double
    let target: Double
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(label).font(.caption)
                Spacer()
                Text("\(Int(value.rounded()))/\(Int(target.rounded()))g")
                    .font(.caption.monospacedDigit()).foregroundStyle(FitTheme.secondaryText)
            }
            ProgressView(value: min(value, target), total: max(target, 1))
                .tint(tint)
        }
    }
}
