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
                        Text(plan.title).font(.largeTitle.bold())
                        Text("Seu programa semanal").foregroundStyle(FitTheme.secondaryText)
                        ForEach(plan.workoutDays) { day in
                            NavigationLink { WorkoutDayDetailView(day: day) } label: {
                                SurfaceCard {
                                    HStack(spacing: 15) {
                                        VStack(spacing: 4) {
                                            Text(shortWeekday(day.dayOfWeek)).font(.caption.bold()).foregroundStyle(FitTheme.orange)
                                            Text("\(day.exercises.count)").font(.title2.bold()).foregroundStyle(.white)
                                        }.frame(width: 48)
                                        VStack(alignment: .leading, spacing: 5) {
                                            Text(day.name).font(.headline).foregroundStyle(.white)
                                            Text(day.exercises.prefix(3).map(\.muscleGroup).joined(separator: " • "))
                                                .font(.caption).foregroundStyle(FitTheme.secondaryText).lineLimit(1)
                                        }
                                        Spacer(); Image(systemName: "chevron.right").foregroundStyle(FitTheme.secondaryText)
                                    }
                                }
                            }.buttonStyle(.plain)
                        }
                    }.padding(20)
                }
            } else if let error { ContentUnavailableView("Treino indisponível", systemImage: "dumbbell", description: Text(error)) }
            else { ProgressView() }
        }
        .fitScreen().navigationTitle("Treinos").navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func load() async { do { plan = try await api.get("/api/student/workout-plan") } catch { self.error = error.localizedDescription } }
    private func shortWeekday(_ day: Int) -> String { ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"][min(max(day, 0), 6)] }
}

// MARK: - Sessão de treino (séries + descanso)

/// Histórico local de treinos concluídos (datas), usado nas métricas da Home.
enum WorkoutHistoryStore {
    private static let key = "workout-completed-dates"

    static func recordCompletionToday() {
        let today = Date.now.formatted(.iso8601.year().month().day())
        var dates = UserDefaults.standard.stringArray(forKey: key) ?? []
        guard !dates.contains(today) else { return }
        dates.append(today)
        UserDefaults.standard.set(dates, forKey: key)
    }

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
    let day: WorkoutDay

    @StateObject private var store: WorkoutSessionStore
    @State private var restRemaining: Int?
    @State private var restTotal = 60
    @State private var restTask: Task<Void, Never>?
    @State private var showSummary = false
    @State private var detailExercise: ExerciseItem?

    init(day: WorkoutDay) {
        self.day = day
        _store = StateObject(wrappedValue: WorkoutSessionStore(dayId: day.id))
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
                            onSetCompleted: { rest in startRest(seconds: rest) },
                            onShowDetail: { detailExercise = exercise }
                        )
                    }
                    .listRowBackground(FitTheme.surface)
                }
            }
            .scrollContentBackground(.hidden)

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
        .navigationTitle(day.name)
        .navigationBarTitleDisplayMode(.inline)
        .sensoryFeedback(.success, trigger: allDone) { _, done in done }
        .onChange(of: allDone) { _, done in
            if done {
                WorkoutHistoryStore.recordCompletionToday()
                stopRest()
                showSummary = true
            }
        }
        .sheet(item: $detailExercise) { exercise in
            ExerciseDetailSheet(exercise: exercise)
        }
        .sheet(isPresented: $showSummary) {
            WorkoutSummarySheet(
                dayName: day.name,
                exercises: day.exercises.count,
                sets: totalSets,
                startedAt: store.startedAt
            )
            .presentationDetents([.medium])
        }
        .onDisappear { stopRest() }
    }

    private var allDone: Bool { totalSets > 0 && doneSets == totalSets }

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

private struct ExerciseSessionRow: View {
    let exercise: ExerciseItem
    @ObservedObject var store: WorkoutSessionStore
    let onSetCompleted: (Int) -> Void
    let onShowDetail: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Button(action: onShowDetail) {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 7) {
                        Text(exercise.name).font(.headline).foregroundStyle(.white)
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
                    Text("\(exercise.sets) séries × \(exercise.reps) • \(exercise.rest)s de descanso")
                        .font(.caption).foregroundStyle(FitTheme.orange)
                    if let equipment = exercise.equipment, !equipment.isEmpty {
                        Text(equipment).font(.caption2).foregroundStyle(FitTheme.secondaryText)
                    }
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            HStack(spacing: 10) {
                ForEach(0..<exercise.sets, id: \.self) { index in
                    let done = store.isDone(exercise: exercise.id, set: index)
                    Button {
                        let marked = store.toggle(exercise: exercise.id, set: index)
                        if marked { onSetCompleted(exercise.rest) }
                    } label: {
                        Text("\(index + 1)")
                            .font(.subheadline.weight(.bold))
                            .frame(width: 40, height: 40)
                            .background(done ? FitTheme.green : FitTheme.surfaceRaised, in: Circle())
                            .foregroundStyle(done ? .white : FitTheme.secondaryText)
                            .overlay { Circle().stroke(done ? FitTheme.green : Color.white.opacity(0.12)) }
                    }
                    .buttonStyle(.plain)
                }
                Spacer()
            }

        }
        .padding(.vertical, 6)
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
            day = plan.workoutDays.first { $0.id == dayId } ?? plan.workoutDays.first
            if day == nil { error = "Nenhum dia de treino encontrado no seu plano." }
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
                        MetricPill(icon: "repeat", value: exercise.reps, label: "repetições", tint: FitTheme.green)
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
    @Environment(\.dismiss) private var dismiss
    let dayName: String
    let exercises: Int
    let sets: Int
    let startedAt: Date?

    private var durationText: String {
        guard let startedAt else { return "—" }
        let minutes = max(1, Int(Date.now.timeIntervalSince(startedAt) / 60))
        return "\(minutes) min"
    }

    var body: some View {
        VStack(spacing: 22) {
            Image(systemName: "trophy.fill")
                .font(.system(size: 54))
                .foregroundStyle(FitTheme.orange)
                .padding(.top, 26)
            VStack(spacing: 6) {
                Text("Treino concluído!").font(.title2.bold())
                Text(dayName).foregroundStyle(FitTheme.secondaryText)
            }
            HStack(spacing: 12) {
                MetricPill(icon: "list.bullet", value: "\(exercises)", label: "exercícios")
                MetricPill(icon: "checkmark.circle.fill", value: "\(sets)", label: "séries", tint: FitTheme.green)
                MetricPill(icon: "clock.fill", value: durationText, label: "duração", tint: FitTheme.blue)
            }
            .padding(.horizontal, 20)
            Button {
                dismiss()
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
