import SwiftUI
import AudioToolbox
@preconcurrency import UserNotifications

struct WorkoutPlanView: View {
    @Environment(\.apiClient) private var api
    @State private var plan: WorkoutPlan?
    @State private var error: String?

    var body: some View {
        Group {
            if let plan {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 16) {
                        Text(plan.displayTitle).font(.largeTitle.bold())
                        Text("Seu programa semanal").foregroundStyle(FitTheme.secondaryText)
                        ForEach(plan.workoutDays) { day in
                            NavigationLink { WorkoutDayDetailView(day: day) } label: {
                                SurfaceCard {
                                    HStack(spacing: 15) {
                                        VStack(spacing: 4) {
                                            Text(shortWeekday(day.dayOfWeek)).font(.caption.bold()).foregroundStyle(FitTheme.orange)
                                            Text("\(day.exercises.count)").font(.title2.bold()).foregroundStyle(FitTheme.primaryText)
                                        }.frame(width: 48)
                                        VStack(alignment: .leading, spacing: 5) {
                                            Text(day.compactName).font(.headline).foregroundStyle(FitTheme.primaryText)
                                            Text(muscleSummary(for: day))
                                                .font(.caption).foregroundStyle(FitTheme.secondaryText).lineLimit(1)
                                        }
                                        Spacer()
                                        WorkoutDayStateBadge(state: state(for: day))
                                        Image(systemName: "chevron.right").foregroundStyle(FitTheme.secondaryText)
                                    }
                                }
                            }
                            .buttonStyle(.plain)
                            .accessibilityHint(day.prescriptionIssue == nil ? "Abre o treino" : "Abre o treino para preencher os dados pendentes")
                        }
                    }.padding(20)
                }
            } else if let error { ContentUnavailableView("Treino indisponível", systemImage: "dumbbell", description: Text(error)) }
            else { ProgressView() }
        }
        .fitScreen().navigationTitle("Treinos").navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func load() async {
        do {
            let loaded: WorkoutPlan = try await api.get("/api/student/workout-plan")
            plan = loaded
            error = nil
        } catch { self.error = error.localizedDescription }
    }
    private func shortWeekday(_ day: Int) -> String { ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"][min(max(day, 0), 6)] }

    private func muscleSummary(for day: WorkoutDay) -> String {
        if day.isRestDay { return "Recupere o corpo e mantenha-se em movimento" }
        let groups = day.exercises.map(\.muscleGroup)
            .filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
            .reduce(into: [String]()) { result, group in
                if !result.contains(where: { $0.caseInsensitiveCompare(group) == .orderedSame }) {
                    result.append(group)
                }
            }
        return groups.prefix(3).joined(separator: " • ")
    }

    private func state(for day: WorkoutDay) -> WorkoutDayVisualState {
        if day.isRestDay { return .rest }
        if let percentage = WorkoutHistoryStore.finalizedPercentageToday(dayId: day.id) {
            return percentage >= 100 ? .completed : .partial(percentage)
        }
        if day.prescriptionIssue != nil { return .review }
        let today = Calendar.current.component(.weekday, from: .now) - 1
        guard day.dayOfWeek == today else { return .scheduled }
        if WorkoutHistoryStore.isCompletedToday { return .completed }
        if WorkoutSessionStore.hasProgressToday(dayId: day.id) { return .inProgress }
        return .today
    }
}

private enum WorkoutDayVisualState: Equatable {
    case today, inProgress, completed, partial(Int), rest, review, scheduled

    var label: String {
        switch self { case .today: "HOJE"; case .inProgress: "EM CURSO"; case .completed: "CONCLUÍDO"; case .partial(let value): "PARCIAL \(value)%"; case .rest: "DESCANSO"; case .review: "REVISAR"; case .scheduled: "" }
    }
    var color: Color {
        switch self { case .today, .inProgress, .partial: FitTheme.orange; case .completed: FitTheme.green; case .rest: FitTheme.blue; case .review: .red; case .scheduled: .clear }
    }
}

private struct WorkoutDayStateBadge: View {
    let state: WorkoutDayVisualState
    var body: some View {
        if state != .scheduled {
            Text(state.label).font(.system(size: 9, weight: .bold)).tracking(0.4)
                .foregroundStyle(state.color)
                .padding(.horizontal, 8).padding(.vertical, 5)
                .background(state.color.opacity(0.14), in: Capsule())
        }
    }
}

// MARK: - Sessão de treino (séries + descanso)

/// Histórico local de treinos concluídos (datas), usado nas métricas da Home.
enum WorkoutHistoryStore {
    private static let key = "workout-completed-dates"

    static func recordCompletionToday(dayId: String, percentage: Int = 100) {
        let today = Date.now.formatted(.iso8601.year().month().day())
        let normalizedPercentage = min(max(percentage, 1), 100)
        var dates = UserDefaults.standard.stringArray(forKey: key) ?? []
        if !dates.contains(today) { dates.append(today) }
        UserDefaults.standard.set(dates, forKey: key)

        // Uma sincronização ou migração antiga nunca deve reduzir um progresso
        // que já foi registrado no aparelho.
        let dailyKey = "workout-completion-\(today)"
        let previousDaily = UserDefaults.standard.object(forKey: dailyKey) == nil
            ? 0
            : UserDefaults.standard.integer(forKey: dailyKey)
        UserDefaults.standard.set(max(previousDaily, normalizedPercentage), forKey: dailyKey)

        let dayKey = finalizedKey(dayId: dayId, date: today)
        let previousDay = UserDefaults.standard.object(forKey: dayKey) == nil
            ? 0
            : UserDefaults.standard.integer(forKey: dayKey)
        UserDefaults.standard.set(max(previousDay, normalizedPercentage), forKey: dayKey)
    }

    static func finalizedPercentageToday(dayId: String) -> Int? {
        let today = Date.now.formatted(.iso8601.year().month().day())
        let key = finalizedKey(dayId: dayId, date: today)
        if UserDefaults.standard.object(forKey: key) != nil { return UserDefaults.standard.integer(forKey: key) }

        // Migra registros feitos por versões anteriores, que salvavam somente
        // a porcentagem global do dia e não identificavam o treino finalizado.
        let legacyKey = "workout-completion-\(today)"
        let sessionKey = "workout-session-\(dayId)-\(today)"
        if UserDefaults.standard.object(forKey: legacyKey) != nil,
           !(UserDefaults.standard.stringArray(forKey: sessionKey) ?? []).isEmpty {
            let percentage = UserDefaults.standard.integer(forKey: legacyKey)
            UserDefaults.standard.set(percentage, forKey: key)
            return percentage
        }
        return nil
    }

