import SwiftUI

private let weekdayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]

struct WorkoutPlanEditorView: View {
    @Environment(\.apiClient) private var api
    @Environment(\.dismiss) private var dismiss

    let planId: String

    @State private var title = ""
    @State private var days: [EditableWorkoutDay] = []
    @State private var loading = true
    @State private var saving = false
    @State private var error: String?
    @State private var pickerDayId: UUID?
    @State private var showSaved = false

    private var safetyIssue: String? {
        if title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return "Informe o título do plano." }
        if days.isEmpty { return "Adicione pelo menos um dia de treino." }
        for day in days {
            if day.items.isEmpty { return "Adicione ao menos um exercício em \(day.name)." }
            for item in day.items {
                let reps = item.reps.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                if reps.isEmpty || reps == "reps" || reps.contains("definir") { return "Informe as repetições de \(item.exerciseName)." }
                if !(1...12).contains(item.sets) { return "Revise as séries de \(item.exerciseName)." }
                if !(0...600).contains(item.rest) { return "Revise o descanso de \(item.exerciseName)." }
                if item.customRest && (item.restBySet.count != item.sets || item.restBySet.contains(where: { !(0...600).contains($0) })) {
                    return "Revise os descansos por série de \(item.exerciseName)."
                }
            }
        }
        return nil
    }

    var body: some View {
        Group {
            if loading { ProgressView("Carregando treino…").frame(maxWidth: .infinity, maxHeight: .infinity) }
            else if let error, days.isEmpty && title.isEmpty {
                ContentUnavailableView("Treino indisponível", systemImage: "dumbbell", description: Text(error))
            } else { editor }
        }
        .fitScreen()
        .navigationTitle("Editar treino")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button(saving ? "Salvando…" : "Salvar") { Task { await save() } }
                    .disabled(saving || loading || safetyIssue != nil)
                    .fontWeight(.semibold)
            }
        }
        .task { await load() }
        .sheet(isPresented: Binding(get: { pickerDayId != nil }, set: { if !$0 { pickerDayId = nil } })) {
            ExercisePickerView { exercise in
                addExercise(exercise)
                pickerDayId = nil
            }
        }
        .alert("Treino salvo", isPresented: $showSaved) {
            Button("OK") { dismiss() }
        } message: { Text("As alterações já estão disponíveis para o aluno.") }
        .alert("Erro", isPresented: Binding(get: { error != nil && !loading && !(days.isEmpty && title.isEmpty) }, set: { if !$0 { error = nil } })) {
            Button("OK", role: .cancel) {}
        } message: { Text(error ?? "") }
    }

    private var editor: some View {
        List {
            Section {
                TextField("Título do plano", text: $title)
                    .font(.headline)
                if let safetyIssue {
                    Label(safetyIssue, systemImage: "exclamationmark.triangle.fill")
                        .font(.caption)
                        .foregroundStyle(.red)
                }
            } header: { Text("Plano") }
                .listRowBackground(FitTheme.surface)

            ForEach($days) { $day in
                Section {
                    HStack {
                        TextField("Nome do dia", text: $day.name).font(.subheadline.weight(.semibold))
                        Spacer()
                        Menu {
                            ForEach(0..<7, id: \.self) { weekday in
                                Button(weekdayNames[weekday]) { day.dayOfWeek = weekday }
                            }
                        } label: {
                            Text(weekdayNames[day.dayOfWeek])
                                .font(.caption.weight(.semibold))
                                .padding(.horizontal, 10).padding(.vertical, 6)
                                .background(FitTheme.orange.opacity(0.16), in: Capsule())
                                .foregroundStyle(FitTheme.orange)
                        }
                    }

                    ForEach($day.items) { $item in
                        ExerciseEditorRow(item: $item)
                    }
                    .onDelete { offsets in day.items.remove(atOffsets: offsets) }
                    .onMove { source, destination in day.items.move(fromOffsets: source, toOffset: destination) }

                    Button {
                        pickerDayId = day.id
                    } label: {
                        Label("Adicionar exercício", systemImage: "plus.circle.fill")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(FitTheme.orange)
                    }
                } header: {
                    HStack {
                        Text(day.name.isEmpty ? "Dia de treino" : day.name)
                        Spacer()
                        Button(role: .destructive) {
                            days.removeAll { $0.id == day.id }
                        } label: { Image(systemName: "trash").font(.caption) }
                    }
                }
                .listRowBackground(FitTheme.surface)
            }

            Section {
                Button {
                    days.append(EditableWorkoutDay(name: "Treino \(Character(UnicodeScalar(65 + days.count % 26)!))", dayOfWeek: min(days.count + 1, 6), items: []))
                } label: {
                    Label("Adicionar dia de treino", systemImage: "calendar.badge.plus")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                }
                .foregroundStyle(FitTheme.orange)
            }
            .listRowBackground(FitTheme.surface)
        }
        .scrollContentBackground(.hidden)
        .environment(\.editMode, .constant(.active))
    }

    private func addExercise(_ exercise: Exercise) {
        guard let dayId = pickerDayId, let index = days.firstIndex(where: { $0.id == dayId }) else { return }
        days[index].items.append(EditableWorkoutItem(
            exerciseId: exercise.id,
            exerciseName: exercise.name,
            muscleGroup: exercise.muscleGroup,
            sets: 3, reps: "12", rest: 60, customRest: false, restBySet: [60, 60, 60], notes: ""
        ))
    }

    private func load() async {
        loading = true
        defer { loading = false }
        do {
            let plan: WorkoutPlanDetail = try await api.getRaw("/api/workout-plans/\(planId)")
            title = plan.title
            days = plan.workoutDays.map { day in
                EditableWorkoutDay(
                    name: day.name,
                    dayOfWeek: day.dayOfWeek,
                    items: day.items.map { item in
                        EditableWorkoutItem(
                            exerciseId: item.exercise.id,
                            exerciseName: item.exercise.name,
                            muscleGroup: item.exercise.muscleGroup,
                            sets: item.sets, reps: item.reps, rest: item.rest,
                            customRest: item.restBySet != nil,
                            restBySet: decodeRests(item.restBySet, sets: item.sets, fallback: item.rest),
                            notes: item.notes ?? ""
                        )
                    }
                )
            }
            error = nil
        } catch { self.error = error.localizedDescription }
    }

    private func save() async {
        if let safetyIssue { error = safetyIssue; return }
        saving = true
        defer { saving = false }
        let body = WorkoutPlanUpdateBody(
            title: title.isEmpty ? "Plano de treino" : title,
            active: true,
            workoutDays: days.map { day in
                WorkoutDayBody(
                    name: day.name.isEmpty ? "Dia de treino" : day.name,
                    dayOfWeek: day.dayOfWeek,
                    items: day.items.map { item in
                        WorkoutItemBody(
                            exerciseId: item.exerciseId, sets: item.sets, reps: item.reps, rest: item.rest,
                            restBySet: item.customRest ? encodeRests(item.restBySet) : nil,
                            notes: item.notes
                        )
                    }
                )
            }
        )
        do {
            let _: WorkoutPlanDetail = try await api.put("/api/workout-plans/\(planId)", body: body)
            showSaved = true
        } catch { self.error = error.localizedDescription }
    }

    private func decodeRests(_ value: String?, sets: Int, fallback: Int) -> [Int] {
        guard let value, let data = value.data(using: .utf8), let decoded = try? JSONDecoder().decode([Int].self, from: data) else {
            return Array(repeating: fallback, count: sets)
        }
        return (0..<sets).map { decoded.indices.contains($0) ? decoded[$0] : fallback }
    }

    private func encodeRests(_ values: [Int]) -> String? {
        guard let data = try? JSONEncoder().encode(values) else { return nil }
        return String(data: data, encoding: .utf8)
    }
}

