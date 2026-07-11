import SwiftUI

@main
struct AdrianFitApp: App {
    @State private var session = SessionStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .environment(\.apiClient, .live)
                .preferredColorScheme(.dark)
        }
    }
}

struct RootView: View {
    @Environment(SessionStore.self) private var session

    var body: some View {
        Group {
            switch session.state {
            case .checking:
                LaunchView()
            case .signedOut:
                LoginView()
            case .signedIn(let user):
                AppShell(user: user)
            }
        }
        .animation(.smooth(duration: 0.35), value: session.isSignedIn)
        .task { await session.restore() }
    }
}

private struct LaunchView: View {
    var body: some View {
        ZStack {
            FitTheme.background.ignoresSafeArea()
            VStack(spacing: 18) {
                BrandMark(size: 72)
                Text("ADRIAN FIT")
                    .font(.system(size: 22, weight: .black, design: .rounded))
                    .tracking(2)
                ProgressView().tint(FitTheme.orange)
            }
        }
    }
}