    private static func finalizedKey(dayId: String, date: String) -> String { "workout-finalized-\(dayId)-\(date)" }

    static func completedDates() -> [Date] {
        (UserDefaults.standard.stringArray(forKey: key) ?? []).compactMap {
            try? Date($0, strategy: .iso8601.year().month().day())
        }
    }

    static var workoutsThisWeek: Int {
        let calendar = Calendar.current
        return completedDates().filter { calendar.isDate($0, equalTo: .now, toGranularity: .weekOfYear) }.count
    }

    static var totalWorkouts: Int { completedDates().count }

    static var isCompletedToday: Bool {
        completedDates().contains { Calendar.current.isDateInToday($0) }
    }

    static var currentStreak: Int {
        let calendar = Calendar.current
        let days = Set(completedDates().map { calendar.startOfDay(for: $0) })
        var cursor = calendar.startOfDay(for: .now)
        if !days.contains(cursor), let yesterday = calendar.date(byAdding: .day, value: -1, to: cursor) { cursor = yesterday }
        var streak = 0
        while days.contains(cursor) {
            streak += 1
            guard let previous = calendar.date(byAdding: .day, value: -1, to: cursor) else { break }
            cursor = previous
        }
        return streak
    }

    static var nextMilestone: Int {
        [1, 5, 10, 25, 50, 100].first(where: { $0 > totalWorkouts }) ?? (((totalWorkouts / 100) + 1) * 100)
    }

    /// Semanas consecutivas batendo a meta de treinos. A semana atual conta
    /// quando a meta já foi atingida; caso contrário não quebra a sequência.
    static func weeklyStreak(goal: Int) -> Int {
        guard goal > 0 else { return 0 }
        let calendar = Calendar.current
        let dates = completedDates()
        func workouts(inWeekOf reference: Date) -> Int {
            dates.filter { calendar.isDate($0, equalTo: reference, toGranularity: .weekOfYear) }.count
        }
        var streak = 0
        var cursor = Date.now
        if workouts(inWeekOf: cursor) >= goal { streak += 1 }
        while let previous = Calendar.current.date(byAdding: .weekOfYear, value: -1, to: cursor) {
            cursor = previous
            if workouts(inWeekOf: cursor) >= goal { streak += 1 } else { break }
        }
        return streak
    }
}

/// Persiste as séries concluídas do dia no aparelho, zerando a cada data.
@MainActor
final class WorkoutSessionStore: ObservableObject {
    @Published private(set) var completed: Set<String> = []
    private let storageKey: String

    init(dayId: String) {
        let today = Date.now.formatted(.iso8601.year().month().day())
        storageKey = "workout-session-\(dayId)-\(today)"
        if let saved = UserDefaults.standard.stringArray(forKey: storageKey) {
            completed = Set(saved)
        }
    }

    static func hasProgressToday(dayId: String) -> Bool {
        doneSetsCountToday(dayId: dayId) > 0
    }

    static func doneSetsCountToday(dayId: String) -> Int {
        let today = Date.now.formatted(.iso8601.year().month().day())
        return (UserDefaults.standard.stringArray(forKey: "workout-session-\(dayId)-\(today)") ?? []).count
    }

    /// Momento da primeira série marcada hoje (para medir a duração da sessão).
    var startedAt: Date? {
        UserDefaults.standard.object(forKey: storageKey + "-start") as? Date
    }

    func isDone(exercise: String, set index: Int) -> Bool {
        completed.contains("\(exercise)#\(index)")
    }

    func doneCount(exercise: String) -> Int {
        completed.filter { $0.hasPrefix("\(exercise)#") }.count
    }

    /// Retorna true quando a série foi marcada (não desmarcada).
    @discardableResult
    func toggle(exercise: String, set index: Int) -> Bool {
        let key = "\(exercise)#\(index)"
        let marking = !completed.contains(key)
        if marking && completed.isEmpty && startedAt == nil {
            UserDefaults.standard.set(Date.now, forKey: storageKey + "-start")
        }
        if marking { completed.insert(key) } else { completed.remove(key) }
        UserDefaults.standard.set(Array(completed), forKey: storageKey)
        return marking
    }
}

private struct WorkoutFinishSummary: Identifiable {
    let id = UUID()
    let completedSets: Int
    let totalSets: Int
    let startedAt: Date?
}

struct WorkoutDayDetailView: View {
    @Environment(\.apiClient) private var api
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    let day: WorkoutDay

    @StateObject private var store: WorkoutSessionStore
    @State private var restRemaining: Int?
    @State private var restTotal = 60
    @State private var restEndsAt: Date?
    @State private var restTask: Task<Void, Never>?
    @State private var finishSummary: WorkoutFinishSummary?
    @State private var detailExercise: ExerciseItem?
    @State private var setInputs: [String: [SetInput]] = [:]
    @State private var previousLogs: [String: [Int: SetLogEntry]] = [:]
    @State private var prs: [String: Double] = [:]
    @State private var prBanner: String?
    @State private var showPartialConfirmation = false
    @State private var finalizedPercentage: Int?

    init(day: WorkoutDay) {
        self.day = day
        _store = StateObject(wrappedValue: WorkoutSessionStore(dayId: day.id))
        _finalizedPercentage = State(initialValue: WorkoutHistoryStore.finalizedPercentageToday(dayId: day.id))
    }

