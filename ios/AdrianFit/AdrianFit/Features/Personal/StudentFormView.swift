import SwiftUI

// MARK: - Modelos

struct StudentFull: Codable, Sendable {
    let id: String
    let birthDate: String?
    let gender: String?
    let height: Double?
    let weight: Double?
    let goal: String?
    let status: String?
    let user: StudentUser
    let anamnesis: AnamnesisData?
}

struct AnamnesisData: Codable, Sendable {
    let restrictions: String?
    let injuries: String?
    let medications: String?
    let activityLevel: String?
    let notes: String?
}

private let activityLevels: [(value: String, label: String)] = [
    ("SEDENTARY", "Sedentário"),
    ("LIGHT", "Leve"),
    ("MODERATE", "Moderado"),
    ("ACTIVE", "Ativo"),
    ("VERY_ACTIVE", "Muito ativo"),
]

// MARK: - Cadastro de aluno novo

struct NewStudentFormView: View {
    @Environment(\.apiClient) private var api
    @Environment(\.dismiss) private var dismiss

    var onCreated: () -> Void = {}

    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var phone = ""
    @State private var birthDate = Calendar.current.date(byAdding: .year, value: -25, to: .now) ?? .now
    @State private var hasBirthDate = false
    @State private var gender = "MALE"
    @State private var height = ""
    @State private var weight = ""
    @State private var goal = ""
    @State private var sending = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Acesso do aluno") {
                    TextField("Nome completo", text: $name)
                        .textContentType(.name)
                    TextField("E-mail", text: $email)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    SecureField("Senha (mín. 6 caracteres)", text: $password)
                    TextField("Telefone (opcional)", text: $phone)
                        .keyboardType(.phonePad)
                }
                .listRowBackground(FitTheme.surface)

                Section("Dados físicos") {
                    Toggle("Informar data de nascimento", isOn: $hasBirthDate.animation())
                    if hasBirthDate {
                        DatePicker("Nascimento", selection: $birthDate, in: ...Date.now, displayedComponents: .date)
                    }
                    Picker("Sexo", selection: $gender) {
                        Text("Masculino").tag("MALE")
                        Text("Feminino").tag("FEMALE")
                    }
                    MeasureField(title: "Altura", value: $height, unit: "cm", placeholder: "175")
                    MeasureField(title: "Peso", value: $weight, unit: "kg", placeholder: "80")
                }
                .listRowBackground(FitTheme.surface)

                Section("Objetivo") {
                    TextField("Ex.: Hipertrofia, emagrecimento…", text: $goal, axis: .vertical)
                        .lineLimit(2...4)
                }
                .listRowBackground(FitTheme.surface)

                if let error {
                    Section { Text(error).foregroundStyle(.red).font(.caption) }
                        .listRowBackground(FitTheme.surface)
                }
            }
            .scrollContentBackground(.hidden)
            .fitScreen()
            .navigationTitle("Novo aluno")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(sending ? "Salvando…" : "Cadastrar") { Task { await submit() } }
                        .disabled(sending || name.isEmpty || email.isEmpty || password.count < 6)
                        .fontWeight(.semibold)
                }
            }
        }
    }

    private func submit() async {
        sending = true
        defer { sending = false }
        struct Body: Encodable {
            let name: String
            let email: String
            let password: String
            let phone: String?
            let birthDate: String?
            let gender: String
            let height: Double?
            let weight: Double?
            let goal: String?
        }
        let body = Body(
            name: name,
            email: email.trimmingCharacters(in: .whitespaces).lowercased(),
            password: password,
            phone: phone.isEmpty ? nil : phone,
            birthDate: hasBirthDate ? ISO8601DateFormatter().string(from: birthDate) : nil,
            gender: gender,
            height: Double(height.replacingOccurrences(of: ",", with: ".")),
            weight: Double(weight.replacingOccurrences(of: ",", with: ".")),
            goal: goal.isEmpty ? nil : goal
        )
        do {
            struct Created: Codable { let id: String }
            let _: Created = try await api.post("/api/students", body: body)
            onCreated()
            dismiss()
        } catch { self.error = error.localizedDescription }
    }
}

