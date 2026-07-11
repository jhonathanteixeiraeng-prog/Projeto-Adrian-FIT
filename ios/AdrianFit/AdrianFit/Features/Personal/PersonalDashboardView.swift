import SwiftUI

struct PersonalDashboardView: View {
    let user: AppUser
    @Environment(\.apiClient) private var api
    @State private var dashboard: PersonalDashboard?
    @State private var error: String?

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 22) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Visão geral").font(.system(size: 31, weight: .bold, design: .rounded))
                        Text("Olá, \(user.name.components(separatedBy: " ").first ?? user.name)").foregroundStyle(FitTheme.secondaryText)
                    }
                    Spacer(); BrandMark()
                }
                if let dashboard { content(dashboard) }
                else if let error { ContentUnavailableView("Dados indisponíveis", systemImage: "chart.bar.xaxis", description: Text(error)) }
                else { ProgressView().frame(maxWidth: .infinity).padding(.top, 80) }
            }.padding(20)
        }
        .fitScreen().toolbar(.hidden, for: .navigationBar)
        .refreshable { await load() }.task { await load() }
    }

    @ViewBuilder private func content(_ data: PersonalDashboard) -> some View {
        HStack(spacing: 12) {
            MetricPill(icon: "person.2.fill", value: "\(data.activeStudents)", label: "alunos ativos", tint: FitTheme.orange)
            MetricPill(icon: "checkmark.seal.fill", value: "\(data.averageWorkoutAdherence)%", label: "adesão aos treinos", tint: FitTheme.green)
        }
        HStack(spacing: 12) {
            MetricPill(icon: "fork.knife", value: "\(data.averageDietAdherence)%", label: "adesão à dieta", tint: FitTheme.blue)
            MetricPill(icon: "exclamationmark.circle.fill", value: "\(data.pendingCheckins)", label: "check-ins pendentes", tint: .yellow)
        }
        if !data.lowAdherenceStudents.isEmpty {
            SectionHeading(title: "Precisam de atenção")
            ForEach(data.lowAdherenceStudents.prefix(4)) { student in
                HStack(spacing: 14) {
                    Circle().fill(Color.yellow.opacity(0.14)).frame(width: 44, height: 44)
                        .overlay { Image(systemName: "exclamationmark").foregroundStyle(.yellow) }
                    VStack(alignment: .leading, spacing: 3) {
                        Text(student.name).font(.headline)
                        Text("Treino \(student.workoutAdherence ?? 0)% • Dieta \(student.dietAdherence ?? 0)%")
                            .font(.caption).foregroundStyle(FitTheme.secondaryText)
                    }
                    Spacer(); Image(systemName: "chevron.right").foregroundStyle(FitTheme.secondaryText)
                }.padding(15).background(FitTheme.surface, in: RoundedRectangle(cornerRadius: 19))
            }
        }
        SurfaceCard {
            HStack {
                VStack(alignment: .leading, spacing: 6) {
                    Text("\(data.studentsWithoutWorkout72h)").font(.title.bold()).foregroundStyle(FitTheme.orange)
                    Text("alunos sem treinar há 72h").font(.subheadline).foregroundStyle(FitTheme.secondaryText)
                }
                Spacer(); Image(systemName: "clock.badge.exclamationmark").font(.largeTitle).foregroundStyle(FitTheme.orange.opacity(0.8))
            }
        }
    }

    private func load() async { do { dashboard = try await api.get("/api/dashboard"); error = nil } catch { self.error = error.localizedDescription } }
}
