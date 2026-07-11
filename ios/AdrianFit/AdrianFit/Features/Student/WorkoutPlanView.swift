import SwiftUI
import AudioToolbox
import UserNotifications

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
                                            Text(day.displayName).font(.headline).foregroundStyle(FitTheme.primaryText)
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
        var dates = UserDefaults.standard.stringArray(forKey: key) ?? []
        if !dates.contains(today) { dates.append(today) }
        UserDefaults.standard.set(dates, forKey: key)
        UserDefaults.standard.set(min(max(percentage, 1), 100), forKey: "workout-completion-\(today)")
        UserDefaults.standard.set(min(max(percentage, 1), 100), forKey: finalizedKey(dayId: dayId, date: today))
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
        let today = Date.now.formatted(.iso8601.year().month().day())
        return !(UserDefaults.standard.stringArray(forKey: "workout-session-\(dayId)-\(today)") ?? []).isEmpty
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

struct WorkoutDayDetailView: View {
    @Environment(\.apiClient) private var api
    @Environment(\.dismiss) private var dismiss
    let day: WorkoutDay

    @StateObject private var store: WorkoutSessionStore
    @State private var restRemaining: Int?
    @State private var restTotal = 60
    @State private var restTask: Task<Void, Never>?
    @State private var showSummary = false
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

