import SwiftUI

struct StudentsView: View {
    @Environment(\.apiClient) private var api
    @State private var students: [StudentListItem] = []
    @State private var query = ""
    @State private var error: String?
    @State private var pendingDelete: StudentListItem?

    private var filtered: [StudentListItem] {
        query.isEmpty ? students : students.filter { $0.user.name.localizedCaseInsensitiveContains(query) || $0.user.email.localizedCaseInsensitiveContains(query) }
    }

    @State private var showNewStudent = false

    var body: some View {
        Group {
            if let error, students.isEmpty { ContentUnavailableView("Alunos indisponíveis", systemImage: "person.2.slash", description: Text(error)) }
            else {
                List(filtered) { student in
                    NavigationLink { StudentDetailView(student: student) } label: { StudentRow(student: student) }
                        .listRowBackground(FitTheme.surface).listRowSeparatorTint(Color.white.opacity(0.08))
                        .swipeActions {
                            Button(role: .destructive) { pendingDelete = student } label: {
                                Label("Excluir", systemImage: "trash")
                            }
                        }
                }.scrollContentBackground(.hidden)
            }
        }
        .fitScreen().navigationTitle("Alunos")
        .searchable(text: $query, prompt: "Nome ou e-mail")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showNewStudent = true } label: {
                    Label("Novo aluno", systemImage: "person.badge.plus").fontWeight(.semibold)
                }
            }
        }
        .sheet(isPresented: $showNewStudent) {
            NewStudentFormView { Task { await load() } }
        }
        .confirmationDialog("Excluir aluno?", isPresented: Binding(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } }), titleVisibility: .visible) {
            Button("Excluir", role: .destructive) { Task { await deleteStudent() } }
            Button("Cancelar", role: .cancel) { pendingDelete = nil }
        } message: {
            Text("O cadastro, os planos e o histórico deste aluno serão removidos. Essa ação não pode ser desfeita.")
        }
        .refreshable { await load() }.task { await load() }
    }

    private func load() async { do { students = try await api.get("/api/students"); error = nil } catch { self.error = error.localizedDescription } }

    private func deleteStudent() async {
        guard let student = pendingDelete else { return }
        pendingDelete = nil
        do {
            try await api.delete("/api/students/\(student.id)")
            students.removeAll { $0.id == student.id }
            error = nil
        } catch { self.error = error.localizedDescription }
    }
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
    case newWorkout(studentId: String)
    case diet(planId: String, studentId: String)
    case newDiet(studentId: String)
}

private struct StudentDetailView: View {
    @Environment(\.apiClient) private var api
    let student: StudentListItem

    @State private var workoutPlan: PlanSummary?
    @State private var dietPlan: PlanSummary?
    @State private var route: StudentEditorRoute?
    @State private var creating = false
    @State private var error: String?
    @State private var showEditStudent = false
    @State private var fullStudent: StudentFull?

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
                        if let checkin = checkins.first {
                            Label("Último peso: \(Int(checkin.weight)) kg", systemImage: "chart.line.uptrend.xyaxis")
                            Label("Adesão treino: \(checkin.workoutAdherence)% · dieta: \(checkin.dietAdherence)%", systemImage: "checkmark.seal")
                        } else {
                            Label("Sem check-ins registrados", systemImage: "chart.line.uptrend.xyaxis")
                        }
                        Divider().overlay(FitTheme.separator.opacity(0.45))
                        NavigationLink { WorkoutHistoryView(studentId: student.id) } label: {
                            HStack {
                                Label("Ver histórico de treinos", systemImage: "clock.arrow.trianglehead.counterclockwise.rotate.90")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(FitTheme.orange)
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.caption)
                                    .foregroundStyle(FitTheme.secondaryText)
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }

                if !checkins.isEmpty {
                    SurfaceCard {
                        VStack(alignment: .leading, spacing: 0) {
                            SectionHeading(title: "Histórico de check-ins")
                                .padding(.bottom, 8)
                            ForEach(checkins) { checkin in
                                CheckinHistoryRow(checkin: checkin)
                                if checkin.id != checkins.last?.id {
                                    Divider().overlay(FitTheme.separator.opacity(0.45))
                                }
                            }
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
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("Editar") { showEditStudent = true }.fontWeight(.semibold)
            }
        }
        .sheet(isPresented: $showEditStudent) {
            EditStudentFormView(studentId: student.id) {
                Task { await loadDetails() }
            }
        }
        .onAppear {
            if workoutPlan == nil { workoutPlan = student.workoutPlans.first }
            if dietPlan == nil { dietPlan = student.dietPlans.first }
        }
        .navigationDestination(item: $route) { route in
            switch route {
            case .workout(let planId): WorkoutPlanEditorView(planId: planId)
            case .newWorkout(let studentId): WorkoutPlanEditorView(newFor: studentId)
            case .diet(let planId, let studentId): DietPlanEditorView(planId: planId, studentId: studentId)
            case .newDiet(let studentId): DietPlanEditorView(newFor: studentId)
            }
        }
        .alert("Erro", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) {
            Button("OK", role: .cancel) {}
        } message: { Text(error ?? "") }
        .task { await loadDetails() }
    }

    private var checkins: [CheckinSummary] {
        fullStudent?.checkins ?? student.checkins
    }

    private func openWorkoutEditor() async {
        if let plan = workoutPlan { route = .workout(planId: plan.id); return }
        route = .newWorkout(studentId: student.id)
    }

    private func openDietEditor() async {
        if let plan = dietPlan { route = .diet(planId: plan.id, studentId: student.id); return }
        route = .newDiet(studentId: student.id)
    }

    private func loadDetails() async {
        do {
            fullStudent = try await api.get("/api/students/\(student.id)")
            error = nil
        } catch { self.error = error.localizedDescription }
    }
}

private struct CheckinHistoryRow: View {
    let checkin: CheckinSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(formattedDate).font(.subheadline.weight(.semibold))
                Spacer()
                Text("\(Int(checkin.weight)) kg").font(.subheadline.weight(.semibold)).foregroundStyle(FitTheme.orange)
            }
            Text("Treino \(checkin.workoutAdherence)% · Dieta \(checkin.dietAdherence)%")
                .font(.caption)
                .foregroundStyle(FitTheme.secondaryText)
        }
        .padding(.vertical, 10)
    }

    private var formattedDate: String {
        let date = (try? Date(checkin.date, strategy: .iso8601.year().month().day().timeZone(separator: .omitted).time(includingFractionalSeconds: true)))
            ?? (try? Date(checkin.date, strategy: .iso8601))
        return date?.formatted(date: .abbreviated, time: .omitted) ?? checkin.date
    }
}
