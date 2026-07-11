import SwiftUI

struct ProfileView: View {
    let user: AppUser
    @Environment(SessionStore.self) private var session
    @State private var showSignOut = false

    var body: some View {
        ScrollView {
            VStack(spacing: 22) {
                Circle()
                    .fill(LinearGradient(colors: [FitTheme.orangeSoft, FitTheme.orange], startPoint: .topLeading, endPoint: .bottomTrailing))
                    .frame(width: 96, height: 96)
                    .overlay { Text(initials).font(.title.bold()).foregroundStyle(.white) }
                VStack(spacing: 5) {
                    Text(user.name).font(.title2.bold())
                    Text(user.email).foregroundStyle(FitTheme.secondaryText)
                    Text(user.role == .student ? "ALUNO" : "PERSONAL TRAINER")
                        .font(.caption2.bold()).tracking(1).foregroundStyle(FitTheme.orange)
                }
                SurfaceCard {
                    VStack(spacing: 0) {
                        ProfileRow(icon: "person.text.rectangle", title: "Dados pessoais")
                        Divider().overlay(Color.white.opacity(0.08))
                        ProfileRow(icon: "bell", title: "Notificações")
                        Divider().overlay(Color.white.opacity(0.08))
                        ProfileRow(icon: "lock.shield", title: "Privacidade e segurança")
                        Divider().overlay(Color.white.opacity(0.08))
                        ProfileRow(icon: "questionmark.circle", title: "Ajuda")
                    }
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
    }

    private var initials: String { user.name.split(separator: " ").prefix(2).compactMap(\.first).map(String.init).joined() }
}

private struct ProfileRow: View {
    let icon: String; let title: String
    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: icon).frame(width: 24).foregroundStyle(FitTheme.orange)
            Text(title); Spacer(); Image(systemName: "chevron.right").font(.caption).foregroundStyle(FitTheme.secondaryText)
        }.padding(.vertical, 15)
    }
}