    var body: some View {
        ZStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("\(doneSets) de \(totalSets) séries")
                                .font(.subheadline.weight(.semibold))
                            Spacer()
                            if doneSets == totalSets && totalSets > 0 {
                                Label("Treino concluído!", systemImage: "checkmark.seal.fill")
                                    .font(.caption.bold()).foregroundStyle(FitTheme.green)
                            }
                        }
                        ProgressView(value: Double(doneSets), total: Double(max(totalSets, 1)))
                            .tint(doneSets == totalSets && totalSets > 0 ? FitTheme.green : FitTheme.orange)
                    }
                    .padding(.vertical, 4)
                }
                .listRowBackground(FitTheme.surface)

                ForEach(day.exercises) { exercise in
                    Section {
                        ExerciseSessionRow(
                            exercise: exercise,
                            store: store,
                            inputs: Binding(
                                get: { setInputs[exercise.id] ?? (0..<exercise.sets).map { _ in SetInput(weight: "", reps: defaultReps(exercise)) } },
                                set: { setInputs[exercise.id] = $0 }
                            ),
                            previous: previousLogs[exerciseKey(exercise)] ?? [:],
                            onSetToggled: { index, marked in handleSetToggle(exercise: exercise, setIndex: index, marked: marked) },
                            onShowDetail: { detailExercise = exercise }
                        )
                    }
                    .listRowBackground(FitTheme.surface)
                }
            }
            .scrollContentBackground(.hidden)
            .safeAreaInset(edge: .bottom) {
                VStack(spacing: 8) {
                    if let finalizedPercentage {
                        Label(finalizedPercentage >= 100 ? "TREINO CONCLUÍDO" : "TREINO PARCIAL REGISTRADO • \(finalizedPercentage)%", systemImage: finalizedPercentage >= 100 ? "checkmark.seal.fill" : "flag.checkered")
                            .font(.subheadline.bold()).frame(maxWidth: .infinity).padding(.vertical, 14)
                            .foregroundStyle(.white).background(FitTheme.green, in: RoundedRectangle(cornerRadius: 16))
                    } else {
                        Button {
                            if allDone { finishWorkout() }
                            else { showPartialConfirmation = true }
                        } label: {
                            Label(allDone ? "FINALIZAR TREINO" : (doneSets > 0 ? "FINALIZAR TREINO PARCIAL" : "CONCLUA AO MENOS UMA SÉRIE"), systemImage: allDone ? "checkmark.seal.fill" : (doneSets > 0 ? "flag.checkered" : "lock.fill"))
                                .font(.subheadline.bold()).frame(maxWidth: .infinity).padding(.vertical, 14)
                        }
                        .buttonStyle(.plain).foregroundStyle(doneSets > 0 ? .white : FitTheme.secondaryText)
                        .background(doneSets > 0 ? FitTheme.orange : FitTheme.surfaceRaised, in: RoundedRectangle(cornerRadius: 16))
                        .disabled(doneSets == 0)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 8)
                .background(.ultraThinMaterial)
            }

            if let remaining = restRemaining {
                RestTimerOverlay(
                    remaining: remaining,
                    total: restTotal,
                    onSkip: { stopRest() },
                    onExtend: { extendRest(by: 15) }
                )
            }
        }
        .fitScreen()
        .navigationTitle(day.displayName)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .tabBar)
        .sensoryFeedback(.success, trigger: allDone) { _, done in done }
        .onChange(of: allDone) { _, done in
            if done && finalizedPercentage == nil { finishWorkout() }
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
        .sheet(isPresented: $showSummary) {
            WorkoutSummarySheet(
                dayName: day.displayName,
                exercises: day.exercises.count,
                completedSets: doneSets,
                totalSets: totalSets,
                startedAt: store.startedAt,
                onClose: {
                    showSummary = false
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { dismiss() }
                }
            )
            .presentationDetents([.medium])
        }
        .onDisappear { stopRest() }
        .task { await loadLogs() }
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

    private var allDone: Bool { totalSets > 0 && doneSets == totalSets }
    private var completionPercentage: Int { totalSets > 0 ? Int((Double(doneSets) / Double(totalSets) * 100).rounded()) : 0 }

    private func finishWorkout() {
        guard doneSets > 0, finalizedPercentage == nil else { return }
        finalizedPercentage = completionPercentage
        stopRest()
        WorkoutHistoryStore.recordCompletionToday(dayId: day.id, percentage: completionPercentage)
        showSummary = true

        struct Body: Encodable { let dayId: String; let completedSets: Int; let totalSets: Int }
        struct Result: Decodable, Sendable { let percentage: Int }
        let body = Body(dayId: day.id, completedSets: doneSets, totalSets: totalSets)
        Task { let _: Result? = try? await api.post("/api/student/workout/complete", body: body) }
    }

    private func exerciseKey(_ exercise: ExerciseItem) -> String {
        exercise.exerciseId ?? exercise.id
    }

    private func defaultReps(_ exercise: ExerciseItem) -> String {
        let cleaned = exercise.displayReps
        let prefix = cleaned.prefix { $0.isNumber }
        return prefix.isEmpty ? "" : String(prefix)
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
                    if let log = today[key]?[index] ?? previous[key]?[index] {
                        inputs.append(SetInput(
                            weight: log.weight > 0 ? formatWeight(log.weight) : "",
                            reps: log.reps > 0 ? String(log.reps) : defaultReps(exercise)
                        ))
                    } else {
                        inputs.append(SetInput(weight: "", reps: defaultReps(exercise)))
                    }
                }
                setInputs[exercise.id] = inputs
            }
        } catch {
            // Sem logs (primeira vez ou offline): preenche apenas as reps do plano.
            for exercise in day.exercises where setInputs[exercise.id] == nil {
                setInputs[exercise.id] = (0..<exercise.sets).map { _ in SetInput(weight: "", reps: defaultReps(exercise)) }
            }
        }
    }

    private func formatWeight(_ value: Double) -> String {
        value == value.rounded() ? String(Int(value)) : String(value).replacingOccurrences(of: ".", with: ",")
    }

    private func handleSetToggle(exercise: ExerciseItem, setIndex: Int, marked: Bool) {
        let key = exerciseKey(exercise)
        let input = setInputs[exercise.id]?[indexSafe: setIndex] ?? SetInput(weight: "", reps: "")
        let weight = Double(input.weight.replacingOccurrences(of: ",", with: ".")) ?? 0
        let reps = Int(input.reps) ?? 0

        if marked {
            startRest(seconds: exercise.restAfterSet(setIndex))
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
        }
        struct Saved: Codable { let id: String?; let removed: Bool? }
        let body = Body(exerciseId: key, dayId: day.id, setIndex: setIndex, weight: weight, reps: reps, remove: !marked)
        Task { let _: Saved? = try? await api.post("/api/student/set-logs", body: body) }
    }

    private func startRest(seconds: Int) {
        guard seconds > 0 else { return }
        stopRest()
        restTotal = seconds
        restRemaining = seconds
        RestNotifier.schedule(after: seconds)
        restTask = Task {
            while let left = restRemaining, left > 0, !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1))
                guard !Task.isCancelled else { return }
                restRemaining = (restRemaining ?? 1) - 1
            }
            if !Task.isCancelled {
                restRemaining = nil
                AudioServicesPlaySystemSound(1057) // bip curto de fim de descanso
                AudioServicesPlaySystemSound(kSystemSoundID_Vibrate)
            }
        }
    }

    private func extendRest(by seconds: Int) {
        guard restRemaining != nil else { return }
        restRemaining = (restRemaining ?? 0) + seconds
        restTotal += seconds
        RestNotifier.schedule(after: restRemaining ?? seconds)
    }

    private func stopRest() {
        restTask?.cancel()
        restTask = nil
        restRemaining = nil
        RestNotifier.cancel()
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
    let onSetToggled: (Int, Bool) -> Void
    let onShowDetail: () -> Void
    @State private var showMissingReps = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Button(action: onShowDetail) {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 7) {
                        Text(exercise.name).font(.headline).foregroundStyle(FitTheme.primaryText)
                        if exercise.videoUrl?.isEmpty == false {
                            Image(systemName: "play.circle.fill").font(.subheadline).foregroundStyle(FitTheme.orange)
                        }
                        Image(systemName: "info.circle").font(.caption).foregroundStyle(FitTheme.secondaryText)
                        Spacer()
                        let done = store.doneCount(exercise: exercise.id)
                        Text("\(done)/\(exercise.sets)")
                            .font(.caption.bold())
                            .foregroundStyle(done == exercise.sets ? FitTheme.green : FitTheme.secondaryText)
                    }
                    Text("Meta: \(exercise.sets) × \(exercise.displayReps) • \(exercise.rest)s de descanso")
                        .font(.caption).foregroundStyle(FitTheme.orange)
                    if let equipment = exercise.equipment, !equipment.isEmpty {
                        Text(equipment).font(.caption2).foregroundStyle(FitTheme.secondaryText)
                    }
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            VStack(spacing: 8) {
                ForEach(0..<exercise.sets, id: \.self) { index in
                    setRow(index)
                }
            }
        }
        .padding(.vertical, 6)
    }

    @ViewBuilder
    private func setRow(_ index: Int) -> some View {
        let done = store.isDone(exercise: exercise.id, set: index)
        HStack(spacing: 10) {
            Text("\(index + 1)")
                .font(.caption.bold())
                .frame(width: 24, height: 24)
                .background(done ? FitTheme.green.opacity(0.2) : FitTheme.surfaceRaised, in: Circle())
                .foregroundStyle(done ? FitTheme.green : FitTheme.secondaryText)

            TextField("kg", text: Binding(
                get: { inputs[indexSafe: index]?.weight ?? "" },
                set: { if inputs.indices.contains(index) { inputs[index].weight = $0 } }
            ))
            .keyboardType(.decimalPad)
            .frame(width: 58)
            .textFieldStyle(.roundedBorder)
            .font(.subheadline)
            .disabled(done)
            .accessibilityLabel("Carga da série \(index + 1), em quilos")

            Text("kg ×").font(.caption).foregroundStyle(FitTheme.secondaryText)

            TextField("reps", text: Binding(
                get: { inputs[indexSafe: index]?.reps ?? "" },
                set: { if inputs.indices.contains(index) { inputs[index].reps = $0 } }
            ))
            .keyboardType(.numberPad)
            .frame(width: 48)
            .textFieldStyle(.roundedBorder)
            .font(.subheadline)
            .disabled(done)
            .accessibilityLabel("Repetições da série \(index + 1)")

            if let prev = previous[index] {
                Text("ant: \(prev.weight > 0 ? "\(prev.weight == prev.weight.rounded() ? String(Int(prev.weight)) : String(format: "%.1f", prev.weight))kg" : "—") × \(prev.reps)")
                    .font(.caption2)
                    .foregroundStyle(FitTheme.secondaryText)
                    .lineLimit(1)
            }

            Spacer()

            Button {
                if !done {
                    let reps = Int(inputs[indexSafe: index]?.reps ?? "") ?? 0
                    guard reps > 0 else { showMissingReps = true; return }
                }
                let marked = store.toggle(exercise: exercise.id, set: index)
                onSetToggled(index, marked)
            } label: {
                Image(systemName: done ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(done ? FitTheme.green : FitTheme.secondaryText)
            }
            .buttonStyle(.plain)
        }
        .alert("Informe as repetições", isPresented: $showMissingReps) {
            Button("Entendi", role: .cancel) {}
        } message: {
            Text("Digite quantas repetições você realizou antes de concluir esta série.")
        }
    }
}

