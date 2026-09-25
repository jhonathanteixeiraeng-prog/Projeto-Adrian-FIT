import SwiftUI

private let weekdayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]

struct WorkoutPlanEditorView: View {
    @Environment(\.apiClient) private var api
    @Environment(\.dismiss) private var dismiss

    let planId: String?

    init(planId: String) {
        self.planId = planId
        _loading = State(initialValue: true)
    }

    init(newFor studentId: String? = nil) {
        planId = nil
        _selectedStudentId = State(initialValue: studentId ?? "")
        _loading = State(initialValue: true)
    }

    @State private var title = ""
    @State private var days: [EditableWorkoutDay] = []
    @State private var loading = true
    @State private var saving = false
    @State private var error: String?
    @State private var pickerDayId: UUID?
    @State private var showSaved = false
    @State private var students: [StudentListItem] = []
    @State private var selectedStudentId = ""
    @State private var startDate = Date.now
    @State private var endDate = Calendar.current.date(byAdding: .day, value: 90, to: .now) ?? .now
    @State private var active = true
    @State private var saveAsTemplate = false
    /// "Agrupar com o próximo" entre exercícios com séries diferentes, aguardando a confirmação para igualar.
    @State private var pendingGrouping: PendingGrouping?

    private var safetyIssue: String? {
        if planId == nil && selectedStudentId.isEmpty { return "Selecione o aluno que receberá o treino." }
        if endDate < startDate { return "A data final deve ser posterior à data inicial." }
        if title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return "Informe o título do plano." }
        if days.isEmpty { return "Adicione pelo menos um dia de treino." }
        for (dayIndex, day) in days.enumerated() {
            if day.items.isEmpty { return "Adicione ao menos um exercício em \(day.name)." }
            let groups = day.groupInfo
            for (index, item) in day.items.enumerated() {
                let reps = item.reps.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                if reps.isEmpty || reps == "reps" || reps.contains("definir") { return "Informe as repetições de \(item.exerciseName)." }
                if !(1...12).contains(item.sets) { return "Revise as séries de \(item.exerciseName)." }
                // Num grupo, o descanso dos exercícios antes do último não é usado (vai 0).
                if !EditableWorkoutDay.hidesRest(groups[index]) {
                    if !(0...600).contains(item.rest) { return "Revise o descanso de \(item.exerciseName)." }
                    if item.customRest && (item.restBySet.count != item.sets || item.restBySet.contains(where: { !(0...600).contains($0) })) {
                        return "Revise os descansos por série de \(item.exerciseName)."
                    }
                }
                if item.normalizedLoad.error != nil { return "Revise a carga de \(item.exerciseName)." }
                if item.normalizedRpe.error != nil { return "Revise o RPE de \(item.exerciseName)." }
            }
            // Mesma mensagem que o servidor devolveria ("Treino A · exercício 3: Bi-set: …").
            if let issue = WorkoutGroups.findIssues(day.items).first {
                return "\(Self.serverDayLabel(day, index: dayIndex)) · exercício \(issue.index + 1): \(issue.message)"
            }
        }
        return nil
    }

    /// "A2" quando o exercício seguinte é do mesmo grupo.
    private static func nextBadge(_ groups: [WorkoutGroups.Info?], after index: Int) -> String? {
        guard groups.indices.contains(index + 1), let current = groups[index], let next = groups[index + 1],
              next.groupId == current.groupId else { return nil }
        return next.badge
    }

    /// Nome do dia como o servidor o cita nas mensagens de validação.
    private static func serverDayLabel(_ day: EditableWorkoutDay, index: Int) -> String {
        let name = (day.name.isEmpty ? "Dia de treino" : day.name).trimmingCharacters(in: .whitespacesAndNewlines)
        return name.isEmpty ? "Dia \(index + 1)" : name
    }

    var body: some View {
        Group {
            if loading { ProgressView("Carregando treino…").frame(maxWidth: .infinity, maxHeight: .infinity) }
            else if let error, days.isEmpty && title.isEmpty {
                ContentUnavailableView("Treino indisponível", systemImage: "dumbbell", description: Text(error))
            } else { editor }
        }
        .fitScreen()
        .navigationTitle(planId == nil ? "Novo treino" : "Editar treino")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button(saving ? "Salvando…" : (active ? "Salvar e enviar" : "Salvar inativo")) { Task { await save() } }
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
        } message: {
            Text(active
                 ? "As alterações já estão disponíveis para o aluno."
                 : "O treino foi salvo como inativo e não aparecerá para o aluno.")
        }
        .alert("Erro", isPresented: Binding(get: { error != nil && !loading && !(days.isEmpty && title.isEmpty) }, set: { if !$0 { error = nil } })) {
            Button("OK", role: .cancel) {}
        } message: { Text(error ?? "") }
        .alert(
            "Igualar as séries?",
            isPresented: Binding(get: { pendingGrouping != nil }, set: { if !$0 { pendingGrouping = nil } }),
            presenting: pendingGrouping
        ) { pending in
            Button("Usar \(pending.sets) séries") {
                groupWithNext(dayId: pending.dayId, itemId: pending.itemId, confirmed: true)
            }
            Button("Cancelar", role: .cancel) {}
        } message: { pending in
            Text("Os exercícios de um \(pending.label.lowercased()) têm o mesmo número de séries. Usar as \(pending.sets) séries de \(pending.exerciseName) em todos?")
        }
    }

    private var editor: some View {
        List {
            Section("Destino e período") {
                if planId == nil {
                    Picker("Aluno", selection: $selectedStudentId) {
                        Text("Selecione o aluno").tag("")
                        ForEach(students) { student in
                            Text(student.user.name).tag(student.id)
                        }
                    }
                }
                DatePicker("Início", selection: $startDate, displayedComponents: .date)
                DatePicker("Término", selection: $endDate, displayedComponents: .date)
                Toggle("Ativo no app do aluno", isOn: $active).tint(FitTheme.orange)
                if planId == nil {
                    Toggle("Também salvar como modelo", isOn: $saveAsTemplate).tint(FitTheme.orange)
                }
            }
            .listRowBackground(FitTheme.surface)

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

                    let groups = day.groupInfo
                    let groupIssues = WorkoutGroups.findIssues(day.items)
                    ForEach($day.items) { $item in
                        let itemId = item.id
                        let index = day.items.firstIndex { $0.id == itemId } ?? 0
                        let group = groups.indices.contains(index) ? groups[index] : nil
                        ExerciseEditorRow(
                            item: $item,
                            group: group,
                            nextInGroup: Self.nextBadge(groups, after: index),
                            groupIssue: groupIssues.first { $0.index == index }?.message,
                            canGroupWithNext: day.canGroupWithNext(at: index),
                            onSetsChange: { sets in
                                if let current = day.items.firstIndex(where: { $0.id == itemId }) { day.setSets(sets, at: current) }
                            },
                            onGroupWithNext: { groupWithNext(dayId: day.id, itemId: itemId) },
                            onUngroup: {
                                if let current = day.items.firstIndex(where: { $0.id == itemId }) { day.ungroup(at: current) }
                            }
                        )
                        .listRowBackground(
                            FitTheme.surface.overlay(alignment: .leading) {
                                // Colchete ligando os exercícios de um bi-set/tri-set/circuito.
                                if group != nil { Rectangle().fill(FitTheme.orange.opacity(0.7)).frame(width: 3) }
                            }
                        )
                    }
                    // Excluir ou mover mantém as regras dos grupos (ver EditableWorkoutDay).
                    .onDelete { offsets in day.removeItems(atOffsets: offsets) }
                    .onMove { source, destination in day.moveItems(fromOffsets: source, toOffset: destination) }

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

    /// "Agrupar com o próximo". Com séries diferentes, pergunta antes se pode igualar às do exercício de origem.
    private func groupWithNext(dayId: UUID, itemId: UUID, confirmed: Bool = false) {
        guard let dayIndex = days.firstIndex(where: { $0.id == dayId }),
              let index = days[dayIndex].items.firstIndex(where: { $0.id == itemId }),
              days[dayIndex].canGroupWithNext(at: index) else { return }
        let day = days[dayIndex]
        if !confirmed && day.groupingNeedsEqualSets(at: index) {
            pendingGrouping = PendingGrouping(
                dayId: dayId,
                itemId: itemId,
                sets: day.items[index].sets,
                exerciseName: day.items[index].exerciseName,
                label: WorkoutGroups.groupLabel(size: day.groupingMembers(at: index).count)
            )
            return
        }
        days[dayIndex].groupWithNext(at: index)
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
            async let studentRequest: [StudentListItem] = api.get("/api/students")
            guard let planId else {
                students = try await studentRequest
                error = nil
                return
            }
            async let planRequest: WorkoutPlanDetail = api.getRaw("/api/workout-plans/\(planId)")
            let (plan, loadedStudents) = try await (planRequest, studentRequest)
            students = loadedStudents
            title = plan.title
            active = plan.active
            startDate = Self.parseDate(plan.startDate) ?? startDate
            endDate = Self.parseDate(plan.endDate) ?? endDate
            days = plan.workoutDays.map { day in
                var editable = EditableWorkoutDay(
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
                            load: WorkoutLoad.loadEditorText(item.load),
                            rpe: WorkoutLoad.rpeEditorText(item.rpe),
                            notes: item.notes ?? "",
                            groupId: item.groupId
                        )
                    }
                )
                editable.normalizeGroups()
                return editable
            }
            error = nil
        } catch { self.error = error.localizedDescription }
    }

    private func save() async {
        if let safetyIssue { error = safetyIssue; return }
        saving = true
        defer { saving = false }
        let workoutDays = days.map { day in
                let groups = day.groupInfo
                let groupIds = WorkoutGroups.normalizedIds(day.items)
                return WorkoutDayBody(
                    name: day.name.isEmpty ? "Dia de treino" : day.name,
                    dayOfWeek: day.dayOfWeek,
                    items: day.items.enumerated().map { index, item in
                        // Num grupo, o descanso é o do último exercício, depois da volta: os anteriores vão com 0.
                        let hidesRest = EditableWorkoutDay.hidesRest(groups[index])
                        return WorkoutItemBody(
                            exerciseId: item.exerciseId, sets: item.sets, reps: item.reps,
                            rest: hidesRest ? 0 : item.rest,
                            restBySet: item.customRest && !hidesRest ? encodeRests(item.restBySet) : nil,
                            notes: item.notes,
                            // Sempre enviados (o valor atual, editado ou não): salvar pelo app nunca apaga
                            // uma prescrição nem desfaz um grupo feitos na web.
                            load: item.loadPayload,
                            rpe: item.rpePayload,
                            groupId: groupIds[index],
                            order: index
                        )
                    }
                )
            }
        do {
            if let planId {
                let body = WorkoutPlanUpdateBody(
                    title: title.isEmpty ? "Plano de treino" : title,
                    startDate: ISO8601DateFormatter().string(from: startDate),
                    endDate: ISO8601DateFormatter().string(from: endDate),
                    active: active,
                    workoutDays: workoutDays
                )
                let _: WorkoutPlanDetail = try await api.put("/api/workout-plans/\(planId)", body: body)
            } else {
                let body = WorkoutPlanCreateBody(
                    title: title,
                    studentId: selectedStudentId,
                    startDate: ISO8601DateFormatter().string(from: startDate),
                    endDate: ISO8601DateFormatter().string(from: endDate),
                    active: active,
                    saveAsTemplate: saveAsTemplate,
                    workoutDays: workoutDays
                )
                let _: WorkoutPlanDetail = try await api.post("/api/workout-plans", body: body)
            }
            showSaved = true
        } catch { self.error = error.localizedDescription }
    }

    private static func parseDate(_ value: String) -> Date? {
        (try? Date(value, strategy: .iso8601.year().month().day().timeZone(separator: .omitted).time(includingFractionalSeconds: true)))
            ?? (try? Date(value, strategy: .iso8601))
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

/// "Agrupar com o próximo" à espera da confirmação para igualar as séries.
private struct PendingGrouping {
    let dayId: UUID
    let itemId: UUID
    /// Séries do exercício de origem, que passam a valer para o grupo todo.
    let sets: Int
    let exerciseName: String
    /// "Bi-set", "Tri-set" ou "Circuito" (o grupo que vai se formar).
    let label: String
}

private struct ExerciseEditorRow: View {
    @Binding var item: EditableWorkoutItem
    /// Bi-set, tri-set ou circuito do exercício (nil fora de grupo).
    let group: WorkoutGroups.Info?
    /// "A2" quando o próximo exercício é do mesmo grupo.
    let nextInGroup: String?
    /// Problema do grupo apontado neste exercício (mesma mensagem do servidor).
    let groupIssue: String?
    let canGroupWithNext: Bool
    /// Séries passam pelo dia: num grupo, mudam em todos os exercícios dele.
    let onSetsChange: (Int) -> Void
    let onGroupWithNext: () -> Void
    let onUngroup: () -> Void

    /// Antes do último exercício do grupo não há descanso: aparece "—" e vai 0 ao salvar.
    private var hidesRest: Bool { EditableWorkoutDay.hidesRest(group) }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            VStack(alignment: .leading, spacing: 3) {
                if let group, group.isFirst {
                    Label("\(group.title) · \(group.size) exercícios em sequência", systemImage: "link")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(FitTheme.orange)
                }
                HStack(spacing: 6) {
                    if let group {
                        Text(group.badge)
                            .font(.caption2.bold())
                            .foregroundStyle(FitTheme.orange)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(FitTheme.orange.opacity(0.14), in: Capsule())
                            .accessibilityLabel("\(group.title), exercício \(group.position) de \(group.size)")
                    }
                    Text(item.exerciseName).font(.subheadline.weight(.semibold))
                }
                Text(item.muscleGroup).font(.caption2).foregroundStyle(FitTheme.secondaryText)
            }
            HStack(spacing: 14) {
                Stepper(value: Binding(get: { item.sets }, set: { onSetsChange($0) }), in: 1...12) {
                    Text("\(item.sets) séries").font(.caption)
                }
                .fixedSize()
                .accessibilityHint(group == nil ? "" : "Muda as séries de todos os exercícios do \(group?.title ?? "grupo")")
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
                if hidesRest {
                    HStack(spacing: 4) {
                        Text("Descanso").foregroundStyle(FitTheme.secondaryText)
                        Text("—").fontWeight(.semibold)
                    }
                    .font(.caption)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("Sem descanso")
                } else {
                    Stepper(value: $item.rest, in: 0...600, step: 15) {
                        Text("\(item.rest)s descanso").font(.caption)
                    }
                    .fixedSize()
                    .disabled(item.customRest)
                }
            }
            HStack(spacing: 10) {
                HStack(spacing: 6) {
                    Text("Carga (kg)").font(.caption).foregroundStyle(FitTheme.secondaryText).fixedSize()
                    TextField("20 ou 20/25", text: $item.load)
                        .textFieldStyle(.roundedBorder)
                        .font(.caption)
                        .keyboardType(.numbersAndPunctuation)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                        .accessibilityLabel("Carga em quilos")
                        .accessibilityHint("Opcional. Um valor para todas as séries ou um por série, separados por barra")
                }
                HStack(spacing: 6) {
                    Text("RPE").font(.caption).foregroundStyle(FitTheme.secondaryText).fixedSize()
                    TextField("8", text: $item.rpe)
                        .frame(width: 52)
                        .textFieldStyle(.roundedBorder)
                        .font(.caption)
                        .keyboardType(.numbersAndPunctuation)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                        .accessibilityLabel("RPE")
                        .accessibilityHint("Opcional. Esforço percebido de 1 a 10, ex.: 8, 8,5 ou 7-8")
                }
            }
            if let loadError = item.normalizedLoad.error {
                validationMessage(loadError)
            } else if case .valid(let load?) = item.normalizedLoad, load.contains("/") {
                // Com menos valores que séries o último se repete: mostra como fica cada série.
                Text("Por série: \(WorkoutLoad.formatLoad(load))")
                    .font(.caption2)
                    .foregroundStyle(FitTheme.secondaryText)
            }
            if let rpeError = item.normalizedRpe.error {
                validationMessage(rpeError)
            }
            if hidesRest {
                Text("Sem descanso: segue direto para o \(nextInGroup ?? "próximo exercício"). O descanso vem depois do último da volta.")
                    .font(.caption2)
                    .foregroundStyle(FitTheme.secondaryText)
            } else {
                if let group {
                    Label("Descanso após a volta do \(group.title)", systemImage: "timer")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(FitTheme.secondaryText)
                }
                Picker("Descanso", selection: $item.customRest) {
                    Text("Mesmo em todas").tag(false)
                    Text(group == nil ? "Por série" : "Por volta").tag(true)
                }
                .pickerStyle(.segmented)

                if item.customRest {
                    VStack(spacing: 8) {
                        ForEach(0..<item.sets, id: \.self) { index in
                            Stepper(value: restBinding(index), in: 0...600, step: 15) {
                                HStack {
                                    Text(restLabel(index))
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
            if let groupIssue {
                validationMessage(groupIssue)
            }
            if canGroupWithNext || group != nil {
                ViewThatFits(in: .horizontal) {
                    HStack(spacing: 16) { groupActions }
                    VStack(alignment: .leading, spacing: 8) { groupActions }
                }
                .font(.caption.weight(.semibold))
                .foregroundStyle(FitTheme.orange)
                .buttonStyle(.borderless)
            }
        }
        .padding(.vertical, 4)
    }

    @ViewBuilder
    private var groupActions: some View {
        if canGroupWithNext {
            Button(action: onGroupWithNext) {
                Label("Agrupar com o próximo", systemImage: "link")
            }
            .accessibilityHint("Faz este exercício e o próximo em sequência, como bi-set, tri-set ou circuito")
        }
        if group != nil {
            Button(action: onUngroup) {
                Label("Desagrupar", systemImage: "scissors")
            }
            .accessibilityHint("Tira este exercício do grupo")
        }
    }

    private func restLabel(_ index: Int) -> String {
        if group != nil { return "Após a volta \(index + 1)" }
        return index == 0 ? "Após aquecimento/série 1" : "Após série \(index + 1)"
    }

    private func validationMessage(_ message: String) -> some View {
        Label(message, systemImage: "exclamationmark.triangle.fill")
            .font(.caption2)
            .foregroundStyle(.red)
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
