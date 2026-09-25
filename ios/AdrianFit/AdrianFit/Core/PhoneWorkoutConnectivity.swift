import Foundation
@preconcurrency import WatchConnectivity

final class PhoneWorkoutConnectivity: NSObject, WCSessionDelegate, @unchecked Sendable {
    static let shared = PhoneWorkoutConnectivity()

    @MainActor private var commandHandler: ((WatchWorkoutCommand) -> Void)?
    @MainActor private var metricsHandler: ((WatchWorkoutMetrics) -> Void)?
    @MainActor private var pendingCommands: [WatchWorkoutCommand] = []
    @MainActor private var latestMetrics: WatchWorkoutMetrics?

    private override init() {
        super.init()
    }

    func activate() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    func publish(_ state: WatchWorkoutState) {
        guard WCSession.isSupported(),
              let data = try? JSONEncoder().encode(state) else { return }

        let session = WCSession.default
        let payload = [WatchWorkoutPayloadKey.state: data]
        try? session.updateApplicationContext(payload)

        if session.activationState == .activated, session.isReachable {
            session.sendMessage(payload, replyHandler: nil, errorHandler: nil)
        }
    }

    @MainActor
    func connect(
        commandHandler: @escaping (WatchWorkoutCommand) -> Void,
        metricsHandler: ((WatchWorkoutMetrics) -> Void)? = nil
    ) {
        self.commandHandler = commandHandler
        self.metricsHandler = metricsHandler
        let commands = pendingCommands
        pendingCommands.removeAll()
        commands.forEach(commandHandler)
        if let latestMetrics { metricsHandler?(latestMetrics) }
    }

    @MainActor
    func disconnect() {
        commandHandler = nil
        metricsHandler = nil
    }

    private func receive(_ payload: [String: Any]) {
        let command = (payload[WatchWorkoutPayloadKey.command] as? Data)
            .flatMap { try? JSONDecoder().decode(WatchWorkoutCommand.self, from: $0) }
        let metrics = (payload[WatchWorkoutPayloadKey.metrics] as? Data)
            .flatMap { try? JSONDecoder().decode(WatchWorkoutMetrics.self, from: $0) }
        guard command != nil || metrics != nil else { return }

        Task { @MainActor [weak self] in
            guard let self else { return }
            if let command {
                if let commandHandler { commandHandler(command) }
                else { pendingCommands.append(command) }
            }
            if let metrics {
                latestMetrics = metrics
                metricsHandler?(metrics)
                if metrics.isFinal {
                    Task { await syncFinalMetrics(metrics) }
                }
            }
        }
    }

    @MainActor
    private func syncFinalMetrics(_ metrics: WatchWorkoutMetrics) async {
        struct Result: Decodable, Sendable { let id: String }
        for attempt in 0..<4 {
            do {
                let _: Result = try await APIClient.live.post(
                    "/api/student/workout/health-metrics",
                    body: metrics
                )
                NotificationCenter.default.post(name: .workoutHistoryDidChange, object: nil)
                return
            } catch {
                guard attempt < 3 else { return }
                try? await Task.sleep(for: .seconds(2))
            }
        }
    }

    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {}

    func sessionDidBecomeInactive(_ session: WCSession) {}

    func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        receive(message)
    }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        receive(userInfo)
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        receive(applicationContext)
    }
}
