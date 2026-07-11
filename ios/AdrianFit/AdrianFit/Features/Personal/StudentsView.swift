import SwiftUI

struct StudentsView: View {
    @Environment(\.apiClient) private var api
    @State private var students: [StudentListItem] = []
    @State private var query = ""
    @State private var error: String?

    private var filtered: [StudentListItem] {
        query.isEmpty ? students : students.filter { $0.user.name.localizedCaseInsensitiveContains(query) || $0.user.email.localizedCaseInsensitiveContains(query) }
    }

    var body: some View {
        Group {
            if let error, students.isEmpty { ContentUnavailableView("Alunos indisponíveis", systemImage: "person.2.slash", description: Text(error)) }
            else {
                List(filtered) { student in
                    NavigationLink { StudentDetailView(student: student) } label: { StudentRow(student: student) }
                        .listRowBackground(FitTheme.surface).listRowSeparatorTint(Color.white.opacity(0.08))
                }.scrollContentBackground(.hidden)
            }
        }
        .fitScreen().navigationTitle("Alunos")
        .searchable(text: $query, prompt: "Nome ou e-mail")
        .refreshable { await load() }.task { await load() }
    }

    private func load() async { do { students = try await api.get("/api/students"); error = nil } catch { self.error = error.localizedDescription } }
}

private struct StudentRow: View {
    let student: StudentListItem
    var body: some View {
        HStack(spacing: 13) {
            Circle().fill(FitTheme.orange.opacity(0.16)).frame(width: 48, height: 48)
                .overlay { Text(student.user.name.prefix(1)).font(.headline).foregroundStyle(FitTheme.orange) }
            VStack(alignment: .leading, spacing: 5) {
                Text(student.user.name).font(.headline)
                HStack(spacing: 8) {
                    Label(student.workoutPlans.isEmpty ? "Sem treino" : "Treino ativo", systemImage: "dumbbell")
                    Label(student.dietPlans.isEmpty ? "Sem dieta" : "Dieta ativa", systemImage: "fork.knife")
                }.font(.caption2).foregroundStyle(FitTheme.secondaryText)
            }
        }.padding(.vertical, 6)
    }
}

private enum StudentEditorRoute: Hashable {
    case workout(planId: String)
    case diet(planId: String, studentId: String)
}

private struct StudentDetailView: View {
    @Environment(\.apiClient) private var api
    let student: StudentListItem

    @State private var workoutPlan: PlanSummary?
    @State private var dietPlan: PlanSummary?
    @State private var route: StudentEditorRoute?
    @State private var creating = false
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                Circle().fill(FitTheme.orange.opacity(0.16)).frame(width: 86, height: 86)
                    .overlay { Text(student.user.name.prefix(1)).font(.largeTitle.bold()).foregroundStyle(FitTheme.orange) }
                Text(student.user.name).font(.title2.bold()); Text(student.user.email).foregroundStyle(FitTheme.secondaryText)
                HStack(spacing: 12) {
                    MetricPill(icon: "scalemass", value: student.weight.map { "\(Int($0)) kg" } ?? "—", label: "peso")
                    MetricPill(icon: "target", value: student.goal ?? "—", label: "objetivo", tint: FitTheme.green)
                }

                SurfaceCard {
                    VStack(alignment: .leading, spacing: 14) {
                        SectionHeading(title: "Treino")
                        Label(workoutPlan?.title ?? "Sem treino ativo", systemImage: "dumbbell.fill")
                        Button {
                            Task { await openWorkoutEditor() }
                        } label: {
                            Label(workoutPlan == nil ? "Criar treino" : "Editar treino", systemImage: workoutPlan == nil ? "plus.circle.fill" : "pencil.circle.fill")
                                .font(.subheadline.weight(.semibold))
                        }
                        .foregroundStyle(FitTheme.orange)
                        .disabled(creating)
                    }
                }

