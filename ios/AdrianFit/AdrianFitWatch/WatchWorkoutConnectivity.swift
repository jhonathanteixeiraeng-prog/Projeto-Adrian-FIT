import Foundation
@preconcurrency import WatchConnectivity

final class WatchWorkoutConnectivity: NSObject, WCSessionDelegate, @unchecked Sendable {
    private var stateHandler: (@Sendable (WatchWorkoutState) -> Void)?

    func activate(stateHandler: @escaping @Sendable (WatchWorkoutState) -> Void) {
        self.stateHandler = stateHandler
        guard WCSession.isSupported() else { return }

        let session = WCSession.default
        session.delegate = self
        session.activate()
        receive(session.receivedApplicationContext)
    }

    func requestState() {
        send(.requestState)
    }

    func send(_ command: WatchWorkoutCommand) {
        guard WCSession.isSupported(),
              let data = try? JSONEncoder().encode(command) else { return }

        let session = WCSession.default
        let payload = [WatchWorkoutPayloadKey.command: data]
        if session.activationState == .activated, session.isReachable {
            session.sendMessage(payload, replyHandler: nil) { _ in
                session.transferUserInfo(payload)
            }
        } else {
            session.transferUserInfo(payload)
        }
    }

    func publish(_ metrics: WatchWorkoutMetrics) {
        guard WCSession.isSupported(),
              let data = try? JSONEncoder().encode(metrics) else { return }

        let session = WCSession.default
        let payload = [WatchWorkoutPayloadKey.metrics: data]
        try? session.updateApplicationContext(payload)
        if metrics.isFinal { session.transferUserInfo(payload) }
        if session.activationState == .activated, session.isReachable {
            session.sendMessage(payload, replyHandler: nil, errorHandler: nil)
        }
    }

    private func receive(_ payload: [String: Any]) {
        guard let data = payload[WatchWorkoutPayloadKey.state] as? Data,
              let state = try? JSONDecoder().decode(WatchWorkoutState.self, from: data) else { return }
        stateHandler?(state)
    }

    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        if activationState == .activated {
            receive(session.receivedApplicationContext)
            requestState()
        }
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        receive(message)
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        receive(applicationContext)
    }
}