// MARK: - Edição de aluno + anamnese

struct EditStudentFormView: View {
    @Environment(\.apiClient) private var api
    @Environment(\.dismiss) private var dismiss

    let studentId: String
    var onSaved: () -> Void = {}

    @State private var loading = true
    @State private var sending = false
    @State private var error: String?

    @State private var name = ""
    @State private var phone = ""
    @State private var birthDate = Date.now
    @State private var hasBirthDate = false
    @State private var gender = "MALE"
    @State private var height = ""
    @State private var weight = ""
    @State private var goal = ""
    @State private var status = "ACTIVE"

    @State private var restrictions = ""
    @State private var injuries = ""
    @State private var medications = ""
    @State private var activityLevel = "MODERATE"
    @State private var anamnesisNotes = ""

    @State private var showResetPassword = false
    @State private var newPassword = ""
    @State private var resetFeedback: String?

    var body: some View {
        NavigationStack {
            Group {
                if loading { ProgressView("Carregando aluno…").frame(maxWidth: .infinity, maxHeight: .infinity) }
                else { form }
            }
            .fitScreen()
            .navigationTitle("Editar aluno")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(sending ? "Salvando…" : "Salvar") { Task { await submit() } }
                        .disabled(sending || loading || name.isEmpty)
                        .fontWeight(.semibold)
                }
            }
            .task { await load() }
            .alert("Redefinir senha", isPresented: $showResetPassword) {
                SecureField("Nova senha (mín. 6 caracteres)", text: $newPassword)
                Button("Redefinir") { Task { await resetPassword() } }
                Button("Cancelar", role: .cancel) { newPassword = "" }
            } message: { Text("O aluno passará a entrar com a nova senha.") }
            .alert("Senha", isPresented: Binding(get: { resetFeedback != nil }, set: { if !$0 { resetFeedback = nil } })) {
                Button("OK", role: .cancel) {}
            } message: { Text(resetFeedback ?? "") }
        }
    }

    private var form: some View {
        Form {
            Section("Dados do aluno") {
                TextField("Nome completo", text: $name)
                TextField("Telefone", text: $phone).keyboardType(.phonePad)
                Toggle("Informar data de nascimento", isOn: $hasBirthDate.animation())
                if hasBirthDate {
                    DatePicker("Nascimento", selection: $birthDate, in: ...Date.now, displayedComponents: .date)
                }
                Picker("Sexo", selection: $gender) {
                    Text("Masculino").tag("MALE")
                    Text("Feminino").tag("FEMALE")
                }
                MeasureField(title: "Altura", value: $height, unit: "cm", placeholder: "175")
                MeasureField(title: "Peso", value: $weight, unit: "kg", placeholder: "80")
                Picker("Status", selection: $status) {
                    Text("Ativo").tag("ACTIVE")
                    Text("Pausado").tag("PAUSED")
                    Text("Inativo").tag("INACTIVE")
                }
            }
            .listRowBackground(FitTheme.surface)

            Section("Objetivo") {
                TextField("Ex.: Hipertrofia, emagrecimento…", text: $goal, axis: .vertical)
                    .lineLimit(2...4)
            }
            .listRowBackground(FitTheme.surface)

            Section {
                Picker("Nível de atividade", selection: $activityLevel) {
                    ForEach(activityLevels, id: \.value) { level in
                        Text(level.label).tag(level.value)
                    }
                }
                TextField("Restrições alimentares (ex.: intolerância a lactose, não come peixe…)", text: $restrictions, axis: .vertical)
                    .lineLimit(2...4)
                TextField("Lesões", text: $injuries, axis: .vertical)
                    .lineLimit(1...3)
                TextField("Medicamentos", text: $medications, axis: .vertical)
                    .lineLimit(1...3)
                TextField("Outras observações", text: $anamnesisNotes, axis: .vertical)
                    .lineLimit(1...3)
            } header: {
                Text("Anamnese")
            } footer: {
                Text("As restrições alimentares são usadas pela geração automática de dieta.")
            }
            .listRowBackground(FitTheme.surface)

            Section {
                Button {
                    showResetPassword = true
                } label: {
                    Label("Redefinir senha do aluno", systemImage: "key.fill")
                        .font(.subheadline.weight(.semibold))
                }
                .foregroundStyle(FitTheme.orange)
            }
            .listRowBackground(FitTheme.surface)

            if let error {
                Section { Text(error).foregroundStyle(.red).font(.caption) }
                    .listRowBackground(FitTheme.surface)
            }
        }
        .scrollContentBackground(.hidden)
    }

    private func load() async {
        loading = true
        defer { loading = false }
        do {
            let student: StudentFull = try await api.get("/api/students/\(studentId)")
            name = student.user.name
            phone = student.user.phone ?? ""
            if let iso = student.birthDate,
               let parsed = (try? Date(iso, strategy: .iso8601.year().month().day().timeZone(separator: .omitted).time(includingFractionalSeconds: true)))
                ?? (try? Date(iso, strategy: .iso8601)) {
                birthDate = parsed
                hasBirthDate = true
            }
            gender = student.gender == "FEMALE" ? "FEMALE" : "MALE"
            height = student.height.map { String(format: "%.0f", $0) } ?? ""
            weight = student.weight.map { $0 == $0.rounded() ? String(format: "%.0f", $0) : String(format: "%.1f", $0) } ?? ""
            goal = student.goal ?? ""
            status = student.status ?? "ACTIVE"
            restrictions = student.anamnesis?.restrictions ?? ""
            injuries = student.anamnesis?.injuries ?? ""
            medications = student.anamnesis?.medications ?? ""
            activityLevel = student.anamnesis?.activityLevel ?? "MODERATE"
            anamnesisNotes = student.anamnesis?.notes ?? ""
            error = nil
        } catch { self.error = error.localizedDescription }
    }

    private func submit() async {
        sending = true
        defer { sending = false }
        struct AnamnesisBody: Encodable {
            let restrictions: String
            let injuries: String
            let medications: String
            let activityLevel: String
            let notes: String
        }
        struct Body: Encodable {
            let name: String
            let phone: String?
            let birthDate: String?
            let gender: String
            let height: Double?
            let weight: Double?
            let goal: String?
            let status: String
            let anamnesis: AnamnesisBody
        }
        let body = Body(
            name: name,
            phone: phone.isEmpty ? nil : phone,
            birthDate: hasBirthDate ? ISO8601DateFormatter().string(from: birthDate) : nil,
            gender: gender,
            height: Double(height.replacingOccurrences(of: ",", with: ".")),
            weight: Double(weight.replacingOccurrences(of: ",", with: ".")),
            goal: goal.isEmpty ? nil : goal,
            status: status,
            anamnesis: AnamnesisBody(
                restrictions: restrictions,
                injuries: injuries,
                medications: medications,
                activityLevel: activityLevel,
                notes: anamnesisNotes
            )
        )
        do {
            struct Updated: Codable { let id: String }
            let _: Updated = try await api.put("/api/students/\(studentId)", body: body)
            onSaved()
            dismiss()
        } catch { self.error = error.localizedDescription }
    }

    private func resetPassword() async {
        guard newPassword.count >= 6 else {
            resetFeedback = "A senha precisa ter pelo menos 6 caracteres."
            newPassword = ""
            return
        }
        struct Body: Encodable { let newPassword: String }
        do {
            try await api.putAck("/api/students/\(studentId)/reset-password", body: Body(newPassword: newPassword))
            resetFeedback = "Senha redefinida com sucesso."
        } catch {
            resetFeedback = error.localizedDescription
        }
        newPassword = ""
    }
}

// MARK: - Componentes

private struct MeasureField: View {
    let title: String
    @Binding var value: String
    let unit: String
    let placeholder: String

    var body: some View {
        HStack {
            Text(title)
            Spacer()
            TextField(placeholder, text: $value)
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .frame(width: 90)
            Text(unit).foregroundStyle(FitTheme.secondaryText)
        }
    }
}