    private var totalSets: Int { day.exercises.reduce(0) { $0 + $1.sets } }
    private var doneSets: Int { day.exercises.reduce(0) { $0 + store.doneCount(exercise: $1.id) } }
    private var currentExercise: ExerciseItem? {
        day.exercises.first { store.doneCount(exercise: $0.id) < $0.sets }
    }
    private var currentExerciseID: String? {
        currentExercise?.id
    }
    private var currentSetIndex: Int? {
        guard let exercise = currentExercise else { return nil }
        return (0..<exercise.sets).first { !store.isDone(exercise: exercise.id, set: $0) }
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 12) {
                WorkoutProgressCard(doneSets: doneSets, totalSets: totalSets)
                ForEach(day.exercises) { exercise in
                    ExerciseSessionRow(
                        exercise: exercise,
                        store: store,
                        inputs: Binding(
                            get: { setInputs[exercise.id] ?? plannedInputs(exercise) },
                            set: { setInputs[exercise.id] = $0 }
                        ),
                        previous: previousLogs[exerciseKey(exercise)] ?? [:],
                        isCurrent: finalizedPercentage == nil && currentExerciseID == exercise.id,
                        onSetToggled: { index, marked in handleSetToggle(exercise: exercise, setIndex: index, marked: marked) },
                        onShowDetail: { detailExercise = exercise }
                    )
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 16)
        }
        .scrollDismissesKeyboard(.interactively)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            workoutFooter
        }
        .fitScreen()
        .navigationTitle(day.compactName)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .tabBar)
        .sensoryFeedback(.success, trigger: allDone) { _, done in done }
        .onChange(of: allDone) { _, done in
            if done && finalizedPercentage == nil { finishWorkout() }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { updateRestTimer() }
        }
        .alert("Finalizar treino parcial?", isPresented: $showPartialConfirmation) {
            Button("Finalizar com \(completionPercentage)% concluído") { finishWorkout() }
            Button("Continuar treinando", role: .cancel) {}
        } message: {
            Text("Você concluiu \(doneSets) de \(totalSets) séries. O treino será contabilizado como parcial.")
        }
        .sheet(item: $detailExercise) { exercise in
            ExerciseDetailSheet(exercise: exercise)
        }
        .sheet(item: $finishSummary) { summary in
            WorkoutSummarySheet(
                dayName: day.compactName,
                exercises: day.exercises.count,
                completedSets: summary.completedSets,
                totalSets: summary.totalSets,
                startedAt: summary.startedAt,
                onClose: {
                    finishSummary = nil
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { dismiss() }
                }
            )
            .presentationDetents([.medium])
        }
        .onAppear {
            reconcileFinalizedPercentage()
            connectWatch()
        }
        .onDisappear {
            PhoneWorkoutConnectivity.shared.disconnect()
            stopRest()
        }
        .task {
            await syncPendingCompletions()
            await loadLogs()
        }
        .overlay(alignment: .top) {
            if let prBanner {
                Label("Novo recorde em \(prBanner)!", systemImage: "trophy.fill")
                    .font(.subheadline.bold())
                    .padding(.horizontal, 18).padding(.vertical, 11)
                    .background(FitTheme.orange, in: Capsule())
                    .foregroundStyle(.white)
                    .shadow(color: .black.opacity(0.4), radius: 14)
                    .padding(.top, 8)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .sensoryFeedback(.impact(weight: .heavy), trigger: prBanner)
    }

    private var workoutFooter: some View {
        VStack(spacing: 8) {
            if let remaining = restRemaining {
                RestTimerBar(
                    remaining: remaining,
                    total: restTotal,
                    onSkip: { stopRest() },
                    onExtend: { extendRest(by: 15) }
                )
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }

            if let finalizedPercentage {
                Button {
                    presentWorkoutSummary(completedSets: doneSets, totalSets: totalSets)
                } label: {
                    HStack(spacing: 8) {
                        Label(finalizedPercentage >= 100 ? "Treino concluído" : "Treino parcial registrado · \(finalizedPercentage)%", systemImage: finalizedPercentage >= 100 ? "checkmark.seal.fill" : "flag.checkered")
                        Spacer(minLength: 0)
                        Image(systemName: "chevron.up")
                    }
                    .font(.subheadline.bold())
                    .padding(.horizontal, 16)
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                }
                .buttonStyle(.plain)
                .foregroundStyle(.white)
                .background(FitTheme.green, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .accessibilityHint("Abre o resumo do treino")
            } else {
                Button {
                    if allDone { finishWorkout() }
                    else { showPartialConfirmation = true }
                } label: {
                    Label(allDone ? "Finalizar treino" : (doneSets > 0 ? "Finalizar treino parcial" : "Conclua ao menos uma série"), systemImage: allDone ? "checkmark.seal.fill" : (doneSets > 0 ? "flag.checkered" : "lock.fill"))
                        .font(.subheadline.bold())
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                }
                .buttonStyle(.plain)
                .foregroundStyle(doneSets > 0 ? .white : FitTheme.secondaryText)
                .background(doneSets > 0 ? FitTheme.orange : FitTheme.surfaceRaised, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .disabled(doneSets == 0)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(.ultraThinMaterial)
        .animation(.snappy, value: restRemaining != nil)
    }

    private var allDone: Bool { totalSets > 0 && doneSets == totalSets }
    private var completionPercentage: Int { totalSets > 0 ? Int((Double(doneSets) / Double(totalSets) * 100).rounded()) : 0 }

    private func finishWorkout() {
        guard doneSets > 0, finalizedPercentage == nil else { return }
        let completedSets = doneSets
        let plannedSets = totalSets
        let percentage = completionPercentage
        let completedAt = Date.now
        let startedAt = store.startedAt
        let durationSeconds = max(60, Int(completedAt.timeIntervalSince(startedAt ?? completedAt)))
        let request = WorkoutCompletionRequest(
            dayId: day.id,
            completedSets: completedSets,
            totalSets: plannedSets,
            startedAt: startedAt?.ISO8601Format(),
            completedAt: completedAt.ISO8601Format(),
            durationSeconds: durationSeconds,
            localDate: completedAt.formatted(.iso8601.year().month().day()),
            timezoneOffsetMinutes: TimeZone.current.secondsFromGMT(for: completedAt) / 60
        )

        finalizedPercentage = percentage
        stopRest()
        WorkoutHistoryStore.recordCompletionToday(dayId: day.id, percentage: percentage)
        PendingWorkoutCompletionStore.save(request)
        NotificationCenter.default.post(name: .workoutHistoryDidChange, object: nil)

        // Ao finalizar por um Alert, o iOS ainda está dispensando o alerta.
        // Apresentar a sheet após essa transição evita que o toque pareça não funcionar.
        presentWorkoutSummary(completedSets: completedSets, totalSets: plannedSets, delay: .milliseconds(300))

        Task { await syncCompletion(request) }
    }

    private func reconcileFinalizedPercentage() {
        guard let finalizedPercentage, doneSets > 0, totalSets > 0 else { return }
        let sessionPercentage = completionPercentage
        guard sessionPercentage > finalizedPercentage else { return }
        self.finalizedPercentage = sessionPercentage
        WorkoutHistoryStore.recordCompletionToday(dayId: day.id, percentage: sessionPercentage)
    }

    private func presentWorkoutSummary(
        completedSets: Int,
        totalSets: Int,
        delay: Duration = .zero
    ) {
        let summary = WorkoutFinishSummary(
            completedSets: completedSets,
            totalSets: totalSets,
            startedAt: store.startedAt
        )
        Task { @MainActor in
            if delay > .zero { try? await Task.sleep(for: delay) }
            guard !Task.isCancelled else { return }
            finishSummary = summary
        }
    }

    private func syncPendingCompletions() async {
        for request in PendingWorkoutCompletionStore.all() {
            guard !Task.isCancelled else { return }
            await syncCompletion(request)
        }
    }

    private func syncCompletion(_ request: WorkoutCompletionRequest) async {
        do {
            let _: WorkoutCompletionResult = try await api.post("/api/student/workout/complete", body: request)
            PendingWorkoutCompletionStore.remove(request)
            NotificationCenter.default.post(name: .workoutHistoryDidChange, object: nil)
        } catch {
            // O registro permanece na fila local e será reenviado na próxima abertura.
        }
    }

    private func exerciseKey(_ exercise: ExerciseItem) -> String {
        exercise.exerciseId ?? exercise.id
    }

    private func defaultReps(_ exercise: ExerciseItem) -> String {
        let cleaned = exercise.displayReps
        let prefix = cleaned.prefix { $0.isNumber }
        return prefix.isEmpty ? "" : String(prefix)
    }

    /// Carga prescrita pelo personal para a série, no formato dos campos de carga ("20", "22,5"); "" sem prescrição.
    private func prescribedWeight(_ exercise: ExerciseItem, set index: Int) -> String {
        exercise.loadForSet(index).map(formatWeight) ?? ""
    }

    /// Série sem registro: reps do plano e carga prescrita.
    private func plannedInput(_ exercise: ExerciseItem, set index: Int) -> SetInput {
        SetInput(weight: prescribedWeight(exercise, set: index), reps: defaultReps(exercise))
    }

    private func plannedInputs(_ exercise: ExerciseItem) -> [SetInput] {
        (0..<exercise.sets).map { plannedInput(exercise, set: $0) }
    }

    private func loadLogs() async {
        do {
            let logs: SessionLogs = try await api.get("/api/student/set-logs?dayId=\(day.id)")
            var previous: [String: [Int: SetLogEntry]] = [:]
            for entry in logs.previous {
                previous[entry.exerciseId, default: [:]][entry.setIndex] = entry
            }
            previousLogs = previous
            prs = Dictionary(uniqueKeysWithValues: logs.prs.map { ($0.exerciseId, $0.weight) })

            var today: [String: [Int: SetLogEntry]] = [:]
            for entry in logs.today {
                today[entry.exerciseId, default: [:]][entry.setIndex] = entry
            }

            for exercise in day.exercises {
                let key = exerciseKey(exercise)
                var inputs: [SetInput] = []
                for index in 0..<exercise.sets {
                    if let log = today[key]?[index] {
                        // Registro de hoje: mostra exatamente o que foi feito, mesmo sem carga.
                        inputs.append(SetInput(
                            weight: log.weight > 0 ? formatWeight(log.weight) : "",
                            reps: log.reps > 0 ? String(log.reps) : defaultReps(exercise)
                        ))
                    } else if let log = previous[key]?[index] {
                        // Sessão anterior: repete a carga usada; sem carga registrada, sugere a prescrita.
                        inputs.append(SetInput(
                            weight: log.weight > 0 ? formatWeight(log.weight) : prescribedWeight(exercise, set: index),
                            reps: log.reps > 0 ? String(log.reps) : defaultReps(exercise)
                        ))
                    } else {
                        inputs.append(plannedInput(exercise, set: index))
                    }
                }
                setInputs[exercise.id] = inputs
            }
        } catch {
            // Sem logs (primeira vez ou offline): preenche as reps e a carga prescritas no plano.
            for exercise in day.exercises where setInputs[exercise.id] == nil {
                setInputs[exercise.id] = plannedInputs(exercise)
            }
        }
        publishWatchState()
    }

    private func formatWeight(_ value: Double) -> String {
        value == value.rounded() ? String(Int(value)) : String(value).replacingOccurrences(of: ".", with: ",")
    }

    private func handleSetToggle(exercise: ExerciseItem, setIndex: Int, marked: Bool) {
        let key = exerciseKey(exercise)
        // Antes de os registros carregarem, os campos exibem os valores planejados: registra o que está na tela.
        let input = setInputs[exercise.id]?[indexSafe: setIndex] ?? plannedInput(exercise, set: setIndex)
        let weight = Double(input.weight.replacingOccurrences(of: ",", with: ".")) ?? 0
        let reps = Int(input.reps) ?? 0

        if marked {
            startRest(seconds: exercise.restAfterSet(setIndex), exerciseName: exercise.name)
            if weight > 0, weight > (prs[key] ?? 0) {
                prs[key] = weight
                withAnimation(.snappy) { prBanner = exercise.name }
                Task {
                    try? await Task.sleep(for: .seconds(3))
                    withAnimation(.snappy) { if prBanner == exercise.name { prBanner = nil } }
                }
            }
        }

        struct Body: Encodable {
            let exerciseId: String
            let dayId: String
            let setIndex: Int
            let weight: Double
            let reps: Int
            let remove: Bool
            let sessionDate: String
        }
        struct Saved: Codable { let id: String?; let removed: Bool? }
        let body = Body(
            exerciseId: key,
            dayId: day.id,
            setIndex: setIndex,
            weight: weight,
            reps: reps,
            remove: !marked,
            sessionDate: Date.now.formatted(.iso8601.year().month().day())
        )
        Task { let _: Saved? = try? await api.post("/api/student/set-logs", body: body) }
        publishWatchState()
    }

    private func startRest(seconds: Int, exerciseName: String) {
        guard seconds > 0 else { return }
        stopRest()
        restTotal = seconds
        restRemaining = seconds
        let endDate = Date.now.addingTimeInterval(TimeInterval(seconds))
        restEndsAt = endDate
        RestNotifier.schedule(after: seconds)
        RestLiveActivity.start(exerciseName: exerciseName, endDate: endDate)
        startRestUpdates()
    }

    private func extendRest(by seconds: Int) {
        guard seconds > 0, let restEndsAt else { return }
        let updatedEndDate = max(restEndsAt, .now).addingTimeInterval(TimeInterval(seconds))
        self.restEndsAt = updatedEndDate
        restTotal += seconds
        updateRestTimer()
        RestNotifier.schedule(after: restRemaining ?? seconds)
        RestLiveActivity.update(endDate: updatedEndDate)
        publishWatchState()
        if restTask == nil { startRestUpdates() }
    }

    /// O iOS pode suspender Tasks quando o aparelho é bloqueado. Por isso, o
    /// contador visual é sempre derivado do horário de término, não da
    /// quantidade de vezes que a Task conseguiu executar em segundo plano.
    private func startRestUpdates() {
        restTask?.cancel()
        restTask = Task {
            while !Task.isCancelled {
                updateRestTimer()
                guard restRemaining != nil else { return }
                try? await Task.sleep(for: .seconds(1))
            }
        }
    }

    private func updateRestTimer() {
        guard let restEndsAt else { return }
        let remaining = max(0, Int(restEndsAt.timeIntervalSinceNow.rounded(.up)))
        guard remaining > 0 else {
            finishRest()
            return
        }
        restRemaining = remaining
    }

    private func finishRest() {
        restTask?.cancel()
        restTask = nil
        restEndsAt = nil
        restRemaining = nil
        RestNotifier.cancel()
        RestLiveActivity.finish()
        AudioServicesPlaySystemSound(1057) // bip curto de fim de descanso
        AudioServicesPlaySystemSound(kSystemSoundID_Vibrate)
        publishWatchState()
    }

    private func stopRest() {
        restTask?.cancel()
        restTask = nil
        restEndsAt = nil
        restRemaining = nil
        RestNotifier.cancel()
        RestLiveActivity.cancel()
        publishWatchState()
    }

    private func connectWatch() {
        PhoneWorkoutConnectivity.shared.connect { command in
            handleWatchCommand(command)
        }
        publishWatchState()
    }

    private func handleWatchCommand(_ command: WatchWorkoutCommand) {
        switch command {
        case .requestState:
            publishWatchState()

        case .startWorkout:
            publishWatchState()

        case .completeSet(let exerciseId, let setIndex):
            guard finalizedPercentage == nil,
                  currentExerciseID == exerciseId,
                  currentSetIndex == setIndex,
                  let exercise = currentExercise,
                  !store.isDone(exercise: exercise.id, set: setIndex) else { return }

            var inputs = setInputs[exercise.id] ?? plannedInputs(exercise)
            guard inputs.indices.contains(setIndex) else { return }
            if (Int(inputs[setIndex].reps) ?? 0) <= 0 {
                inputs[setIndex].reps = defaultReps(exercise)
            }
            guard (Int(inputs[setIndex].reps) ?? 0) > 0 else { return }
            setInputs[exercise.id] = inputs

            let marked = store.toggle(exercise: exercise.id, set: setIndex)
            handleSetToggle(exercise: exercise, setIndex: setIndex, marked: marked)

        case .extendRest(let seconds):
            extendRest(by: min(max(seconds, 1), 60))

        case .skipRest:
            stopRest()
        }
    }

    private func publishWatchState() {
        let exercise = currentExercise
        let setIndex = currentSetIndex
        PhoneWorkoutConnectivity.shared.publish(
            WatchWorkoutState(
                dayId: day.id,
                dayName: day.compactName,
                exerciseId: exercise?.id,
                exerciseName: exercise?.name,
                targetReps: exercise?.displayReps,
                targetLoad: setIndex.flatMap { exercise?.loadForSet($0) }.map(WorkoutLoad.formatKilograms),
                currentSetIndex: setIndex,
                exerciseSetCount: exercise?.sets ?? 0,
                completedSetCount: doneSets,
                totalSetCount: totalSets,
                restEndDate: restEndsAt,
                restTotal: restEndsAt == nil ? 0 : restTotal,
                isWorkoutFinished: finalizedPercentage != nil
            )
        )
    }
}

private struct WorkoutProgressCard: View {
    let doneSets: Int
    let totalSets: Int

    private var isComplete: Bool { totalSets > 0 && doneSets == totalSets }
    private var percentage: Int {
        guard totalSets > 0 else { return 0 }
        return Int((Double(doneSets) / Double(totalSets) * 100).rounded())
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Progresso do treino")
                        .font(.caption)
                        .foregroundStyle(FitTheme.secondaryText)
                    Text("\(doneSets) de \(totalSets) séries")
                        .font(.headline)
                }
                Spacer()
                Text("\(percentage)%")
                    .font(.subheadline.bold())
                    .monospacedDigit()
                    .foregroundStyle(isComplete ? FitTheme.green : FitTheme.orange)
            }
            ProgressView(value: Double(doneSets), total: Double(max(totalSets, 1)))
                .tint(isComplete ? FitTheme.green : FitTheme.orange)
                .accessibilityLabel("Progresso do treino")
                .accessibilityValue("\(doneSets) de \(totalSets) séries concluídas")
        }
        .padding(14)
        .background(FitTheme.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(FitTheme.separator.opacity(0.28))
        }
    }
}

/// Notificação local para o fim do descanso quando o app está em segundo plano.
enum RestNotifier {
    private static let identifier = "rest-timer-done"

    static func schedule(after seconds: Int) {
        let center = UNUserNotificationCenter.current()
        center.requestAuthorization(options: [.alert, .sound]) { granted, _ in
            guard granted else { return }
            center.removePendingNotificationRequests(withIdentifiers: [identifier])
            let content = UNMutableNotificationContent()
            content.title = "Descanso concluído"
            content.body = "Hora da próxima série! 💪"
            content.sound = .default
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: TimeInterval(max(seconds, 1)), repeats: false)
            center.add(UNNotificationRequest(identifier: identifier, content: content, trigger: trigger))
        }
    }

    static func cancel() {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [identifier])
    }
}

