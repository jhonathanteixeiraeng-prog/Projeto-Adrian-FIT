import SwiftUI
import Charts

struct WorkoutHistoryView: View {
    @Environment(\.apiClient) private var api
    let studentId: String?

    @State private var history: WorkoutHistoryResponse?
    @State private var loading = true
    @State private var error: String?

    init(studentId: String? = nil) {
        self.studentId = studentId
    }

    var body: some View {
        Group {
            if loading && history == nil {
                ProgressView("Carregando histórico…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let history {
                historyContent(history)
            } else {
                ContentUnavailableView(
                    "Histórico indisponível",
                    systemImage: "clock.arrow.trianglehead.counterclockwise.rotate.90",
                    description: Text(error ?? "Não foi possível carregar seus treinos.")
                )
            }
        }
        .fitScreen()
        .navigationTitle("Histórico de treinos")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await syncPendingCompletions()
            await load()
        }
        .refreshable { await load() }
    }

    private func historyContent(_ data: WorkoutHistoryResponse) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 20) {
                overview(data.summary)

                if !data.sessions.isEmpty {
                    completionChart(data.sessions)
                }

                if !data.exerciseProgress.isEmpty {
                    exerciseSection(data.exerciseProgress)
                }

                recentSessions(data.sessions)
            }
            .padding(20)
            .padding(.bottom, 80)
        }
    }

    private func overview(_ summary: WorkoutHistorySummary) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("SUA CONSISTÊNCIA")
                        .font(.caption.bold())
                        .tracking(0.7)
                        .foregroundStyle(FitTheme.orange)
                    Text("Evolução construída treino a treino")
                        .font(.title2.bold())
                }
                Spacer()
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .font(.title2)
                    .foregroundStyle(FitTheme.orange)
            }

            HStack(spacing: 10) {
                HistoryMetric(value: "\(summary.workoutsThisWeek)/\(max(summary.weeklyGoal, 1))", label: "esta semana", icon: "calendar")
                HistoryMetric(value: "\(summary.totalWorkouts)", label: "treinos", icon: "checkmark.seal.fill", tint: FitTheme.green)
                HistoryMetric(value: "\(summary.weeklyStreak)", label: "semanas", icon: "flame.fill")
            }

            HStack(spacing: 8) {
                Label("Média \(summary.averageCompletionPercentage)% concluída", systemImage: "chart.bar.fill")
                Spacer()
                Label(formatDuration(summary.averageDurationSeconds), systemImage: "clock.fill")
            }
            .font(.caption.weight(.semibold))
            .foregroundStyle(FitTheme.secondaryText)
        }
        .padding(18)
        .background(FitTheme.surface, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
    }

    private func completionChart(_ sessions: [WorkoutSessionRecord]) -> some View {
        let values = Array(sessions.prefix(12).reversed())
        return SurfaceCard {
            VStack(alignment: .leading, spacing: 14) {
                SectionHeading(title: "Ritmo dos últimos treinos")
                Chart(values) { session in
                    BarMark(
                        x: .value("Data", session.day, unit: .day),
                        y: .value("Conclusão", session.percentage)
                    )
                    .foregroundStyle(session.isComplete ? FitTheme.green : FitTheme.orange)
                    .cornerRadius(4)
                }
                .chartYScale(domain: 0...100)
                .chartYAxis {
                    AxisMarks(values: [0, 50, 100]) { value in
                        AxisGridLine().foregroundStyle(FitTheme.separator.opacity(0.35))
                        AxisValueLabel { if let number = value.as(Int.self) { Text("\(number)%") } }
                    }
                }
                .frame(height: 170)
            }
        }
    }

    private func exerciseSection(_ exercises: [ExerciseProgressRecord]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                SectionHeading(title: "Evolução de cargas")
                Spacer()
                Text("Toque para detalhar")
                    .font(.caption2)
                    .foregroundStyle(FitTheme.secondaryText)
            }

            ForEach(exercises.prefix(6)) { exercise in
                NavigationLink { ExerciseProgressDetailView(exercise: exercise) } label: {
                    ExerciseProgressRow(exercise: exercise)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func recentSessions(_ sessions: [WorkoutSessionRecord]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeading(title: "Treinos recentes")
            if sessions.isEmpty {
                SurfaceCard {
                    ContentUnavailableView(
                        "Nenhum treino finalizado",
                        systemImage: "dumbbell",
                        description: Text("Seus próximos treinos aparecerão aqui com cargas, séries e duração.")
                    )
                }
            } else {
                ForEach(sessions) { session in
                    NavigationLink { WorkoutSessionDetailView(session: session) } label: {
                        WorkoutSessionRow(session: session)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func load() async {
        loading = history == nil
        defer { loading = false }
        let today = Date.now.formatted(.iso8601.year().month().day())
        var path = "/api/student/workout/history?today=\(today)"
        if let studentId { path += "&studentId=\(studentId)" }
        do {
            history = try await api.get(path)
            error = nil
        } catch is CancellationError {
            return
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func syncPendingCompletions() async {
        guard studentId == nil else { return }
        for request in PendingWorkoutCompletionStore.all() {
            guard !Task.isCancelled else { return }
            if let _: WorkoutCompletionResult = try? await api.post("/api/student/workout/complete", body: request) {
                PendingWorkoutCompletionStore.remove(request)
            }
        }
    }
}

private struct HistoryMetric: View {
    let value: String
    let label: String
    let icon: String
    var tint: Color = FitTheme.orange

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Image(systemName: icon).foregroundStyle(tint)
            Text(value).font(.title3.bold()).monospacedDigit()
            Text(label).font(.caption2).foregroundStyle(FitTheme.secondaryText)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(FitTheme.surfaceRaised, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}

private struct ExerciseProgressRow: View {
    let exercise: ExerciseProgressRecord

    var body: some View {
        HStack(spacing: 13) {
            Image(systemName: "chart.line.uptrend.xyaxis")
                .font(.headline)
                .frame(width: 42, height: 42)
                .background(FitTheme.orange.opacity(0.14), in: RoundedRectangle(cornerRadius: 13))
                .foregroundStyle(FitTheme.orange)
            VStack(alignment: .leading, spacing: 4) {
                Text(exercise.name).font(.headline).foregroundStyle(FitTheme.primaryText).lineLimit(1)
                Text("\(exercise.totalSets) séries registradas · melhor \(formatWeight(exercise.bestWeight))")
                    .font(.caption).foregroundStyle(FitTheme.secondaryText)
            }
            Spacer()
            if exercise.changePercentage != 0 {
                Text(exercise.changePercentage > 0 ? "+\(exercise.changePercentage)%" : "\(exercise.changePercentage)%")
                    .font(.caption.bold())
                    .foregroundStyle(exercise.changePercentage > 0 ? FitTheme.green : FitTheme.secondaryText)
            }
            Image(systemName: "chevron.right").font(.caption).foregroundStyle(FitTheme.secondaryText)
        }
        .padding(15)
        .background(FitTheme.surface, in: RoundedRectangle(cornerRadius: 19, style: .continuous))
    }
}

private struct WorkoutSessionRow: View {
    let session: WorkoutSessionRecord

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(session.dayName).font(.headline).foregroundStyle(FitTheme.primaryText).lineLimit(2)
                    Text(session.day.formatted(date: .abbreviated, time: .omitted))
                        .font(.caption).foregroundStyle(FitTheme.secondaryText)
                }
                Spacer()
                Text(session.isComplete ? "CONCLUÍDO" : "PARCIAL \(session.percentage)%")
                    .font(.system(size: 9, weight: .bold)).tracking(0.4)
                    .foregroundStyle(session.isComplete ? FitTheme.green : FitTheme.orange)
                    .padding(.horizontal, 8).padding(.vertical, 5)
                    .background((session.isComplete ? FitTheme.green : FitTheme.orange).opacity(0.14), in: Capsule())
            }
            HStack(spacing: 15) {
                Label(session.totalSets > 0 ? "\(session.completedSets)/\(session.totalSets) séries" : "Registro anterior", systemImage: "checkmark.circle")
                if session.durationSeconds > 0 { Label(formatDuration(session.durationSeconds), systemImage: "clock") }
                if session.totalVolume > 0 { Label(formatVolume(session.totalVolume), systemImage: "scalemass") }
            }
            .font(.caption)
            .foregroundStyle(FitTheme.secondaryText)
        }
        .padding(16)
        .background(FitTheme.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(alignment: .trailing) {
            Image(systemName: "chevron.right").font(.caption).foregroundStyle(FitTheme.secondaryText).padding(.trailing, 12)
        }
    }
}

private struct WorkoutSessionDetailView: View {
    let session: WorkoutSessionRecord

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                SurfaceCard {
                    VStack(alignment: .leading, spacing: 14) {
                        Label(session.isComplete ? "TREINO CONCLUÍDO" : "TREINO PARCIAL", systemImage: session.isComplete ? "checkmark.seal.fill" : "flag.checkered")
                            .font(.caption.bold())
                            .foregroundStyle(session.isComplete ? FitTheme.green : FitTheme.orange)
                        Text(session.dayName).font(.title2.bold())
                        Text(session.day.formatted(date: .long, time: .omitted)).foregroundStyle(FitTheme.secondaryText)
                        HStack(spacing: 10) {
                            HistoryMetric(value: "\(session.percentage)%", label: "concluído", icon: "chart.bar.fill")
                            HistoryMetric(value: session.durationSeconds > 0 ? formatDuration(session.durationSeconds) : "—", label: "duração", icon: "clock.fill")
                            HistoryMetric(value: session.totalVolume > 0 ? formatVolume(session.totalVolume) : "—", label: "volume", icon: "scalemass.fill", tint: FitTheme.green)
                        }
                        if session.activeEnergyKilocalories != nil || session.averageHeartRateBPM != nil {
                            Divider().overlay(FitTheme.separator.opacity(0.5))
                            HStack(spacing: 10) {
                                HistoryMetric(
                                    value: session.activeEnergyKilocalories.map { "\(Int($0.rounded())) kcal" } ?? "—",
                                    label: "energia ativa",
                                    icon: "flame.fill",
                                    tint: FitTheme.orange
                                )
                                HistoryMetric(
                                    value: session.averageHeartRateBPM.map { "\(Int($0.rounded())) bpm" } ?? "—",
                                    label: "FC média",
                                    icon: "heart.fill",
                                    tint: .red
                                )
                                HistoryMetric(
                                    value: session.maxHeartRateBPM.map { "\(Int($0.rounded())) bpm" } ?? "—",
                                    label: "FC máxima",
                                    icon: "waveform.path.ecg",
                                    tint: FitTheme.green
                                )
                            }
                        }
                    }
                }

                if session.exercises.isEmpty {
                    Text("Este é um registro anterior à versão que salva os detalhes de cada série.")
                        .font(.subheadline)
                        .foregroundStyle(FitTheme.secondaryText)
                        .padding(16)
                        .background(FitTheme.surface, in: RoundedRectangle(cornerRadius: 18))
                } else {
                    SectionHeading(title: "Exercícios e séries")
                    ForEach(session.exercises) { exercise in
                        SessionExerciseCard(exercise: exercise)
                    }
                }
            }
            .padding(20)
            .padding(.bottom, 70)
        }
        .fitScreen()
        .navigationTitle("Detalhes do treino")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct SessionExerciseCard: View {
    let exercise: WorkoutSessionExercise

    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text(exercise.name).font(.headline)
                    Text(exercise.muscleGroup).font(.caption).foregroundStyle(FitTheme.secondaryText)
                }
                Spacer()
                if exercise.bestWeight > 0 {
                    Label(formatWeight(exercise.bestWeight), systemImage: "trophy.fill")
                        .font(.caption.bold()).foregroundStyle(FitTheme.orange)
                }
            }
            ForEach(exercise.sets) { set in
                HStack {
                    Text("Série \(set.setIndex + 1)").foregroundStyle(FitTheme.secondaryText)
                    Spacer()
                    Text(set.weight > 0 ? formatWeight(set.weight) : "Peso corporal").fontWeight(.semibold)
                    Text("× \(set.reps)").foregroundStyle(FitTheme.secondaryText)
                }
                .font(.subheadline)
                if set.id != exercise.sets.last?.id { Divider().overlay(FitTheme.separator.opacity(0.4)) }
            }
        }
        .padding(16)
        .background(FitTheme.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
}

private struct ExerciseProgressDetailView: View {
    let exercise: ExerciseProgressRecord

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HStack(spacing: 10) {
                    HistoryMetric(value: formatWeight(exercise.bestWeight), label: "recorde", icon: "trophy.fill")
                    HistoryMetric(value: "\(exercise.totalSets)", label: "séries", icon: "list.number", tint: FitTheme.green)
                    HistoryMetric(value: formatVolume(exercise.totalVolume), label: "volume", icon: "scalemass.fill")
                }

                SurfaceCard {
                    VStack(alignment: .leading, spacing: 14) {
                        SectionHeading(title: "Progressão da carga")
                        if exercise.points.filter({ $0.bestWeight > 0 }).count < 2 {
                            Text("Complete mais sessões para formar sua curva de evolução.")
                                .font(.caption).foregroundStyle(FitTheme.secondaryText)
                        }
                        Chart(exercise.points.filter { $0.bestWeight > 0 }) { point in
                            LineMark(x: .value("Data", point.day), y: .value("Carga", point.bestWeight))
                                .foregroundStyle(FitTheme.orange)
                                .interpolationMethod(.catmullRom)
                            PointMark(x: .value("Data", point.day), y: .value("Carga", point.bestWeight))
                                .foregroundStyle(FitTheme.orange)
                        }
                        .chartYScale(domain: .automatic(includesZero: false))
                        .frame(height: 220)
                    }
                }

                VStack(alignment: .leading, spacing: 10) {
                    SectionHeading(title: "Sessões registradas")
                    ForEach(exercise.points.reversed()) { point in
                        HStack {
                            Text(point.day.formatted(date: .abbreviated, time: .omitted))
                            Spacer()
                            Text(formatWeight(point.bestWeight)).fontWeight(.semibold)
                            Text("· \(formatVolume(point.volume))").foregroundStyle(FitTheme.secondaryText)
                        }
                        .font(.subheadline)
                        .padding(14)
                        .background(FitTheme.surface, in: RoundedRectangle(cornerRadius: 16))
                    }
                }
            }
            .padding(20)
            .padding(.bottom, 70)
        }
        .fitScreen()
        .navigationTitle(exercise.name)
        .navigationBarTitleDisplayMode(.inline)
    }
}

private func formatDuration(_ seconds: Int) -> String {
    guard seconds > 0 else { return "—" }
    let minutes = max(1, seconds / 60)
    if minutes < 60 { return "\(minutes) min" }
    return "\(minutes / 60)h \(minutes % 60)min"
}

private func formatWeight(_ value: Double) -> String {
    value == value.rounded() ? "\(Int(value)) kg" : String(format: "%.1f kg", value)
}

private func formatVolume(_ value: Double) -> String {
    if value >= 1_000 { return String(format: "%.1f t", value / 1_000) }
    return "\(Int(value.rounded())) kg"
}
