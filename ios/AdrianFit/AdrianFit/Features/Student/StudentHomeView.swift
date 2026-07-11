import SwiftUI

struct StudentHomeView: View {
    let user: AppUser
    @Environment(\.apiClient) private var api
    @State private var dashboard: StudentDashboard?
    @State private var isLoading = true
    @State private var error: String?
    @State private var personalUserId: String?
    @State private var localStats = (week: 0, total: 0)

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
            NavigationLink { TodayWorkoutSessionView(dayId: workout.id) } label: {
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
            MetricPill(icon: "checkmark.circle.fill", value: "\(localStats.week)", label: "treinos esta semana", tint: FitTheme.green)
            MetricPill(icon: "flame.fill", value: "\(localStats.total)", label: "treinos concluídos", tint: FitTheme.orange)
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
                        Text(data.personal.name).font(.headline).foregroundStyle(.white)
                        Text("Enviar mensagem").font(.caption).foregroundStyle(FitTheme.orange)
                    }
                    Spacer()
                    Image(systemName: "message.fill").foregroundStyle(FitTheme.orange)
                }
            }
        }
        .buttonStyle(.plain)
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
    }
}
