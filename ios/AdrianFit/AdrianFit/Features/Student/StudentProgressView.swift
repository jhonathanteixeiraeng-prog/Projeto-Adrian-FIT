import SwiftUI
import Charts

// MARK: - Modelos

struct CheckinFull: Codable, Identifiable, Sendable {
    let id: String
    let date: String
    let weight: Double
    let sleepHours: Double?
    let energyLevel: Int?
    let hungerLevel: Int?
    let stressLevel: Int?
    let workoutAdherence: Int
    let dietAdherence: Int
    let notes: String?

    var day: Date {
        (try? Date(date, strategy: .iso8601.year().month().day().timeZone(separator: .omitted).time(includingFractionalSeconds: true)))
            ?? (try? Date(date, strategy: .iso8601))
            ?? .now
    }
}

// MARK: - Progresso

struct StudentProgressView: View {
    @Environment(\.apiClient) private var api
    @State private var checkins: [CheckinFull] = []
    @State private var loading = true
    @State private var error: String?
    @State private var showCheckin = false

    private var ordered: [CheckinFull] { checkins.sorted { $0.day < $1.day } }

    var body: some View {
        Group {
            if loading && checkins.isEmpty { ProgressView("Carregando progresso…").frame(maxWidth: .infinity, maxHeight: .infinity) }
            else if checkins.isEmpty {
                ContentUnavailableView {
                    Label("Sem check-ins ainda", systemImage: "chart.line.uptrend.xyaxis")
                } description: {
                    Text(error ?? "Envie seu primeiro check-in semanal para acompanhar sua evolução.")
                } actions: {
                    Button("Fazer check-in") { showCheckin = true }
                        .buttonStyle(.borderedProminent).tint(FitTheme.orange)
                }
            } else { content }
        }
        .fitScreen()
        .navigationTitle("Progresso")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showCheckin = true } label: {
                    Label("Check-in", systemImage: "plus.circle.fill").fontWeight(.semibold)
                }
            }
        }
        .sheet(isPresented: $showCheckin) {
            CheckinFormView { Task { await load() } }
        }
        .task { await load() }
        .refreshable { await load() }
    }

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                if let last = ordered.last {
                    HStack(spacing: 12) {
                        MetricPill(icon: "scalemass", value: String(format: "%.1f kg", last.weight), label: "peso atual")
                        MetricPill(icon: "dumbbell", value: "\(last.workoutAdherence)%", label: "adesão treino", tint: FitTheme.green)
                        MetricPill(icon: "fork.knife", value: "\(last.dietAdherence)%", label: "adesão dieta", tint: FitTheme.blue)
                    }
                }

                SurfaceCard {
                    VStack(alignment: .leading, spacing: 14) {
                        SectionHeading(title: "Evolução do peso")
                        if ordered.count < 2 {
                            Text("Envie mais check-ins para ver o gráfico da sua evolução.")
                                .font(.caption).foregroundStyle(FitTheme.secondaryText)
                        }
                        Chart(ordered) { checkin in
                            LineMark(x: .value("Data", checkin.day), y: .value("Peso", checkin.weight))
                                .foregroundStyle(FitTheme.orange)
                                .interpolationMethod(.catmullRom)
                            PointMark(x: .value("Data", checkin.day), y: .value("Peso", checkin.weight))
                                .foregroundStyle(FitTheme.orange)
                        }
                        .chartYScale(domain: .automatic(includesZero: false))
                        .frame(height: 180)
                    }
                }

                SurfaceCard {
                    VStack(alignment: .leading, spacing: 14) {
                        SectionHeading(title: "Adesão semanal")
                        Chart(ordered.suffix(8)) { checkin in
                            BarMark(x: .value("Data", checkin.day, unit: .day), y: .value("Treino", checkin.workoutAdherence))
                                .foregroundStyle(FitTheme.green.opacity(0.85))
                                .position(by: .value("Tipo", "Treino"))
                            BarMark(x: .value("Data", checkin.day, unit: .day), y: .value("Dieta", checkin.dietAdherence))
                                .foregroundStyle(FitTheme.blue.opacity(0.85))
                                .position(by: .value("Tipo", "Dieta"))
                        }
                        .chartYScale(domain: 0...100)
                        .frame(height: 150)
                        HStack(spacing: 16) {
                            Label("Treino", systemImage: "square.fill").foregroundStyle(FitTheme.green)
                            Label("Dieta", systemImage: "square.fill").foregroundStyle(FitTheme.blue)
                        }.font(.caption2)
                    }
                }

                SurfaceCard {
                    VStack(alignment: .leading, spacing: 14) {
                        SectionHeading(title: "Histórico")
                        ForEach(checkins.prefix(10)) { checkin in
                            VStack(alignment: .leading, spacing: 5) {
                                HStack {
                                    Text(checkin.day.formatted(date: .abbreviated, time: .omitted))
                                        .font(.subheadline.weight(.semibold))
                                    Spacer()
                                    Text(String(format: "%.1f kg", checkin.weight))
                                        .font(.subheadline.bold()).foregroundStyle(FitTheme.orange)
                                }
                                Text("Treino \(checkin.workoutAdherence)% · Dieta \(checkin.dietAdherence)%")
                                    .font(.caption).foregroundStyle(FitTheme.secondaryText)
                                if let notes = checkin.notes, !notes.isEmpty {
                                    Text(notes).font(.caption2).foregroundStyle(FitTheme.secondaryText).lineLimit(2)
                                }
                                if checkin.id != checkins.prefix(10).last?.id {
                                    Divider().overlay(Color.white.opacity(0.08))
                                }
                            }
                        }
                    }
                }
            }.padding(20)
        }
    }

    private func load() async {
        loading = checkins.isEmpty
        defer { loading = false }
        do { checkins = try await api.get("/api/checkins"); error = nil }
        catch { self.error = error.localizedDescription }
    }
}

