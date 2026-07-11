import SwiftUI

struct PlansHubView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("Crie e acompanhe planos sem perder o contexto do aluno.")
                    .foregroundStyle(FitTheme.secondaryText)

                NavigationLink { WorkoutPlansListView() } label: {
                    PlanCard(icon: "dumbbell.fill", title: "Planos de treino", subtitle: "Séries, repetições, descanso e vídeos", color: FitTheme.orange)
                }
                NavigationLink { DietPlansListView() } label: {
                    PlanCard(icon: "fork.knife", title: "Planos alimentares", subtitle: "Refeições, macros e substituições", color: FitTheme.green)
                }
                NavigationLink { TemplatesListView() } label: {
                    PlanCard(icon: "square.stack.3d.up.fill", title: "Modelos", subtitle: "Reutilize estruturas que funcionam", color: FitTheme.blue)
                }
            }.padding(20)
        }
        .fitScreen()
        .navigationTitle("Planos")
    }
}

private struct PlanCard: View {
    let icon: String
    let title: String
    let subtitle: String
    let color: Color

    var body: some View {
        SurfaceCard {
            HStack(spacing: 16) {
                RoundedRectangle(cornerRadius: 16)
                    .fill(color.opacity(0.14))
                    .frame(width: 54, height: 54)
                    .overlay { Image(systemName: icon).font(.title2).foregroundStyle(color) }
                VStack(alignment: .leading, spacing: 5) {
                    Text(title).font(.headline).foregroundStyle(.white)
                    Text(subtitle).font(.caption).foregroundStyle(FitTheme.secondaryText)
                }
                Spacer()
                Image(systemName: "chevron.right").foregroundStyle(FitTheme.secondaryText)
            }.contentShape(Rectangle())
        }
    }
}

private struct WorkoutPlansListView: View {
    @Environment(\.apiClient) private var api
    @State private var plans: [PersonalWorkoutPlan] = []
    @State private var error: String?
    @State private var loading = true

    var body: some View {
        AsyncPlanList(title: "Planos de treino", icon: "dumbbell", loading: loading, isEmpty: plans.isEmpty, error: error) {
            ForEach(plans) { plan in
                NavigationLink { WorkoutPlanSummaryView(plan: plan) } label: {
                    PlanListRow(title: plan.title, student: plan.student.user.name, detail: "\(plan.count?.workoutDays ?? 0) dias de treino", active: plan.active, color: FitTheme.orange)
                }
            }
        }
        .task { await load() }
        .refreshable { await load() }
    }

    private func load() async {
        loading = plans.isEmpty
        defer { loading = false }
        do { plans = try await api.get("/api/workout-plans"); error = nil }
        catch { self.error = error.localizedDescription }
    }
}

private struct DietPlansListView: View {
    @Environment(\.apiClient) private var api
    @State private var plans: [PersonalDietPlan] = []
    @State private var error: String?
    @State private var loading = true

    var body: some View {
        AsyncPlanList(title: "Planos alimentares", icon: "fork.knife", loading: loading, isEmpty: plans.isEmpty, error: error) {
            ForEach(plans) { plan in
                NavigationLink { DietPlanSummaryView(plan: plan) } label: {
                    PlanListRow(title: plan.title, student: plan.student.user.name, detail: "\(plan.meals.count) refeições • \(plan.calories ?? 0) kcal", active: plan.active, color: FitTheme.green)
                }
            }
        }
        .task { await load() }
        .refreshable { await load() }
    }

    private func load() async {
        loading = plans.isEmpty
        defer { loading = false }
        do { plans = try await api.get("/api/diets"); error = nil }
        catch { self.error = error.localizedDescription }
    }
}

private struct TemplatesListView: View {
    @Environment(\.apiClient) private var api
    @State private var workouts: [WorkoutTemplateSummary] = []
    @State private var diets: [DietTemplateSummary] = []
    @State private var error: String?
    @State private var loading = true

    var body: some View {
        Group {
            if loading { ProgressView() }
            else if workouts.isEmpty && diets.isEmpty, let error {
                ContentUnavailableView("Modelos indisponíveis", systemImage: "square.stack.3d.up.slash", description: Text(error))
            } else {
                List {
                    if !workouts.isEmpty {
                        Section("TREINOS") {
                            ForEach(workouts) { template in
                                NavigationLink { WorkoutTemplateDetailView(template: template) } label: {
                                    PlanListRow(title: template.title, student: "Modelo de treino", detail: "\(template.templateDays.count) dias", active: true, color: FitTheme.blue)
                                }
                            }
                        }
                    }
                    if !diets.isEmpty {
                        Section("ALIMENTAÇÃO") {
                            ForEach(diets) { template in
                                NavigationLink { DietTemplateDetailView(template: template) } label: {
                                    PlanListRow(title: template.title, student: "Modelo alimentar", detail: "\(template.meals.count) refeições", active: true, color: FitTheme.green)
                                }
                            }
                        }
                    }
                }.scrollContentBackground(.hidden)
            }
        }
        .fitScreen().navigationTitle("Modelos")
        .task { await load() }.refreshable { await load() }
    }

