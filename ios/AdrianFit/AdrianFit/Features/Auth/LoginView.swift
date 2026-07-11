import SwiftUI

struct LoginView: View {
    @Environment(SessionStore.self) private var session
    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @FocusState private var focusedField: Field?

    private enum Field { case email, password }

    var body: some View {
        ZStack {
            FitTheme.background.ignoresSafeArea()
            Circle()
                .fill(FitTheme.orange.opacity(0.13))
                .frame(width: 340)
                .blur(radius: 80)
                .offset(x: 170, y: -340)

            ScrollView {
                VStack(alignment: .leading, spacing: 30) {
                    Spacer(minLength: 58)
                    HStack(spacing: 14) {
                        BrandMark(size: 56)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("ADRIAN FIT").font(.title2.weight(.black)).tracking(1.3)
                            Text("Treino e evolução, todos os dias").font(.caption).foregroundStyle(FitTheme.secondaryText)
                        }
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Bem-vindo de volta")
                            .font(.system(size: 34, weight: .bold, design: .rounded))
                        Text("Entre para acessar seu acompanhamento personalizado.")
                            .foregroundStyle(FitTheme.secondaryText)
                    }

                    VStack(spacing: 14) {
                        LoginField(title: "E-mail", icon: "envelope", text: $email, secure: false)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .focused($focusedField, equals: .email)
                            .submitLabel(.next)
                            .onSubmit { focusedField = .password }
                        LoginField(title: "Senha", icon: "lock", text: $password, secure: true)
                            .textContentType(.password)
                            .focused($focusedField, equals: .password)
                            .submitLabel(.go)
                            .onSubmit { Task { await signIn() } }
                    }

                    if let errorMessage {
                        Label(errorMessage, systemImage: "exclamationmark.circle.fill")
                            .font(.footnote.weight(.medium))
                            .foregroundStyle(.red)
                            .transition(.opacity)
                    }

                    Button { Task { await signIn() } } label: {
                        HStack {
                            if isLoading { ProgressView().tint(.white) }
                            else { Text("Entrar"); Image(systemName: "arrow.right") }
                        }
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .frame(height: 56)
                        .background(FitTheme.orange, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .disabled(isLoading || email.isEmpty || password.isEmpty)
                    .opacity(email.isEmpty || password.isEmpty ? 0.55 : 1)

                    Text("Ao entrar, seus dados permanecem protegidos e sincronizados com seu personal.")
                        .font(.caption)
                        .foregroundStyle(FitTheme.secondaryText)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                }
                .padding(.horizontal, 24)
            }
        }
    }

    private func signIn() async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do { try await session.signIn(email: email.trimmingCharacters(in: .whitespaces), password: password) }
        catch { errorMessage = error.localizedDescription }
    }
}

private struct LoginField: View {
    let title: String
    let icon: String
    @Binding var text: String
    let secure: Bool

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon).foregroundStyle(FitTheme.orange).frame(width: 22)
            Group {
                if secure { SecureField(title, text: $text) }
                else { TextField(title, text: $text).textInputAutocapitalization(.never).autocorrectionDisabled() }
            }
        }
        .padding(.horizontal, 16)
        .frame(height: 58)
        .background(FitTheme.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay { RoundedRectangle(cornerRadius: 18).stroke(Color.white.opacity(0.08)) }
    }
}