private struct RestTimerOverlay: View {
    let remaining: Int
    let total: Int
    let onSkip: () -> Void
    let onExtend: () -> Void

    var body: some View {
        VStack(spacing: 18) {
            Text("Descanso").font(.headline).foregroundStyle(FitTheme.secondaryText)
            ZStack {
                Circle()
                    .stroke(Color.white.opacity(0.1), lineWidth: 10)
                Circle()
                    .trim(from: 0, to: CGFloat(remaining) / CGFloat(max(total, 1)))
                    .stroke(FitTheme.orange, style: StrokeStyle(lineWidth: 10, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .animation(.linear(duration: 1), value: remaining)
                Text("\(remaining)s")
                    .font(.system(size: 44, weight: .bold, design: .rounded))
                    .monospacedDigit()
            }
            .frame(width: 160, height: 160)
            HStack(spacing: 22) {
                Button { onExtend() } label: {
                    Label("+15s", systemImage: "plus.circle")
                        .font(.subheadline.weight(.semibold))
                }
                .foregroundStyle(.white)
                Button("Pular") { onSkip() }
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(FitTheme.orange)
            }
        }
        .padding(34)
        .background(FitTheme.surfaceRaised, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay { RoundedRectangle(cornerRadius: 28, style: .continuous).stroke(Color.white.opacity(0.08)) }
        .shadow(color: .black.opacity(0.5), radius: 30)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black.opacity(0.55).ignoresSafeArea())
        .transition(.opacity)
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