                SurfaceCard {
                    VStack(alignment: .leading, spacing: 14) {
                        SectionHeading(title: "Dieta")
                        Label(dietPlan?.title ?? "Sem dieta ativa", systemImage: "fork.knife")
                        Button {
                            Task { await openDietEditor() }
                        } label: {
                            Label(dietPlan == nil ? "Criar dieta" : "Editar dieta", systemImage: dietPlan == nil ? "plus.circle.fill" : "pencil.circle.fill")
                                .font(.subheadline.weight(.semibold))
                        }
                        .foregroundStyle(FitTheme.orange)
                        .disabled(creating)
                    }
                }

                SurfaceCard {
                    VStack(alignment: .leading, spacing: 14) {
                        SectionHeading(title: "Acompanhamento")
                        if let checkin = student.checkins.first {
                            Label("Último peso: \(Int(checkin.weight)) kg", systemImage: "chart.line.uptrend.xyaxis")
                            Label("Adesão treino: \(checkin.workoutAdherence)% · dieta: \(checkin.dietAdherence)%", systemImage: "checkmark.seal")
                        } else {
                            Label("Sem check-ins registrados", systemImage: "chart.line.uptrend.xyaxis")
                        }
                    }
                }

                NavigationLink { ConversationView(contactId: student.user.id, contactName: student.user.name) } label: {
                    Label("Conversar com aluno", systemImage: "message.fill").frame(maxWidth: .infinity).frame(height: 52)
                        .background(FitTheme.orange, in: RoundedRectangle(cornerRadius: 17)).foregroundStyle(.white).font(.headline)
                }
            }.padding(20)
        }
        .fitScreen().navigationTitle("Aluno").navigationBarTitleDisplayMode(.inline)
        .onAppear {
            if workoutPlan == nil { workoutPlan = student.workoutPlans.first }
            if dietPlan == nil { dietPlan = student.dietPlans.first }
        }
        .navigationDestination(item: $route) { route in
            switch route {
            case .workout(let planId): WorkoutPlanEditorView(planId: planId)
            case .diet(let planId, let studentId): DietPlanEditorView(planId: planId, studentId: studentId)
            }
        }
        .alert("Erro", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) {
            Button("OK", role: .cancel) {}
        } message: { Text(error ?? "") }
    }

    private func openWorkoutEditor() async {
        if let plan = workoutPlan { route = .workout(planId: plan.id); return }
        creating = true
        defer { creating = false }
        let body = WorkoutPlanCreateBody(
            title: "Treino de \(student.user.name.split(separator: " ").first.map(String.init) ?? student.user.name)",
            studentId: student.id,
            startDate: Self.isoDate(daysFromNow: 0),
            endDate: Self.isoDate(daysFromNow: 90),
            active: true,
            workoutDays: []
        )
        do {
            let created: WorkoutPlanDetail = try await api.post("/api/workout-plans", body: body)
            workoutPlan = PlanSummary(id: created.id, title: created.title)
            route = .workout(planId: created.id)
        } catch { self.error = error.localizedDescription }
    }

    private func openDietEditor() async {
        if let plan = dietPlan { route = .diet(planId: plan.id, studentId: student.id); return }
        creating = true
        defer { creating = false }
        let body = DietPlanCreateBody(
            title: "Dieta de \(student.user.name.split(separator: " ").first.map(String.init) ?? student.user.name)",
            studentId: student.id,
            startDate: Self.isoDate(daysFromNow: 0),
            endDate: Self.isoDate(daysFromNow: 90),
            active: true,
            meals: []
        )
        do {
            // POST /api/diet-plans devolve o objeto direto, sem envelope.
            let created: IdentifiedValue = try await api.postRaw("/api/diet-plans", body: body)
            dietPlan = PlanSummary(id: created.id, title: body.title)
            route = .diet(planId: created.id, studentId: student.id)
        } catch { self.error = error.localizedDescription }
    }

    private static func isoDate(daysFromNow days: Int) -> String {
        let date = Calendar.current.date(byAdding: .day, value: days, to: .now) ?? .now
        return ISO8601DateFormatter().string(from: date)
    }
}
