import Foundation
import Observation

@MainActor
@Observable
final class SessionStore {
    enum State: Equatable {
        case checking
        case signedOut
        case signedIn(AppUser)
    }

    var state: State = .checking
    var isSignedIn: Bool { if case .signedIn = state { true } else { false } }

    func restore() async {
        do {
            if let user = try await APIClient.live.currentSession().user { state = .signedIn(user) }
            else { state = .signedOut }
        } catch { state = .signedOut }
    }

    func signIn(email: String, password: String) async throws {
        state = .signedIn(try await APIClient.live.signIn(email: email, password: password))
    }

    func signOut() async {
        await APIClient.live.signOut()
        state = .signedOut
    }
}

