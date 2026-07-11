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

private struct WorkoutDayDetailView: View {
    let day: WorkoutDay
    var body: some View {
        List(day.exercises) { exercise in
            VStack(alignment: .leading, spacing: 7) {
                Text(exercise.name).font(.headline)
                Text("\(exercise.sets) séries × \(exercise.reps) • \(exercise.rest)s")
                    .font(.subheadline).foregroundStyle(FitTheme.orange)
                if let equipment = exercise.equipment { Text(equipment).font(.caption).foregroundStyle(FitTheme.secondaryText) }
                if let instructions = exercise.instructions { Text(instructions).font(.footnote).foregroundStyle(FitTheme.secondaryText) }
            }.padding(.vertical, 8).listRowBackground(FitTheme.surface)
        }.scrollContentBackground(.hidden).fitScreen().navigationTitle(day.name)
    }
}