struct SetInput: Hashable {
    var weight: String
    var reps: String
}

struct SetLogEntry: Codable, Sendable {
    let exerciseId: String
    let setIndex: Int
    let weight: Double
    let reps: Int
}

struct ExercisePR: Codable, Sendable {
    let exerciseId: String
    let weight: Double
}

struct SessionLogs: Codable, Sendable {
    let today: [SetLogEntry]
    let previous: [SetLogEntry]
    let prs: [ExercisePR]
}

extension Array {
    subscript(indexSafe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

private struct ExerciseSessionRow: View {
    let exercise: ExerciseItem
    @ObservedObject var store: WorkoutSessionStore
    @Binding var inputs: [SetInput]
    let previous: [Int: SetLogEntry]
    let isCurrent: Bool
    let onSetToggled: (Int, Bool) -> Void
    let onShowDetail: () -> Void
    @State private var showMissingReps = false
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    private var doneCount: Int { store.doneCount(exercise: exercise.id) }
    private var isComplete: Bool { exercise.sets > 0 && doneCount == exercise.sets }
    private var visibleEquipment: String? {
        guard let equipment = exercise.equipment?.trimmingCharacters(in: .whitespacesAndNewlines),
              !equipment.isEmpty,
              equipment.caseInsensitiveCompare(exercise.name) != .orderedSame else { return nil }
        return equipment
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Button(action: onShowDetail) {
                HStack(alignment: .top, spacing: 10) {
                    VStack(alignment: .leading, spacing: 5) {
                        HStack(spacing: 6) {
                            Text(exercise.name)
                                .font(.headline)
                                .foregroundStyle(FitTheme.primaryText)
                                .multilineTextAlignment(.leading)
                            if exercise.videoUrl?.isEmpty == false {
                                Image(systemName: "play.circle.fill")
                                    .font(.subheadline)
                                    .foregroundStyle(FitTheme.orange)
                            }
                        }
                        Text("\(exercise.sets) séries · \(exercise.displayReps) · descanso de \(exercise.rest)s")
                            .font(.caption)
                            .foregroundStyle(FitTheme.orange)
                            .multilineTextAlignment(.leading)
                        if let target = exercise.loadPrescriptionSummary {
                            Label {
                                Text("Meta: \(target)")
                                    .foregroundStyle(FitTheme.primaryText)
                                    .multilineTextAlignment(.leading)
                            } icon: {
                                Image(systemName: "target").foregroundStyle(FitTheme.orange)
                            }
                            .font(.caption.weight(.semibold))
                        }
                        if let visibleEquipment {
                            Text(visibleEquipment)
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(FitTheme.secondaryText)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(FitTheme.surfaceRaised, in: Capsule())
                        }
                    }
                    Spacer(minLength: 4)
                    VStack(alignment: .trailing, spacing: 7) {
                        exerciseStatus
                            .font(.caption.bold())
                        Image(systemName: "info.circle")
                            .font(.body)
                            .foregroundStyle(FitTheme.secondaryText)
                    }
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Detalhes de \(exercise.name)")
            .accessibilityHint("Mostra instruções, equipamento e vídeo do exercício")

            VStack(spacing: 8) {
                if !dynamicTypeSize.isAccessibilitySize {
                    columnHeader
                }
                ForEach(0..<exercise.sets, id: \.self) { index in
                    setRow(index)
                }
            }
        }
        .padding(16)
        .background(FitTheme.surface, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .stroke(cardBorderColor, lineWidth: isCurrent ? 1.5 : 1)
        }
        .accessibilityElement(children: .contain)
        .alert("Informe as repetições", isPresented: $showMissingReps) {
            Button("Entendi", role: .cancel) {}
        } message: {
            Text("Digite quantas repetições você realizou antes de concluir esta série.")
        }
    }

    @ViewBuilder
    private var exerciseStatus: some View {
        if isComplete {
            Label("Feito", systemImage: "checkmark.circle.fill")
                .foregroundStyle(FitTheme.green)
        } else if isCurrent {
            Text("AGORA")
                .foregroundStyle(FitTheme.orange)
                .padding(.horizontal, 8)
                .padding(.vertical, 5)
                .background(FitTheme.orange.opacity(0.13), in: Capsule())
        } else {
            Text("\(doneCount)/\(exercise.sets)")
                .foregroundStyle(FitTheme.secondaryText)
        }
    }

    private var cardBorderColor: Color {
        if isComplete { return FitTheme.green.opacity(0.5) }
        if isCurrent { return FitTheme.orange.opacity(0.75) }
        return FitTheme.separator.opacity(0.28)
    }

    private var columnHeader: some View {
        HStack(spacing: 6) {
            Text("#").frame(width: 26)
            Text("CARGA (KG)").frame(width: 60)
            Text("REPS").frame(width: 54)
            Text("ANTERIOR").frame(width: 70, alignment: .leading)
            Spacer(minLength: 0)
            Text("FEITO").frame(width: 44)
        }
        .font(.system(size: 9, weight: .bold))
        .foregroundStyle(FitTheme.secondaryText)
        .accessibilityHidden(true)
    }

    @ViewBuilder
    private func setRow(_ index: Int) -> some View {
        let done = store.isDone(exercise: exercise.id, set: index)
        if dynamicTypeSize.isAccessibilitySize {
            accessibleSetRow(index, done: done)
        } else {
            compactSetRow(index, done: done)
        }
    }

    private func compactSetRow(_ index: Int, done: Bool) -> some View {
        HStack(spacing: 6) {
            setNumber(index, done: done)
            weightField(index, done: done)
                .frame(width: 60)
            repsField(index, done: done)
                .frame(width: 54)
            previousValue(index)
                .frame(width: 70, alignment: .leading)
            Spacer(minLength: 0)
            completionButton(index, done: done)
        }
        .padding(.leading, 0)
        .padding(.vertical, 3)
        .padding(.trailing, 0)
        .background(done ? FitTheme.green.opacity(0.08) : Color.clear, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private func accessibleSetRow(_ index: Int, done: Bool) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Série \(index + 1)").font(.headline)
                Spacer()
                completionButton(index, done: done)
            }
            HStack(spacing: 10) {
                LabeledContent("Carga (kg)") { weightField(index, done: done) }
                LabeledContent("Reps") { repsField(index, done: done) }
            }
            .labeledContentStyle(.automatic)
            HStack {
                Text("Anterior")
                Spacer()
                previousValue(index)
            }
            .font(.caption)
            .foregroundStyle(FitTheme.secondaryText)
        }
        .padding(12)
        .background(done ? FitTheme.green.opacity(0.08) : FitTheme.surfaceRaised.opacity(0.55), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func setNumber(_ index: Int, done: Bool) -> some View {
        Text("\(index + 1)")
            .font(.caption.bold())
            .frame(width: 26, height: 26)
            .background(done ? FitTheme.green.opacity(0.18) : FitTheme.surfaceRaised, in: Circle())
            .foregroundStyle(done ? FitTheme.green : FitTheme.secondaryText)
    }

    private func weightField(_ index: Int, done: Bool) -> some View {
        let target = exercise.loadForSet(index)
        // Com o campo vazio, o placeholder mostra a carga prescrita para a série.
        return TextField(target.map(WorkoutLoad.formatDecimal) ?? "—", text: Binding(
            get: { inputs[indexSafe: index]?.weight ?? "" },
            set: { if inputs.indices.contains(index) { inputs[index].weight = $0 } }
        ))
        .keyboardType(.decimalPad)
        .multilineTextAlignment(.center)
        .font(.subheadline.weight(.medium))
        .frame(minHeight: 40)
        .background(FitTheme.background, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay { RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(FitTheme.separator.opacity(0.35)) }
        .disabled(done)
        .accessibilityLabel("Carga da série \(index + 1), em quilos")
        .accessibilityHint(target.map { "Meta do personal: \(WorkoutLoad.formatKilograms($0))" } ?? "")
    }

    private func repsField(_ index: Int, done: Bool) -> some View {
        TextField("—", text: Binding(
            get: { inputs[indexSafe: index]?.reps ?? "" },
            set: { if inputs.indices.contains(index) { inputs[index].reps = $0 } }
        ))
        .keyboardType(.numberPad)
        .multilineTextAlignment(.center)
        .font(.subheadline.weight(.medium))
        .frame(minHeight: 40)
        .background(FitTheme.background, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay { RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(FitTheme.separator.opacity(0.35)) }
        .disabled(done)
        .accessibilityLabel("Repetições da série \(index + 1)")
    }

    private func previousValue(_ index: Int) -> some View {
        Group {
            if let prev = previous[index] {
                Text("\(formattedWeight(prev.weight)) × \(prev.reps)")
            } else {
                Text("—")
            }
        }
        .font(.caption2)
        .foregroundStyle(FitTheme.secondaryText)
        .lineLimit(1)
        .minimumScaleFactor(0.8)
        .accessibilityLabel("Série anterior")
    }

    private func completionButton(_ index: Int, done: Bool) -> some View {
        Button {
            if !done {
                let reps = Int(inputs[indexSafe: index]?.reps ?? "") ?? 0
                guard reps > 0 else { showMissingReps = true; return }
            }
            let marked = store.toggle(exercise: exercise.id, set: index)
            onSetToggled(index, marked)
        } label: {
            Image(systemName: done ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 25, weight: .semibold))
                .foregroundStyle(done ? FitTheme.green : FitTheme.secondaryText)
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(done ? "Série \(index + 1) concluída" : "Concluir série \(index + 1)")
        .accessibilityHint(done ? "Toque duas vezes para desfazer" : "Toque duas vezes para iniciar o descanso")
    }

    private func formattedWeight(_ value: Double) -> String {
        guard value > 0 else { return "—" }
        return value == value.rounded() ? String(Int(value)) : String(format: "%.1f", value)
    }

}

private struct RestTimerBar: View {
    let remaining: Int
    let total: Int
    let onSkip: () -> Void
    let onExtend: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "timer")
                .font(.title3.bold())
                .foregroundStyle(FitTheme.orange)
                .frame(width: 38, height: 38)
                .background(FitTheme.orange.opacity(0.14), in: Circle())
            VStack(alignment: .leading, spacing: 5) {
                HStack {
                    Text("Descanso")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(FitTheme.secondaryText)
                    Spacer()
                    Text(durationText)
                        .font(.headline.monospacedDigit())
                        .foregroundStyle(FitTheme.primaryText)
                }
                ProgressView(value: Double(remaining), total: Double(max(total, 1)))
                    .tint(FitTheme.orange)
            }
            Button("+15s", action: onExtend)
                .font(.caption.bold())
                .foregroundStyle(FitTheme.orange)
                .frame(minWidth: 44, minHeight: 44)
            Button("Pular", action: onSkip)
                .font(.caption.bold())
                .foregroundStyle(FitTheme.secondaryText)
                .frame(minWidth: 44, minHeight: 44)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(FitTheme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(FitTheme.orange.opacity(0.3))
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Descanso, \(remaining) segundos restantes")
    }

    private var durationText: String {
        let minutes = remaining / 60
        let seconds = remaining % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }
}


/// Abre a sessão de treino (com séries e timer) a partir do dia indicado —
/// usado pela Home, que só conhece o id do dia de treino.
struct TodayWorkoutSessionView: View {
    @Environment(\.apiClient) private var api
    let dayId: String

    @State private var day: WorkoutDay?
    @State private var error: String?

    var body: some View {
        Group {
            if let day { WorkoutDayDetailView(day: day) }
            else if let error { ContentUnavailableView("Treino indisponível", systemImage: "dumbbell", description: Text(error)) }
            else { ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity).fitScreen() }
        }
        .task { await load() }
    }

    private func load() async {
        do {
            let plan: WorkoutPlan = try await api.get("/api/student/workout-plan")
            guard let selected = plan.workoutDays.first(where: { $0.id == dayId }) ?? plan.workoutDays.first else {
                error = "Nenhum dia de treino encontrado no seu plano."
                return
            }
            day = selected
            error = nil
        } catch { self.error = error.localizedDescription }
    }
}


// MARK: - Detalhe do exercício (vídeo + instruções)

struct ExerciseDetailSheet: View {
    @Environment(\.dismiss) private var dismiss
    let exercise: ExerciseItem

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    HStack(spacing: 10) {
                        Text(exercise.muscleGroup)
                            .font(.caption.bold())
                            .padding(.horizontal, 11).padding(.vertical, 6)
                            .background(FitTheme.orange.opacity(0.16), in: Capsule())
                            .foregroundStyle(FitTheme.orange)
                        if let equipment = exercise.equipment, !equipment.isEmpty {
                            Text(equipment)
                                .font(.caption.bold())
                                .padding(.horizontal, 11).padding(.vertical, 6)
                                .background(FitTheme.blue.opacity(0.16), in: Capsule())
                                .foregroundStyle(FitTheme.blue)
                        }
                    }

                    HStack(spacing: 12) {
                        MetricPill(icon: "square.stack.3d.up", value: "\(exercise.sets)", label: "séries")
                        MetricPill(icon: "repeat", value: exercise.displayReps, label: "repetições", tint: FitTheme.green)
                        MetricPill(icon: "timer", value: "\(exercise.rest)s", label: "descanso", tint: FitTheme.blue)
                    }

                    if exercise.loadPrescriptionSummary != nil {
                        SurfaceCard {
                            VStack(alignment: .leading, spacing: 10) {
                                SectionHeading(title: "Meta do personal")
                                ForEach(loadRows) { row in
                                    prescriptionRow(row.label, value: row.value)
                                }
                                if !exercise.displayRpe.isEmpty {
                                    prescriptionRow("Intensidade", value: exercise.displayRpe)
                                    Text("RPE é o esforço percebido, de 1 a 10: no RPE 8 ainda sobrariam cerca de 2 repetições; no 10, nenhuma.")
                                        .font(.caption)
                                        .foregroundStyle(FitTheme.secondaryText)
                                }
                            }
                        }
                    }

                    if let videoText = exercise.videoUrl, let url = URL(string: videoText), !videoText.isEmpty {
                        Link(destination: url) {
                            Label("Assistir vídeo de execução", systemImage: "play.rectangle.fill")
                                .font(.headline)
                                .frame(maxWidth: .infinity)
                                .frame(height: 52)
                                .background(FitTheme.orange, in: RoundedRectangle(cornerRadius: 16))
                                .foregroundStyle(.white)
                        }
                    }

                    if let instructions = exercise.instructions, !instructions.isEmpty {
                        SurfaceCard {
                            VStack(alignment: .leading, spacing: 10) {
                                SectionHeading(title: "Como executar")
                                Text(instructions).font(.subheadline).foregroundStyle(FitTheme.secondaryText)
                            }
                        }
                    }

                    if let notes = exercise.notes, !notes.isEmpty {
                        SurfaceCard {
                            VStack(alignment: .leading, spacing: 10) {
                                SectionHeading(title: "Observações do personal")
                                Text(notes).font(.subheadline).foregroundStyle(FitTheme.secondaryText)
                            }
                        }
                    }
                }
                .padding(20)
            }
            .fitScreen()
            .navigationTitle(exercise.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Fechar") { dismiss() } } }
        }
    }

    private struct LoadRow: Identifiable {
        let label: String
        let value: String
        var id: String { label }
    }

    /// Carga prescrita por série; uma linha só quando é a mesma em todas.
    private var loadRows: [LoadRow] {
        let loads = (0..<max(exercise.sets, 0)).compactMap { index in exercise.loadForSet(index).map { (set: index + 1, kg: $0) } }
        guard let first = loads.first else { return [] }
        if loads.allSatisfy({ $0.kg == first.kg }) {
            return [LoadRow(label: loads.count > 1 ? "Carga (todas as séries)" : "Carga", value: WorkoutLoad.formatKilograms(first.kg))]
        }
        return loads.map { LoadRow(label: "Série \($0.set)", value: WorkoutLoad.formatKilograms($0.kg)) }
    }

    private func prescriptionRow(_ label: String, value: String) -> some View {
        HStack {
            Text(label).foregroundStyle(FitTheme.secondaryText)
            Spacer()
            Text(value).fontWeight(.semibold).foregroundStyle(FitTheme.primaryText)
        }
        .font(.subheadline)
    }
}

// MARK: - Resumo pós-treino

struct WorkoutSummarySheet: View {
    let dayName: String
    let exercises: Int
    let completedSets: Int
    let totalSets: Int
    let startedAt: Date?
    let onClose: () -> Void

