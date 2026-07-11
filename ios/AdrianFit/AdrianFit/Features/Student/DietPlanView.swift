import SwiftUI

struct DietPlanView: View {
    @Environment(\.apiClient) private var api
    @State private var plan: DietPlan?
    @State private var expanded: Set<String> = []
    @State private var error: String?

    var body: some View {
        Group {
            if let plan {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 16) {
                        Text(plan.title).font(.largeTitle.bold())
                        HStack(spacing: 10) {
                            MacroBadge(value: plan.calories, unit: "kcal", color: FitTheme.orange)
                            MacroBadge(value: plan.protein, unit: "g proteína", color: FitTheme.blue)
                            MacroBadge(value: plan.carbs, unit: "g carbo", color: FitTheme.green)
                        }
                        ForEach(plan.meals) { meal in mealCard(meal) }
                    }.padding(20)
                }
            } else if let error { ContentUnavailableView("Dieta indisponível", systemImage: "fork.knife", description: Text(error)) }
            else { ProgressView() }
        }
        .fitScreen().navigationTitle("Minha dieta").navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func mealCard(_ meal: DietMeal) -> some View {
        let isExpanded = expanded.contains(meal.id)
        return SurfaceCard {
            VStack(spacing: 14) {
                Button { withAnimation(.snappy) { toggle(meal.id) } } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(meal.name).font(.headline).foregroundStyle(.white)
                            Label(meal.time, systemImage: "clock").font(.caption).foregroundStyle(FitTheme.secondaryText)
                        }
                        Spacer()
                        if let calories = meal.calories { Text("\(calories) kcal").font(.caption.bold()).foregroundStyle(FitTheme.orange) }
                        Image(systemName: "chevron.down").rotationEffect(.degrees(isExpanded ? 180 : 0)).foregroundStyle(FitTheme.secondaryText)
                    }
                }.buttonStyle(.plain)
                if isExpanded {
                    Divider().overlay(Color.white.opacity(0.08))
                    ForEach(meal.foods) { food in
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
                    }
                }
            }
        }
    }

    private func portionText(_ food: DietFood) -> String {
        let quantity = food.quantity?.value ?? 1
        let formatted = quantity.rounded() == quantity ? String(Int(quantity)) : String(format: "%.1f", quantity)
        return "\(formatted) × \(food.portion ?? "porção")"
    }
    private func toggle(_ id: String) { if expanded.contains(id) { expanded.remove(id) } else { expanded.insert(id) } }
    private func load() async { do { plan = try await api.get("/api/student/diet"); expanded = Set(plan?.meals.prefix(1).map(\.id) ?? []) } catch { self.error = error.localizedDescription } }
}

private struct MacroBadge: View {
    let value: Int?
    let unit: String
    let color: Color
    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text("\(value ?? 0)").font(.headline)
            Text(unit).font(.caption2).foregroundStyle(FitTheme.secondaryText)
        }.padding(12).frame(maxWidth: .infinity, alignment: .leading).background(color.opacity(0.12), in: RoundedRectangle(cornerRadius: 16))
    }
}
