import SwiftUI

struct StudentHomeView: View {
    let user: AppUser
    @Environment(\.apiClient) private var api
    @State private var dashboard: StudentDashboard?
    @State private var isLoading = true
    @State private var error: String?
    @State private var personalUserId: String?
    @State private var localStats = (week: 0, total: 0)
    @State private var weeklyGoal = 0
    @State private var dietPlan: DietPlan?
    @State private var completedMealIds: Set<String> = []
    @State private var mealToggleFeedback: String?

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 22) {
                header
                if isLoading { loadingCards }
                else if let error { ContentUnavailableView("Não foi possível carregar", systemImage: "wifi.exclamationmark", description: Text(error)) }
                else if let dashboard { dashboardContent(dashboard) }
            }
            .padding(20)
            .padding(.bottom, 24)
        }
        .fitScreen()
        .toolbar(.hidden, for: .navigationBar)
        .sensoryFeedback(.success, trigger: mealToggleFeedback)
        .refreshable { await load() }
        .task { await load() }
    }

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Olá, \(user.name.components(separatedBy: " ").first ?? user.name)")
                    .font(.system(size: 30, weight: .bold, design: .rounded))
                Text(Self.ptBRDateFormatter.string(from: .now))
                    .foregroundStyle(FitTheme.secondaryText)
            }
            Spacer()
            BrandMark()
        }
    }

    private var loadingCards: some View {
        VStack(spacing: 14) {
            ForEach(0..<3, id: \.self) { _ in
                RoundedRectangle(cornerRadius: 24).fill(FitTheme.surface).frame(height: 150).redacted(reason: .placeholder)
            }
        }
    }

    @ViewBuilder
    private func dashboardContent(_ data: StudentDashboard) -> some View {
        if let workout = data.workout {
            if workout.prescriptionIssue == nil {
                NavigationLink { TodayWorkoutSessionView(dayId: workout.id) } label: {
                    todayWorkoutCard(workout)
                }.buttonStyle(.plain)
            } else {
                NavigationLink { TodayWorkoutSessionView(dayId: workout.id) } label: {
                    SurfaceCard {
                        VStack(alignment: .leading, spacing: 18) {
                            HStack {
                                Label("PREENCHIMENTO NECESSÁRIO", systemImage: "exclamationmark.triangle.fill").font(.caption.bold()).foregroundStyle(.red)
                            }
                            Text(workout.compactName).font(.title2.bold()).foregroundStyle(FitTheme.primaryText)
                            Text(workout.prescriptionIssue ?? "Existem dados incompletos no treino.")
                                .font(.subheadline).foregroundStyle(FitTheme.secondaryText)
                            Label("ABRIR E INFORMAR REPETIÇÕES", systemImage: "square.and.pencil")
                                .font(.caption.bold()).foregroundStyle(FitTheme.orange)
                        }
                    }
                }.buttonStyle(.plain)
            }
        } else {
            SurfaceCard { Label("Nenhum treino programado para hoje", systemImage: "figure.cooldown").foregroundStyle(FitTheme.secondaryText) }
        }

        HStack(spacing: 12) {
            MetricPill(
                icon: "checkmark.circle.fill",
                value: weeklyGoal > 0 ? "\(localStats.week)/\(weeklyGoal)" : "\(localStats.week)",
                label: "treinos na semana",
                tint: localStats.week >= weeklyGoal && weeklyGoal > 0 ? FitTheme.green : FitTheme.orange
            )
            MetricPill(
                icon: "flame.fill",
                value: "\(WorkoutHistoryStore.weeklyStreak(goal: max(weeklyGoal, 1)))",
                label: "semanas na meta",
                tint: FitTheme.orange
            )
        }


        SurfaceCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Label("PRÓXIMO MARCO", systemImage: "trophy.fill").font(.caption.bold()).foregroundStyle(FitTheme.orange)
                    Spacer()
                    Text("\(localStats.total)/\(WorkoutHistoryStore.nextMilestone)").font(.caption.monospacedDigit()).foregroundStyle(FitTheme.secondaryText)
                }
                Text(milestoneTitle).font(.headline)
                ProgressView(value: Double(localStats.total), total: Double(WorkoutHistoryStore.nextMilestone)).tint(FitTheme.orange)
            }
        }

        SurfaceCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    SectionHeading(title: "Seu dia")
                    Spacer()
                    Text(dayStatusText(data))
                        .font(.caption.bold())
                        .foregroundStyle(FitTheme.orange)
                }
                DailyStatusRow(
                    icon: "dumbbell.fill",
                    title: "Treino",
                    detail: data.workout == nil ? "Dia de recuperação" : (data.workout?.prescriptionIssue == nil ? "Programado para hoje" : "Preencha as repetições durante o treino"),
                    tint: data.workout?.prescriptionIssue != nil ? .red : (data.workout == nil ? FitTheme.blue : FitTheme.orange)
                )
                DailyStatusRow(
                    icon: "fork.knife",
                    title: "Alimentação",
                    detail: data.diet?.meals.isEmpty == false ? "Plano disponível" : "Aguardando plano",
                    tint: data.diet?.meals.isEmpty == false ? FitTheme.green : FitTheme.secondaryText
                )
                DailyStatusRow(
                    icon: "chart.line.uptrend.xyaxis",
                    title: "Evolução",
                    detail: "Check-in semanal e medidas",
                    tint: FitTheme.blue
                )
            }
        }

        NavigationLink {
            if let personalUserId {
                ConversationView(contactId: personalUserId, contactName: data.personal.name)
            } else {
                ContentUnavailableView("Chat indisponível", systemImage: "bubble.left", description: Text("Não foi possível localizar seu personal. Puxe para atualizar."))
                    .fitScreen()
            }
        } label: {
            SurfaceCard {
                HStack(spacing: 14) {
                    Image(systemName: "person.crop.circle.badge.checkmark").font(.title).foregroundStyle(FitTheme.blue)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(data.personal.name).font(.headline).foregroundStyle(FitTheme.primaryText)
                        Text("Falar com seu personal").font(.caption).foregroundStyle(FitTheme.orange)
                    }
                    Spacer()
                    Image(systemName: "message.fill").foregroundStyle(FitTheme.orange)
                }
            }
        }
        .buttonStyle(.plain)

        if let plan = dietPlan, !plan.meals.isEmpty {
            HStack {
                SectionHeading(title: "Refeições de hoje")
                Spacer()
                Text("\(completedMealIds.count) de \(plan.meals.count)")
                    .font(.caption.bold()).foregroundStyle(FitTheme.secondaryText)
            }
            VStack(spacing: 10) {
                ForEach(plan.meals) { meal in
                    homeMealRow(meal, isNext: meal.id == nextMealId(plan))
                }
            }
        } else if let meals = data.diet?.meals, !meals.isEmpty {
            SectionHeading(title: "Próximas refeições")
            VStack(spacing: 10) {
                ForEach(meals.prefix(3)) { meal in
                    HStack(spacing: 14) {
                        ZStack {
                            Circle().fill(FitTheme.orange.opacity(0.14)).frame(width: 44, height: 44)
                            Image(systemName: "fork.knife").foregroundStyle(FitTheme.orange)
                        }
                        VStack(alignment: .leading, spacing: 3) {
                            Text(meal.name).font(.headline)
                            Text(meal.foods.prefix(2).map { $0.studentFriendlyName }.joined(separator: " • ")).font(.caption).foregroundStyle(FitTheme.secondaryText).lineLimit(1)
                        }
                        Spacer()
                        Text(meal.time).font(.subheadline.monospacedDigit()).foregroundStyle(FitTheme.secondaryText)
                    }
                    .padding(15).background(FitTheme.surface, in: RoundedRectangle(cornerRadius: 19))
                }
            }
        }

    }

    // MARK: - Refeições na Home

    private func nextMealId(_ plan: DietPlan) -> String? {
        let pending = plan.meals.filter { !completedMealIds.contains($0.id) }
        guard !pending.isEmpty else { return nil }
        let now = Calendar.current.dateComponents([.hour, .minute], from: .now)
        let nowMinutes = (now.hour ?? 0) * 60 + (now.minute ?? 0)
        func minutes(_ time: String) -> Int {
            let parts = time.split(separator: ":").compactMap { Int($0) }
            return parts.count >= 2 ? parts[0] * 60 + parts[1] : 0
        }
        return pending.first { minutes($0.time) >= nowMinutes - 45 }?.id ?? pending.last?.id
    }

    @ViewBuilder
    private func homeMealRow(_ meal: DietMeal, isNext: Bool) -> some View {
        let isCompleted = completedMealIds.contains(meal.id)
        HStack(spacing: 14) {
            Button {
                Task { await toggleMeal(meal) }
            } label: {
                Image(systemName: isCompleted ? "checkmark.circle.fill" : "circle")
                    .font(.title2)
                    .foregroundStyle(isCompleted ? FitTheme.green : FitTheme.secondaryText)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(isCompleted ? "Desmarcar \(meal.name)" : "Marcar \(meal.name) como consumida")

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 7) {
                    Text(meal.name)
                        .font(.headline)
                        .foregroundStyle(isCompleted ? FitTheme.secondaryText : FitTheme.primaryText)
                        .strikethrough(isCompleted, color: FitTheme.secondaryText)
                    if isNext {
                        Text("PRÓXIMA")
                            .font(.system(size: 9, weight: .bold)).tracking(0.4)
                            .padding(.horizontal, 7).padding(.vertical, 4)
                            .background(FitTheme.orange.opacity(0.16), in: Capsule())
                            .foregroundStyle(FitTheme.orange)
                    }
                }
                Text(meal.foods.prefix(2).map { $0.studentFriendlyName }.joined(separator: " • "))
                    .font(.caption).foregroundStyle(FitTheme.secondaryText).lineLimit(1)
            }
            Spacer()
            Text(meal.time).font(.subheadline.monospacedDigit()).foregroundStyle(FitTheme.secondaryText)
        }
        .padding(15)
        .background(FitTheme.surface, in: RoundedRectangle(cornerRadius: 19))
        .overlay {
            if isNext {
                RoundedRectangle(cornerRadius: 19).stroke(FitTheme.orange.opacity(0.55), lineWidth: 1.5)
            }
        }
        .opacity(isCompleted ? 0.75 : 1)
    }

    private func toggleMeal(_ meal: DietMeal) async {
        let marking = !completedMealIds.contains(meal.id)
        withAnimation(.snappy) {
            if marking { completedMealIds.insert(meal.id) } else { completedMealIds.remove(meal.id) }
        }
        if marking { mealToggleFeedback = meal.id }
        struct Body: Encodable { let mealId: String; let completed: Bool }
        struct Result: Codable { let mealId: String; let completed: Bool }
        do {
            let _: Result = try await api.post("/api/student/diet/complete", body: Body(mealId: meal.id, completed: marking))
        } catch {
            withAnimation(.snappy) {
                if marking { completedMealIds.remove(meal.id) } else { completedMealIds.insert(meal.id) }
            }
        }
    }

    private func todayWorkoutCard(_ workout: TodayWorkout) -> some View {
        let finalized = WorkoutHistoryStore.finalizedPercentageToday(dayId: workout.id)
        let doneToday = WorkoutSessionStore.doneSetsCountToday(dayId: workout.id)
        let totalSets = workout.exercises.reduce(0) { $0 + $1.sets }

        return SurfaceCard {
            VStack(alignment: .leading, spacing: 18) {
                HStack {
                    if finalized != nil {
                        Label("TREINO DE HOJE FEITO", systemImage: "checkmark.seal.fill").font(.caption.bold()).foregroundStyle(FitTheme.green)
                    } else if doneToday > 0 {
                        Label("TREINO EM ANDAMENTO", systemImage: "bolt.fill").font(.caption.bold()).foregroundStyle(FitTheme.orange)
                    } else {
                        Label("TREINO DE HOJE", systemImage: "bolt.fill").font(.caption.bold()).foregroundStyle(FitTheme.orange)
                    }
                    Spacer(); Image(systemName: "arrow.up.right").foregroundStyle(FitTheme.secondaryText)
                }
                Text(workout.compactName).font(.title2.bold()).foregroundStyle(FitTheme.primaryText)
                HStack(spacing: 18) {
                    Label("\(workout.exercises.count) exercícios", systemImage: "list.bullet")
                    if doneToday > 0 && finalized == nil {
                        Label("\(doneToday)/\(totalSets) séries", systemImage: "checkmark.circle")
                    } else {
                        Label("~\(max(25, workout.exercises.count * 7)) min", systemImage: "clock")
                    }
                }.font(.subheadline).foregroundStyle(FitTheme.secondaryText)

                if let finalized {
                    Text(finalized >= 100 ? "CONCLUÍDO • REVER TREINO" : "PARCIAL \(finalized)% • REVER TREINO")
                        .font(.caption.bold()).tracking(0.8).foregroundStyle(.white)
                        .padding(.horizontal, 16).padding(.vertical, 11).background(FitTheme.green, in: Capsule())
                } else if doneToday > 0 {
                    Text("CONTINUAR TREINO").font(.caption.bold()).tracking(0.8).foregroundStyle(.white)
                        .padding(.horizontal, 16).padding(.vertical, 11).background(FitTheme.orange, in: Capsule())
                } else {
                    Text("COMEÇAR TREINO").font(.caption.bold()).tracking(0.8).foregroundStyle(.white)
                        .padding(.horizontal, 16).padding(.vertical, 11).background(FitTheme.orange, in: Capsule())
                }
            }
        }
    }

    private func dayStatusText(_ data: StudentDashboard) -> String {
        if data.workout?.prescriptionIssue != nil { return "PREENCHER" }
        return data.workout == nil ? "RECUPERAÇÃO" : "EM ANDAMENTO"
    }

    private var milestoneTitle: String {
        let remaining = max(WorkoutHistoryStore.nextMilestone - localStats.total, 0)
        return remaining == 1 ? "Falta 1 treino para seu próximo marco" : "Faltam \(remaining) treinos para seu próximo marco"
    }

    private func load() async {
        isLoading = dashboard == nil
        defer { isLoading = false }
        localStats = (WorkoutHistoryStore.workoutsThisWeek, WorkoutHistoryStore.totalWorkouts)
        do {
            dashboard = try await api.get("/api/student/dashboard")
            error = nil
        } catch { self.error = error.localizedDescription }

        struct PersonalContact: Codable, Sendable { let user: PersonalContactUser }
        struct PersonalContactUser: Codable, Sendable { let id: String }
        if let contact: PersonalContact = try? await api.get("/api/student/personal") {
            personalUserId = contact.user.id
        }

        if let plan: WorkoutPlan = try? await api.get("/api/student/workout-plan") {
            weeklyGoal = plan.workoutDays.filter { !$0.isRestDay && !$0.exercises.isEmpty }.count
        }

        if let diet: DietPlan = try? await api.get("/api/student/diet") {
            dietPlan = diet
            completedMealIds = Set(diet.meals.filter { $0.completed == true }.map(\.id))
        }
    }

    private static let ptBRDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "pt_BR")
        formatter.dateFormat = "EEEE, d 'de' MMMM"
        return formatter
    }()
}

private struct DailyStatusRow: View {
    let icon: String
    let title: String
    let detail: String
    let tint: Color

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .frame(width: 32, height: 32)
                .background(tint.opacity(0.15), in: Circle())
                .foregroundStyle(tint)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.weight(.semibold))
                Text(detail).font(.caption).foregroundStyle(FitTheme.secondaryText)
            }
            Spacer()
            Image(systemName: "checkmark.circle")
                .foregroundStyle(tint.opacity(0.85))
        }
        .accessibilityElement(children: .combine)
    }
}