    private var percentage: Int { totalSets > 0 ? Int((Double(completedSets) / Double(totalSets) * 100).rounded()) : 0 }
    private var isComplete: Bool { completedSets == totalSets && totalSets > 0 }

    private var durationText: String {
        guard let startedAt else { return "—" }
        let minutes = max(1, Int(Date.now.timeIntervalSince(startedAt) / 60))
        return "\(minutes) min"
    }

    var body: some View {
        VStack(spacing: 22) {
            Image(systemName: isComplete ? "trophy.fill" : "flag.checkered")
                .font(.system(size: 54))
                .foregroundStyle(FitTheme.orange)
                .padding(.top, 26)
            VStack(spacing: 6) {
                Text(isComplete ? "Treino concluído!" : "Treino parcial registrado").font(.title2.bold())
                Text(dayName).foregroundStyle(FitTheme.secondaryText)
                Text("\(percentage)% do treino realizado").font(.subheadline.bold()).foregroundStyle(isComplete ? FitTheme.green : FitTheme.orange)
            }
            HStack(spacing: 12) {
                MetricPill(icon: "list.bullet", value: "\(exercises)", label: "exercícios")
                MetricPill(icon: "checkmark.circle.fill", value: "\(completedSets)/\(totalSets)", label: "séries", tint: FitTheme.green)
                MetricPill(icon: "clock.fill", value: durationText, label: "duração", tint: FitTheme.blue)
            }
            .padding(.horizontal, 20)
            Button {
                onClose()
            } label: {
                Text("Fechar")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
                    .background(FitTheme.orange, in: RoundedRectangle(cornerRadius: 16))
                    .foregroundStyle(.white)
            }
            .padding(.horizontal, 20)
            Spacer()
        }
        .presentationBackground(FitTheme.background)
    }
}