    private func load() async {
        loading = workouts.isEmpty && diets.isEmpty
        defer { loading = false }
        do {
            async let workoutRequest: [WorkoutTemplateSummary] = api.get("/api/workout-templates")
            async let dietRequest: [DietTemplateSummary] = api.get("/api/diet-templates")
            (workouts, diets) = try await (workoutRequest, dietRequest)
            error = nil
        } catch { self.error = error.localizedDescription }
    }
}

private struct AsyncPlanList<Content: View>: View {
    let title: String
    let icon: String
    let loading: Bool
    let isEmpty: Bool
    let error: String?
    @ViewBuilder let content: Content

    var body: some View {
        Group {
            if loading { ProgressView() }
            else if isEmpty {
                ContentUnavailableView(error == nil ? "Nenhum plano" : "Planos indisponíveis", systemImage: icon, description: Text(error ?? "Os planos criados aparecerão aqui."))
            } else {
                List { content }.scrollContentBackground(.hidden)
            }
        }.fitScreen().navigationTitle(title)
    }
}

private struct PlanListRow: View {
    let title: String
    let student: String
    let detail: String
    let active: Bool
    let color: Color

    var body: some View {
        HStack(spacing: 13) {
            Circle().fill(color.opacity(0.14)).frame(width: 44, height: 44)
                .overlay { Image(systemName: active ? "checkmark" : "pause").foregroundStyle(color) }
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.headline).foregroundStyle(.white)
                Text(student).font(.caption).foregroundStyle(FitTheme.secondaryText)
                Text(detail).font(.caption2).foregroundStyle(color)
            }
        }.padding(.vertical, 6)
    }
}

private struct WorkoutPlanSummaryView: View {
    let plan: PersonalWorkoutPlan
    var body: some View {
        PlanSummaryScreen(title: plan.title, person: plan.student.user.name, icon: "dumbbell.fill", color: FitTheme.orange) {
            SummaryMetric(label: "Dias de treino", value: "\(plan.count?.workoutDays ?? 0)")
            SummaryMetric(label: "Versão", value: "\(plan.version)")
            SummaryMetric(label: "Status", value: plan.active ? "Ativo" : "Pausado")
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                NavigationLink("Editar") { WorkoutPlanEditorView(planId: plan.id) }
                    .fontWeight(.semibold)
            }
        }
    }
}

private struct DietPlanSummaryView: View {
    let plan: PersonalDietPlan
    var body: some View {
        PlanSummaryScreen(title: plan.title, person: plan.student.user.name, icon: "fork.knife", color: FitTheme.green) {
            SummaryMetric(label: "Energia", value: "\(plan.calories ?? 0) kcal")
            SummaryMetric(label: "Proteína", value: "\(plan.protein ?? 0) g")
            SummaryMetric(label: "Refeições", value: "\(plan.meals.count)")
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                NavigationLink("Editar") { DietPlanEditorView(planId: plan.id) }
                    .fontWeight(.semibold)
            }
        }
    }
}

private struct WorkoutTemplateDetailView: View {
    let template: WorkoutTemplateSummary
    var body: some View {
        List {
            ForEach(template.templateDays) { day in
                Section(day.name) {
                    ForEach(day.items) { item in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(item.exercise?.name ?? "Exercício").font(.headline)
                            Text("\(item.sets) séries × \(item.reps) • \(item.rest)s").font(.caption).foregroundStyle(FitTheme.orange)
                        }.padding(.vertical, 4)
                    }
                }
            }
        }.scrollContentBackground(.hidden).fitScreen().navigationTitle(template.title)
    }
}

private struct DietTemplateDetailView: View {
    let template: DietTemplateSummary
    var body: some View {
        List {
            ForEach(template.meals) { meal in
                Section("\(meal.name) • \(meal.time)") {
                    ForEach(meal.items) { food in
                        HStack { Text(food.name); Spacer(); Text(food.portion ?? "porção").foregroundStyle(FitTheme.secondaryText) }
                    }
                }
            }
        }.scrollContentBackground(.hidden).fitScreen().navigationTitle(template.title)
    }
}

private struct PlanSummaryScreen<Content: View>: View {
    let title: String
    let person: String
    let icon: String
    let color: Color
    @ViewBuilder let content: Content

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                RoundedRectangle(cornerRadius: 22).fill(color.opacity(0.14)).frame(height: 130)
                    .overlay { Image(systemName: icon).font(.system(size: 46)).foregroundStyle(color) }
                Text(title).font(.largeTitle.bold())
                Label(person, systemImage: "person.fill").foregroundStyle(FitTheme.secondaryText)
                SurfaceCard { VStack(spacing: 0) { content } }
            }.padding(20)
        }.fitScreen().navigationBarTitleDisplayMode(.inline)
    }
}

private struct SummaryMetric: View {
    let label: String
    let value: String
    var body: some View {
        HStack { Text(label).foregroundStyle(FitTheme.secondaryText); Spacer(); Text(value).fontWeight(.semibold) }
            .padding(.vertical, 11)
    }
}
