import SwiftUI
@preconcurrency import UserNotifications

struct ReminderPreferencesView: View {
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
              footer: { Text("Treino no horário escolhido, alimentação ao meio-dia e check-in aos domingos às 18h.") }
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
        let id = identifier(kind)
        center.removePendingNotificationRequests(withIdentifiers: [id])
        guard enabled else { return }
        do {
            guard try await center.requestAuthorization(options: [.alert, .sound, .badge]) else { permissionDenied = true; return }
            let content = UNMutableNotificationContent()
            content.sound = .default
            let components: DateComponents
            switch kind {
            case .workout:
                content.title = "Hora do seu treino"; content.body = "Seu treino está pronto. Vamos manter a sequência?"
                components = DateComponents(hour: workoutHour)
            case .meal:
                content.title = "Seu plano alimentar"; content.body = "Confira a próxima refeição e mantenha o plano em dia."
                components = DateComponents(hour: 12)
            case .checkin:
                content.title = "Check-in semanal"; content.body = "Registre seu progresso e compartilhe a semana com seu personal."
                components = DateComponents(hour: 18, weekday: 1)
            }
            let request = UNNotificationRequest(identifier: id, content: content, trigger: UNCalendarNotificationTrigger(dateMatching: components, repeats: true))
            try await center.add(request); permissionDenied = false
        } catch { permissionDenied = true }
    }

    private func identifier(_ kind: Kind) -> String {
        switch kind { case .workout: "adrianfit.reminder.workout"; case .meal: "adrianfit.reminder.meal"; case .checkin: "adrianfit.reminder.checkin" }
    }
}
