import SwiftUI

struct ProfileView: View {
    let user: AppUser
    @Environment(SessionStore.self) private var session
    @Environment(\.apiClient) private var api
    @State private var showSignOut = false
    @State private var showEditProfile = false
    @State private var showPassword = false
    @State private var displayName: String

    init(user: AppUser) {
        self.user = user
        _displayName = State(initialValue: user.name)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 22) {
                Circle()
                    .fill(LinearGradient(colors: [FitTheme.orangeSoft, FitTheme.orange], startPoint: .topLeading, endPoint: .bottomTrailing))
                    .frame(width: 96, height: 96)
                    .overlay { Text(initials).font(.title.bold()).foregroundStyle(.white) }
                VStack(spacing: 5) {
                    Text(displayName).font(.title2.bold())
                    Text(user.email).foregroundStyle(FitTheme.secondaryText)
                    Text(user.role == .student ? "ALUNO" : "PERSONAL TRAINER")
                        .font(.caption2.bold()).tracking(1).foregroundStyle(FitTheme.orange)
                }
                SurfaceCard {
                    VStack(spacing: 0) {
                        Button { showEditProfile = true } label: {
                            ProfileRow(icon: "person.text.rectangle", title: "Dados pessoais")
                        }
                        Divider().overlay(Color.white.opacity(0.08))
                        NavigationLink { NotificationsView(role: user.role) } label: {
                            ProfileRow(icon: "bell", title: "Notificações")
                        }
                        Divider().overlay(Color.white.opacity(0.08))
                        Button { showPassword = true } label: {
                            ProfileRow(icon: "lock.shield", title: "Alterar senha")
                        }
                    }
                    .buttonStyle(.plain)
                }
                Button(role: .destructive) { showSignOut = true } label: {
                    Label("Sair da conta", systemImage: "rectangle.portrait.and.arrow.right").frame(maxWidth: .infinity).frame(height: 52)
                }
                .buttonStyle(.bordered).tint(.red)
            }.padding(20)
        }
        .fitScreen().navigationTitle("Perfil").navigationBarTitleDisplayMode(.inline)
        .confirmationDialog("Deseja sair da sua conta?", isPresented: $showSignOut) {
            Button("Sair", role: .destructive) { Task { await session.signOut() } }
        }
        .sheet(isPresented: $showEditProfile) {
            EditProfileFormView(currentName: displayName) { newName in
                displayName = newName
            }
        }
        .sheet(isPresented: $showPassword) {
            ChangePasswordFormView()
        }
    }

    private var initials: String { displayName.split(separator: " ").prefix(2).compactMap(\.first).map(String.init).joined() }
}

private struct ProfileRow: View {
    let icon: String; let title: String
    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: icon).frame(width: 24).foregroundStyle(FitTheme.orange)
            Text(title).foregroundStyle(.white)
            Spacer(); Image(systemName: "chevron.right").font(.caption).foregroundStyle(FitTheme.secondaryText)
        }.padding(.vertical, 15)
    }
}

// MARK: - Editar dados pessoais

private struct EditProfileFormView: View {
    @Environment(\.apiClient) private var api
    @Environment(\.dismiss) private var dismiss

    let currentName: String
    var onSaved: (String) -> Void = { _ in }

    @State private var name = ""
    @State private var phone = ""
    @State private var sending = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Dados pessoais") {
                    TextField("Nome completo", text: $name)
                    TextField("Telefone", text: $phone).keyboardType(.phonePad)
                }
                .listRowBackground(FitTheme.surface)

                if let error {
                    Section { Text(error).foregroundStyle(.red).font(.caption) }
                        .listRowBackground(FitTheme.surface)
                }
            }
            .scrollContentBackground(.hidden)
            .fitScreen()
            .navigationTitle("Dados pessoais")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(sending ? "Salvando…" : "Salvar") { Task { await submit() } }
                        .disabled(sending || name.isEmpty)
                        .fontWeight(.semibold)
                }
            }
            .onAppear { name = currentName }
        }
    }

    private func submit() async {
        sending = true
        defer { sending = false }
        struct Body: Encodable { let name: String; let phone: String? }
        do {
            try await api.putAck("/api/profile", body: Body(name: name, phone: phone.isEmpty ? nil : phone))
            onSaved(name)
            dismiss()
        } catch { self.error = error.localizedDescription }
    }
}

// MARK: - Alterar senha

private struct ChangePasswordFormView: View {
    @Environment(\.apiClient) private var api
    @Environment(\.dismiss) private var dismiss

    @State private var currentPassword = ""
    @State private var newPassword = ""
    @State private var confirmPassword = ""
    @State private var sending = false
    @State private var error: String?

    private var valid: Bool {
        !currentPassword.isEmpty && newPassword.count >= 6 && newPassword == confirmPassword
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Senha atual") {
                    SecureField("Senha atual", text: $currentPassword)
                }
                .listRowBackground(FitTheme.surface)

                Section {
                    SecureField("Nova senha (mín. 6 caracteres)", text: $newPassword)
                    SecureField("Confirmar nova senha", text: $confirmPassword)
                } header: {
                    Text("Nova senha")
                } footer: {
                    if !confirmPassword.isEmpty && newPassword != confirmPassword {
                        Text("As senhas não conferem.").foregroundStyle(.red)
                    }
                }
                .listRowBackground(FitTheme.surface)

                if let error {
                    Section { Text(error).foregroundStyle(.red).font(.caption) }
                        .listRowBackground(FitTheme.surface)
                }
            }
            .scrollContentBackground(.hidden)
            .fitScreen()
            .navigationTitle("Alterar senha")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(sending ? "Salvando…" : "Salvar") { Task { await submit() } }
                        .disabled(sending || !valid)
                        .fontWeight(.semibold)
                }
            }
        }
    }

    private func submit() async {
        sending = true
        defer { sending = false }
        struct Body: Encodable { let currentPassword: String; let newPassword: String }
        do {
            try await api.putAck("/api/profile/password", body: Body(currentPassword: currentPassword, newPassword: newPassword))
            dismiss()
        } catch { self.error = error.localizedDescription }
    }
}
