import SwiftUI

struct AppShell: View {
    let user: AppUser

    var body: some View {
        if user.role == .student { StudentShell(user: user) }
        else { PersonalShell(user: user) }
    }
}

private struct StudentShell: View {
    let user: AppUser

    var body: some View {
        TabView {
            NavigationStack { StudentHomeView(user: user) }
                .tabItem { Label("Hoje", systemImage: "sparkles") }
            NavigationStack { WorkoutPlanView() }
                .tabItem { Label("Treino", systemImage: "dumbbell.fill") }
            NavigationStack { DietPlanView() }
                .tabItem { Label("Dieta", systemImage: "fork.knife") }
            NavigationStack { StudentProgressView() }
                .tabItem { Label("Progresso", systemImage: "chart.line.uptrend.xyaxis") }
            NavigationStack { ProfileView(user: user) }
                .tabItem { Label("Perfil", systemImage: "person.crop.circle") }
        }
        .tint(FitTheme.orange)
    }
}

private struct PersonalShell: View {
    let user: AppUser

    var body: some View {
        TabView {
            NavigationStack { PersonalDashboardView(user: user) }
                .tabItem { Label("Visão geral", systemImage: "square.grid.2x2.fill") }
            NavigationStack { StudentsView() }
                .tabItem { Label("Alunos", systemImage: "person.2.fill") }
            NavigationStack { PlansHubView() }
                .tabItem { Label("Planos", systemImage: "list.clipboard.fill") }
            NavigationStack { PersonalInboxView() }
                .tabItem { Label("Chat", systemImage: "bubble.left.and.bubble.right.fill") }
            NavigationStack { ProfileView(user: user) }
                .tabItem { Label("Perfil", systemImage: "person.crop.circle") }
        }
        .tint(FitTheme.orange)
    }
}

