import SwiftUI
@preconcurrency import UserNotifications

struct ReminderPreferencesView: View {
    @Environment(\.apiClient) private var api
    @AppStorage("reminder-workout") private var workoutEnabled = false
    @AppStorage("reminder-meal") private var mealEnabled = false
    @AppStorage("reminder-checkin") private var checkinEnabled = false
    @AppStorage("reminder-workout-hour") private var workoutHour = 18
    @State private var permissionDenied = false

    var body: some View {
        Form {
            Section {
                Toggle(isOn: binding(for: .workout)) { Label("Hora do treino", systemImage: "dumbbell.fill") }
                if workoutEnabled {
                    DatePicker("Horário", selection: workoutTime, displayedComponents: .hourAndMinute)
                }
                Toggle(isOn: binding(for: .meal)) { Label("Plano alimentar", systemImage: "fork.knife") }
                Toggle(isOn: binding(for: .checkin)) { Label("Check-in semanal", systemImage: "chart.line.uptrend.xyaxis") }
            } header: { Text("Lembretes do aluno") }
              footer: { Text("Treino no horário escolhido, refeições nos horários do seu plano alimentar e check-in aos domingos às 18h.") }
              .listRowBackground(FitTheme.surface)

            if permissionDenied {
                Section {
                    Label("Ative as notificações nos Ajustes do iPhone para receber lembretes.", systemImage: "exclamationmark.triangle.fill")
                        .font(.caption).foregroundStyle(.orange)
                }.listRowBackground(FitTheme.surface)
            }
        }
        .scrollContentBackground(.hidden).fitScreen()
        .navigationTitle("Lembretes").navigationBarTitleDisplayMode(.inline)
    }

    private enum Kind { case workout, meal, checkin }

    private func binding(for kind: Kind) -> Binding<Bool> {
        Binding {
            switch kind { case .workout: workoutEnabled; case .meal: mealEnabled; case .checkin: checkinEnabled }
        } set: { value in
            switch kind { case .workout: workoutEnabled = value; case .meal: mealEnabled = value; case .checkin: checkinEnabled = value }
            Task { await configure(kind, enabled: value) }
        }
    }

    private var workoutTime: Binding<Date> {
        Binding {
            Calendar.current.date(from: DateComponents(hour: workoutHour)) ?? .now
        } set: { date in
            workoutHour = Calendar.current.component(.hour, from: date)
            Task { await configure(.workout, enabled: workoutEnabled) }
        }
    }

    private func configure(_ kind: Kind, enabled: Bool) async {
        let center = UNUserNotificationCenter.current()
        let pending = await center.pendingNotificationRequests().map(\.identifier)
        center.removePendingNotificationRequests(withIdentifiers: pending.filter { $0.hasPrefix(identifier(kind)) })
        guard enabled else { return }
        do {
            guard try await center.requestAuthorization(options: [.alert, .sound, .badge]) else { permissionDenied = true; return }

            switch kind {
            case .workout:
                let content = UNMutableNotificationContent()
                content.sound = .default
                content.title = "Hora do seu treino"
                content.body = "Seu treino está pronto. Vamos manter a sequência?"
                try await center.add(UNNotificationRequest(
                    identifier: identifier(kind),
                    content: content,
                    trigger: UNCalendarNotificationTrigger(dateMatching: DateComponents(hour: workoutHour), repeats: true)
                ))

            case .meal:
                try await scheduleMealReminders(center: center)

            case .checkin:
                let content = UNMutableNotificationContent()
                content.sound = .default
                content.title = "Check-in semanal"
                content.body = "Registre seu progresso e compartilhe a semana com seu personal."
                try await center.add(UNNotificationRequest(
                    identifier: identifier(kind),
                    content: content,
                    trigger: UNCalendarNotificationTrigger(dateMatching: DateComponents(hour: 18, weekday: 1), repeats: true)
                ))
            }
            permissionDenied = false
        } catch { permissionDenied = true }
    }

    /// Agenda um lembrete por refeição, nos horários reais do plano do aluno.
    private func scheduleMealReminders(center: UNUserNotificationCenter) async throws {
        var meals: [(name: String, hour: Int, minute: Int)] = []
        if let plan: DietPlan = try? await api.get("/api/student/diet") {
            meals = plan.meals.compactMap { meal in
                let parts = meal.time.split(separator: ":").compactMap { Int($0) }
                guard parts.count >= 2, (0...23).contains(parts[0]), (0...59).contains(parts[1]) else { return nil }
                return (meal.name, parts[0], parts[1])
            }
        }
        if meals.isEmpty {
            meals = [("Sua refeição", 12, 0)] // fallback quando não há plano carregável
        }

        for (index, meal) in meals.prefix(10).enumerated() {
            let content = UNMutableNotificationContent()
            content.sound = .default
            content.title = meal.name
            content.body = "Hora da refeição do seu plano. Bom apetite! 🍽️"
            try await center.add(UNNotificationRequest(
                identifier: "\(identifier(.meal)).\(index)",
                content: content,
                trigger: UNCalendarNotificationTrigger(dateMatching: DateComponents(hour: meal.hour, minute: meal.minute), repeats: true)
            ))
        }
    }

    private func identifier(_ kind: Kind) -> String {
        switch kind { case .workout: "adrianfit.reminder.workout"; case .meal: "adrianfit.reminder.meal"; case .checkin: "adrianfit.reminder.checkin" }
    }
}