// MARK: - Check-in

struct CheckinFormView: View {
    @Environment(\.apiClient) private var api
    @Environment(\.dismiss) private var dismiss

    var onSubmitted: () -> Void = {}

    @State private var weight = ""
    @State private var sleepHours = ""
    @State private var energyLevel = 3
    @State private var hungerLevel = 3
    @State private var stressLevel = 3
    @State private var workoutAdherence = 80.0
    @State private var dietAdherence = 70.0
    @State private var notes = ""
    @State private var sending = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Medidas") {
                    HStack {
                        Label("Peso", systemImage: "scalemass")
                        Spacer()
                        TextField("70,5", text: $weight)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                            .frame(width: 90)
                        Text("kg").foregroundStyle(FitTheme.secondaryText)
                    }
                    HStack {
                        Label("Sono por noite", systemImage: "moon.zzz")
                        Spacer()
                        TextField("7,5", text: $sleepHours)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                            .frame(width: 90)
                        Text("h").foregroundStyle(FitTheme.secondaryText)
                    }
                }
                .listRowBackground(FitTheme.surface)

                Section("Como você se sentiu na semana") {
                    LevelPicker(title: "Energia", icon: "bolt.fill", level: $energyLevel)
                    LevelPicker(title: "Fome", icon: "fork.knife", level: $hungerLevel)
                    LevelPicker(title: "Estresse", icon: "brain.head.profile", level: $stressLevel)
                }
                .listRowBackground(FitTheme.surface)

                Section("Adesão ao plano") {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Label("Treinos", systemImage: "dumbbell")
                            Spacer()
                            Text("\(Int(workoutAdherence))%").bold().foregroundStyle(FitTheme.green)
                        }
                        Slider(value: $workoutAdherence, in: 0...100, step: 5).tint(FitTheme.green)
                    }
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Label("Dieta", systemImage: "fork.knife.circle")
                            Spacer()
                            Text("\(Int(dietAdherence))%").bold().foregroundStyle(FitTheme.blue)
                        }
                        Slider(value: $dietAdherence, in: 0...100, step: 5).tint(FitTheme.blue)
                    }
                }
                .listRowBackground(FitTheme.surface)

                Section("Observações para o personal") {
                    TextField("Como foi a semana? Dificuldades, vitórias…", text: $notes, axis: .vertical)
                        .lineLimit(3...6)
                }
                .listRowBackground(FitTheme.surface)

                if let error {
                    Section { Text(error).foregroundStyle(.red).font(.caption) }
                        .listRowBackground(FitTheme.surface)
                }
            }
            .scrollContentBackground(.hidden)
            .fitScreen()
            .navigationTitle("Check-in semanal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(sending ? "Enviando…" : "Enviar") { Task { await submit() } }
                        .disabled(sending || weight.isEmpty || sleepHours.isEmpty)
                        .fontWeight(.semibold)
                }
            }
        }
    }

    private func submit() async {
        sending = true
        defer { sending = false }
        struct Body: Encodable {
            let weight: String
            let sleepHours: String
            let energyLevel: Int
            let hungerLevel: Int
            let stressLevel: Int
            let workoutAdherence: Int
            let dietAdherence: Int
            let notes: String
        }
        let body = Body(
            weight: weight.replacingOccurrences(of: ",", with: "."),
            sleepHours: sleepHours.replacingOccurrences(of: ",", with: "."),
            energyLevel: energyLevel,
            hungerLevel: hungerLevel,
            stressLevel: stressLevel,
            workoutAdherence: Int(workoutAdherence),
            dietAdherence: Int(dietAdherence),
            notes: notes
        )
        do {
            let _: CheckinFull = try await api.post("/api/checkins", body: body)
            onSubmitted()
            dismiss()
        } catch { self.error = error.localizedDescription }
    }
}

private struct LevelPicker: View {
    let title: String
    let icon: String
    @Binding var level: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(title, systemImage: icon).font(.subheadline)
            HStack(spacing: 8) {
                ForEach(1...5, id: \.self) { value in
                    Button {
                        level = value
                    } label: {
                        Text("\(value)")
                            .font(.subheadline.weight(.semibold))
                            .frame(maxWidth: .infinity)
                            .frame(height: 34)
                            .background(
                                level == value ? FitTheme.orange : FitTheme.surfaceRaised,
                                in: RoundedRectangle(cornerRadius: 10)
                            )
                            .foregroundStyle(level == value ? .white : FitTheme.secondaryText)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.vertical, 2)
    }
}
