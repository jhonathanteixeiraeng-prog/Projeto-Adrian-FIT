import SwiftUI

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
                        ExerciseSessionRow(exercise: exercise, store: store) { rest in
                            startRest(seconds: rest)
                        }
                    }
                    .listRowBackground(FitTheme.surface)
                }
            }
            .scrollContentBackground(.hidden)

            if let remaining = restRemaining {
                RestTimerOverlay(remaining: remaining, total: restTotal) { stopRest() }
            }
        }
        .fitScreen()
        .navigationTitle(day.name)
        .navigationBarTitleDisplayMode(.inline)
        .onDisappear { stopRest() }
    }

    private func startRest(seconds: Int) {
        guard seconds > 0 else { return }
        stopRest()
        restTotal = seconds
        restRemaining = seconds
        restTask = Task {
            var left = seconds
            while left > 0 && !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1))
                guard !Task.isCancelled else { return }
                left -= 1
                restRemaining = left
            }
            if !Task.isCancelled { restRemaining = nil }
        }
    }

    private func stopRest() {
        restTask?.cancel()
        restTask = nil
        restRemaining = nil
    }
}

private struct ExerciseSessionRow: View {
    let exercise: ExerciseItem
    @ObservedObject var store: WorkoutSessionStore
    let onSetCompleted: (Int) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(exercise.name).font(.headline)
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

            if let instructions = exercise.instructions, !instructions.isEmpty {
                Text(instructions).font(.footnote).foregroundStyle(FitTheme.secondaryText).lineLimit(3)
            }
        }
        .padding(.vertical, 6)
    }
}

private struct RestTimerOverlay: View {
    let remaining: Int
    let total: Int
    let onSkip: () -> Void

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
            Button("Pular descanso") { onSkip() }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(FitTheme.orange)
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
