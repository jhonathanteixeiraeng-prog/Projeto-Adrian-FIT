import SwiftUI

struct ExerciseFull: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let muscleGroup: String
    let equipment: String?
    let difficulty: String?
    let videoUrl: String?
    let instructions: String?
    let tips: String?
}

private let difficulties: [(value: String, label: String)] = [
    ("INICIANTE", "Iniciante"),
    ("INTERMEDIARIO", "Intermediário"),
    ("AVANCADO", "Avançado"),
]

struct ExercisesLibraryView: View {
    @Environment(\.apiClient) private var api
    @State private var exercises: [ExerciseFull] = []
    @State private var query = ""
    @State private var loading = true
    @State private var error: String?
    @State private var editing: ExerciseFull?
    @State private var showNew = false
    @State private var pendingDelete: String?

    private var filtered: [ExerciseFull] {
        query.isEmpty ? exercises : exercises.filter {
            $0.name.localizedCaseInsensitiveContains(query) || $0.muscleGroup.localizedCaseInsensitiveContains(query)
        }
    }

    var body: some View {
        Group {
            if loading && exercises.isEmpty { ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity) }
            else if exercises.isEmpty {
                ContentUnavailableView("Nenhum exercício", systemImage: "dumbbell", description: Text(error ?? "Crie exercícios para montar os treinos."))
            } else {
                List(filtered) { exercise in
                    Button { editing = exercise } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(exercise.name).font(.subheadline.weight(.semibold)).foregroundStyle(FitTheme.primaryText)
                            HStack(spacing: 8) {
                                Text(exercise.muscleGroup)
                                if let difficulty = exercise.difficulty {
                                    Text("· \(difficulties.first { $0.value == difficulty }?.label ?? difficulty)")
                                }
                                if let equipment = exercise.equipment, !equipment.isEmpty { Text("· \(equipment)") }
                            }
                            .font(.caption2).foregroundStyle(FitTheme.secondaryText)
                        }
                        .padding(.vertical, 3)
                    }
                    .listRowBackground(FitTheme.surface)
                    .swipeActions {
                        Button(role: .destructive) { pendingDelete = exercise.id } label: { Label("Excluir", systemImage: "trash") }
                    }
                }
                .scrollContentBackground(.hidden)
            }
        }
        .fitScreen()
        .navigationTitle("Exercícios")
        .searchable(text: $query, prompt: "Nome ou grupo muscular")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showNew = true } label: { Label("Novo", systemImage: "plus").fontWeight(.semibold) }
            }
        }
        .sheet(isPresented: $showNew) {
            ExerciseFormView(exercise: nil) { Task { await load() } }
        }
        .sheet(item: $editing) { exercise in
            ExerciseFormView(exercise: exercise) { Task { await load() } }
        }
        .confirmationDialog("Excluir exercício?", isPresented: Binding(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } }), titleVisibility: .visible) {
            Button("Excluir", role: .destructive) { Task { await deleteExercise() } }
            Button("Cancelar", role: .cancel) { pendingDelete = nil }
        } message: { Text("Treinos que já usam este exercício não são alterados.") }
        .task { await load() }
        .refreshable { await load() }
    }

    private func load() async {
        loading = exercises.isEmpty
        defer { loading = false }
        do { exercises = try await api.get("/api/exercises"); error = nil }
        catch { self.error = error.localizedDescription }
    }

    private func deleteExercise() async {
        guard let id = pendingDelete else { return }
        pendingDelete = nil
        do { try await api.delete("/api/exercises/\(id)"); await load() }
        catch { self.error = error.localizedDescription }
    }
}

struct ExerciseFormView: View {
    @Environment(\.apiClient) private var api
    @Environment(\.dismiss) private var dismiss

    let exercise: ExerciseFull?
    var onSaved: () -> Void = {}

    @State private var name = ""
    @State private var muscleGroup = ""
    @State private var equipment = ""
    @State private var difficulty = "INICIANTE"
    @State private var videoUrl = ""
    @State private var instructions = ""
    @State private var tips = ""
    @State private var sending = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Exercício") {
                    TextField("Nome (ex.: Supino reto com barra)", text: $name)
                    TextField("Grupo muscular (ex.: Peito)", text: $muscleGroup)
                    TextField("Equipamento (opcional)", text: $equipment)
                    Picker("Dificuldade", selection: $difficulty) {
                        ForEach(difficulties, id: \.value) { item in
                            Text(item.label).tag(item.value)
                        }
                    }
                }
                .listRowBackground(FitTheme.surface)

                Section("Conteúdo de apoio") {
                    TextField("Link do vídeo (opcional)", text: $videoUrl)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    TextField("Instruções de execução", text: $instructions, axis: .vertical)
                        .lineLimit(2...5)
                    TextField("Dicas", text: $tips, axis: .vertical)
                        .lineLimit(1...4)
                }
                .listRowBackground(FitTheme.surface)

                if let error {
                    Section { Text(error).foregroundStyle(.red).font(.caption) }
                        .listRowBackground(FitTheme.surface)
                }
            }
            .scrollContentBackground(.hidden)
            .fitScreen()
            .navigationTitle(exercise == nil ? "Novo exercício" : "Editar exercício")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(sending ? "Salvando…" : "Salvar") { Task { await submit() } }
                        .disabled(sending || name.isEmpty || muscleGroup.isEmpty)
                        .fontWeight(.semibold)
                }
            }
            .onAppear {
                guard let exercise else { return }
                name = exercise.name
                muscleGroup = exercise.muscleGroup
                equipment = exercise.equipment ?? ""
                difficulty = exercise.difficulty ?? "INICIANTE"
                videoUrl = exercise.videoUrl ?? ""
                instructions = exercise.instructions ?? ""
                tips = exercise.tips ?? ""
            }
        }
    }

    private func submit() async {
        sending = true
        defer { sending = false }
        struct Body: Encodable {
            let name: String
            let muscleGroup: String
            let equipment: String
            let difficulty: String
            let videoUrl: String?
            let instructions: String
            let tips: String
        }
        let body = Body(
            name: name,
            muscleGroup: muscleGroup,
            equipment: equipment,
            difficulty: difficulty,
            videoUrl: videoUrl.isEmpty ? nil : videoUrl,
            instructions: instructions,
            tips: tips
        )
        do {
            // POST/PUT de exercícios devolvem o objeto direto, sem envelope.
            struct Saved: Codable { let id: String }
            if let exercise {
                let _: Saved = try await api.putRaw("/api/exercises/\(exercise.id)", body: body)
            } else {
                let _: Saved = try await api.postRaw("/api/exercises", body: body)
            }
            onSaved()
            dismiss()
        } catch { self.error = error.localizedDescription }
    }
}