private struct ExerciseEditorRow: View {
    @Binding var item: EditableWorkoutItem

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            VStack(alignment: .leading, spacing: 3) {
                Text(item.exerciseName).font(.subheadline.weight(.semibold))
                Text(item.muscleGroup).font(.caption2).foregroundStyle(FitTheme.secondaryText)
            }
            HStack(spacing: 14) {
                Stepper(value: $item.sets, in: 1...12) {
                    Text("\(item.sets) séries").font(.caption)
                }
                .fixedSize()
                Spacer()
            }
            HStack(spacing: 14) {
                HStack(spacing: 6) {
                    Text("Reps").font(.caption).foregroundStyle(FitTheme.secondaryText)
                    TextField("12", text: $item.reps)
                        .frame(width: 64)
                        .textFieldStyle(.roundedBorder)
                        .font(.caption)
                }
                Stepper(value: $item.rest, in: 0...600, step: 15) {
                    Text("\(item.rest)s descanso").font(.caption)
                }
                .fixedSize()
                .disabled(item.customRest)
            }
            Picker("Descanso", selection: $item.customRest) {
                Text("Mesmo em todas").tag(false)
                Text("Por série").tag(true)
            }
            .pickerStyle(.segmented)

            if item.customRest {
                VStack(spacing: 8) {
                    ForEach(0..<item.sets, id: \.self) { index in
                        Stepper(value: restBinding(index), in: 0...600, step: 15) {
                            HStack {
                                Text(index == 0 ? "Após aquecimento/série 1" : "Após série \(index + 1)")
                                Spacer()
                                Text("\(restValue(index))s").monospacedDigit().foregroundStyle(FitTheme.orange)
                            }.font(.caption)
                        }
                    }
                }
                .padding(10)
                .background(FitTheme.surfaceRaised, in: RoundedRectangle(cornerRadius: 12))
            }
        }
        .padding(.vertical, 4)
        .onChange(of: item.sets) { _, sets in
            if item.restBySet.count < sets { item.restBySet.append(contentsOf: Array(repeating: item.rest, count: sets - item.restBySet.count)) }
            else if item.restBySet.count > sets { item.restBySet = Array(item.restBySet.prefix(sets)) }
        }
    }

    private func restValue(_ index: Int) -> Int { item.restBySet.indices.contains(index) ? item.restBySet[index] : item.rest }

    private func restBinding(_ index: Int) -> Binding<Int> {
        Binding(get: { restValue(index) }, set: { value in
            while item.restBySet.count <= index { item.restBySet.append(item.rest) }
            item.restBySet[index] = value
        })
    }
}

