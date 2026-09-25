import SwiftUI
@preconcurrency import UserNotifications

struct ReminderPreferencesView: View {
    @Environment(\.apiClient) private var api
    @AppStorage("reminder-workout") private var workoutEnabled = false
    @AppStorage("reminder-meal") private var mealEnabled = false
    @AppStorage("reminder-checkin") private var checkinEnabled = false
    @AppStorage("reminder-water") private var waterEnabled = false
    @AppStorage("reminder-workout-hour") private var workoutHour = 18
    @AppStorage("reminder-water-interval-hours") private var waterIntervalHours = 2
    @AppStorage("reminder-water-start-hour") private var waterStartHour = 8
    @AppStorage("reminder-water-end-hour") private var waterEndHour = 22
    @State private var permissionDenied = false

    var body: some View {
        Form {
            Section {
                Toggle(isOn: binding(for: .water)) {
                    Label("Lembrar de tomar água", systemImage: "drop.fill")
                }

                if waterEnabled {
                    Picker("Intervalo", selection: $waterIntervalHours) {
                        Text("1 hora").tag(1)
                        Text("2 horas").tag(2)
                        Text("3 horas").tag(3)
                    }
                    .pickerStyle(.segmented)
                    .onChange(of: waterIntervalHours) {
                        Task { await configure(.water, enabled: true) }
                    }

                    DatePicker("Começar às", selection: waterStartTime, displayedComponents: .hourAndMinute)
                    DatePicker("Encerrar às", selection: waterEndTime, displayedComponents: .hourAndMinute)

                    Label(
                        "\(waterReminderHours.count) lembretes por dia · 1 copo de 250 ml",
                        systemImage: "bell.badge"
                    )
                    .font(.caption)
                    .foregroundStyle(FitTheme.secondaryText)
                }
            } header: {
                Text("Hidratação")
            } footer: {
                Text("Você receberá lembretes durante o período escolhido. Marque cada copo na aba Dieta para acompanhar sua meta diária.")
            }
            .listRowBackground(FitTheme.surface)

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

    private enum Kind { case water, workout, meal, checkin }

    private func binding(for kind: Kind) -> Binding<Bool> {
        Binding {
            switch kind {
            case .water: waterEnabled
            case .workout: workoutEnabled
            case .meal: mealEnabled
            case .checkin: checkinEnabled
            }
        } set: { value in
            switch kind {
            case .water: waterEnabled = value
            case .workout: workoutEnabled = value
            case .meal: mealEnabled = value
            case .checkin: checkinEnabled = value
            }
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

    private var waterStartTime: Binding<Date> {
        hourBinding(value: waterStartHour) { hour in
            waterStartHour = hour
            Task { await configure(.water, enabled: waterEnabled) }
        }
    }

    private var waterEndTime: Binding<Date> {
        hourBinding(value: waterEndHour) { hour in
            waterEndHour = hour
            Task { await configure(.water, enabled: waterEnabled) }
        }
    }

    private func hourBinding(value: Int, onChange: @escaping (Int) -> Void) -> Binding<Date> {
        Binding {
            Calendar.current.date(from: DateComponents(hour: value)) ?? .now
        } set: { date in
            onChange(Calendar.current.component(.hour, from: date))
        }
    }

    private var waterReminderHours: [Int] {
        let availableHours: [Int]
        if waterStartHour <= waterEndHour {
            availableHours = Array(waterStartHour...waterEndHour)
        } else {
            availableHours = Array(waterStartHour...23) + Array(0...waterEndHour)
        }
        return stride(from: 0, to: availableHours.count, by: max(waterIntervalHours, 1))
            .map { availableHours[$0] }
    }

    private func configure(_ kind: Kind, enabled: Bool) async {
        let center = UNUserNotificationCenter.current()
        let pending = await center.pendingNotificationRequests().map(\.identifier)
        center.removePendingNotificationRequests(withIdentifiers: pending.filter { $0.hasPrefix(identifier(kind)) })
        guard enabled else { return }
        do {
            guard try await center.requestAuthorization(options: [.alert, .sound, .badge]) else { permissionDenied = true; return }

            switch kind {
            case .water:
                try await scheduleWaterReminders(center: center)

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

    private func scheduleWaterReminders(center: UNUserNotificationCenter) async throws {
        for hour in waterReminderHours {
            let content = UNMutableNotificationContent()
            content.sound = .default
            content.title = "Hora de beber água 💧"
            content.body = "Beba um copo de 250 ml e marque seu progresso na aba Dieta."
            content.categoryIdentifier = "HYDRATION_REMINDER"

            try await center.add(UNNotificationRequest(
                identifier: "\(identifier(.water)).\(hour)",
                content: content,
                trigger: UNCalendarNotificationTrigger(
                    dateMatching: DateComponents(hour: hour, minute: 0),
                    repeats: true
                )
            ))
        }
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
        switch kind {
        case .water: "adrianfit.reminder.water"
        case .workout: "adrianfit.reminder.workout"
        case .meal: "adrianfit.reminder.meal"
        case .checkin: "adrianfit.reminder.checkin"
        }
    }
}
