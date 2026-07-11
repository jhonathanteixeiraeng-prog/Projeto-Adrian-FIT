import SwiftUI

struct StudentHomeView: View {
    let user: AppUser
    @Environment(\.apiClient) private var api
    @State private var dashboard: StudentDashboard?
    @State private var isLoading = true
    @State private var error: String?

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
        .refreshable { await load() }
        .task { await load() }
    }

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Olá, \(user.name.components(separatedBy: " ").first ?? user.name)")
                    .font(.system(size: 30, weight: .bold, design: .rounded))
                Text(Date.now.formatted(.dateTime.weekday(.wide).day().month(.wide)))
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
            NavigationLink { WorkoutSessionView(workout: workout) } label: {
                SurfaceCard {
                    VStack(alignment: .leading, spacing: 18) {
                        HStack {
                            Label("TREINO DE HOJE", systemImage: "bolt.fill").font(.caption.bold()).foregroundStyle(FitTheme.orange)
                            Spacer()
                            Image(systemName: "arrow.up.right").foregroundStyle(FitTheme.secondaryText)
                        }
                        Text(workout.name).font(.title2.bold()).foregroundStyle(.white)
                        HStack(spacing: 18) {
                            Label("\(workout.exercises.count) exercícios", systemImage: "list.bullet")
                            Label("~\(max(25, workout.exercises.count * 7)) min", systemImage: "clock")
                        }.font(.subheadline).foregroundStyle(FitTheme.secondaryText)
                        Text("COMEÇAR TREINO")
                            .font(.caption.bold()).tracking(0.8).foregroundStyle(.white)
                            .padding(.horizontal, 16).padding(.vertical, 11)
                            .background(FitTheme.orange, in: Capsule())
                    }
                }
            }.buttonStyle(.plain)
        } else {
            SurfaceCard { Label("Nenhum treino programado para hoje", systemImage: "figure.cooldown").foregroundStyle(FitTheme.secondaryText) }
        }

        HStack(spacing: 12) {
            MetricPill(icon: "flame.fill", value: "\(data.stats.streak)", label: "dias seguidos", tint: FitTheme.orange)
            MetricPill(icon: "checkmark.circle.fill", value: "\(data.stats.weeklyWorkouts)/\(data.stats.weeklyGoal)", label: "treinos na semana", tint: FitTheme.green)
        }

        if let meals = data.diet?.meals {
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
                            Text(meal.foods.prefix(2).map(\.name).joined(separator: " • ")).font(.caption).foregroundStyle(FitTheme.secondaryText).lineLimit(1)
                        }
                        Spacer()
                        Text(meal.time).font(.subheadline.monospacedDigit()).foregroundStyle(FitTheme.secondaryText)
                    }
                    .padding(15).background(FitTheme.surface, in: RoundedRectangle(cornerRadius: 19))
                }
            }
        }

        SurfaceCard {
            HStack(spacing: 14) {
                Image(systemName: "person.crop.circle.badge.checkmark").font(.title).foregroundStyle(FitTheme.blue)
                VStack(alignment: .leading) {
                    Text(data.personal.name).font(.headline)
                    Text(data.personal.brandName).font(.caption).foregroundStyle(FitTheme.secondaryText)
                }
                Spacer()
                Image(systemName: "message.fill").foregroundStyle(FitTheme.orange)
            }
        }
    }

    private func load() async {
        isLoading = dashboard == nil
        defer { isLoading = false }
        do { dashboard = try await api.get("/api/student/dashboard"); error = nil }
        catch { self.error = error.localizedDescription }
    }
}

struct WorkoutSessionView: View {
    let workout: TodayWorkout
    @State private var completed: Set<String> = []

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text(workout.name).font(.largeTitle.bold())
                Text("Toque em cada exercício ao concluir.").foregroundStyle(FitTheme.secondaryText)
                ForEach(Array(workout.exercises.enumerated()), id: \.element.id) { index, exercise in
                    Button { withAnimation(.snappy) { toggle(exercise.id) } } label: {
                        HStack(spacing: 14) {
                            Text(String(format: "%02d", index + 1)).font(.caption.bold()).foregroundStyle(FitTheme.orange)
                            VStack(alignment: .leading, spacing: 5) {
                                Text(exercise.name).font(.headline).foregroundStyle(.white)
                                Text("\(exercise.sets) séries × \(exercise.reps)  •  \(exercise.rest)s descanso")
                                    .font(.caption).foregroundStyle(FitTheme.secondaryText)
                            }
                            Spacer()
                            Image(systemName: completed.contains(exercise.id) ? "checkmark.circle.fill" : "circle")
                                .font(.title2).foregroundStyle(completed.contains(exercise.id) ? FitTheme.green : FitTheme.secondaryText)
                        }
                        .padding(17).background(FitTheme.surface, in: RoundedRectangle(cornerRadius: 20))
                    }.buttonStyle(.plain)
                }
            }.padding(20)
        }.fitScreen().navigationTitle("Sessão").navigationBarTitleDisplayMode(.inline)
    }

    private func toggle(_ id: String) { if completed.contains(id) { completed.remove(id) } else { completed.insert(id) } }
}