struct ExercisePickerView: View {
    @Environment(\.apiClient) private var api
    @Environment(\.dismiss) private var dismiss

    let onSelect: (Exercise) -> Void

    @State private var query = ""
    @State private var exercises: [Exercise] = []
    @State private var loading = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Group {
                if loading && exercises.isEmpty { ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity) }
                else if let error { ContentUnavailableView("Erro", systemImage: "exclamationmark.triangle", description: Text(error)) }
                else {
                    List(exercises) { exercise in
                        Button {
                            onSelect(exercise)
                            dismiss()
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(exercise.name).font(.subheadline.weight(.semibold)).foregroundStyle(FitTheme.primaryText)
                                HStack(spacing: 8) {
                                    Text(exercise.muscleGroup)
                                    if let equipment = exercise.equipment, !equipment.isEmpty { Text("· \(equipment)") }
                                }
                                .font(.caption2).foregroundStyle(FitTheme.secondaryText)
                            }
                        }
                        .listRowBackground(FitTheme.surface)
                    }
                    .scrollContentBackground(.hidden)
                }
            }
            .fitScreen()
            .navigationTitle("Exercícios")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $query, prompt: "Buscar exercício")
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Fechar") { dismiss() } } }
            .task { await search() }
            .task(id: query) {
                try? await Task.sleep(for: .milliseconds(350))
                guard !Task.isCancelled else { return }
                await search()
            }
        }
    }

    private func search() async {
        loading = true
        defer { loading = false }
        do {
            let path = query.isEmpty
                ? "/api/exercises"
                : "/api/exercises?search=\(query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query)"
            exercises = try await api.get(path)
            error = nil
        } catch { self.error = error.localizedDescription }
    }
}
