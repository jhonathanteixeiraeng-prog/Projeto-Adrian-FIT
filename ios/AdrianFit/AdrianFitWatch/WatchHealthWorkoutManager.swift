import Foundation
@preconcurrency import HealthKit

enum WatchHealthWorkoutPhase: Equatable {
    case idle
    case authorizing
    case running
    case finishing
    case finished
    case failed(String)
}

@MainActor
final class WatchHealthWorkoutManager: NSObject {
    var onUpdate: ((WatchHealthWorkoutPhase, WatchWorkoutMetrics?) -> Void)?

    private let healthStore = HKHealthStore()
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?
    private var metrics: WatchWorkoutMetrics?
    private var durationTask: Task<Void, Never>?
    private var phase: WatchHealthWorkoutPhase = .idle

    func start(dayId: String) async {
        guard phase == .idle || phase == .finished || isFailed else { return }
        guard HKHealthStore.isHealthDataAvailable() else {
            updatePhase(.failed("O HealthKit não está disponível neste Apple Watch."))
            return
        }

        updatePhase(.authorizing)
        do {
            try await requestAuthorization()
            try beginSession(dayId: dayId)
        } catch {
            updatePhase(.failed(error.localizedDescription))
        }
    }

    func finish() {
        guard phase == .running else { return }
        durationTask?.cancel()
        durationTask = nil
        updatePhase(.finishing)
        session?.end()
    }

    private var isFailed: Bool {
        if case .failed = phase { return true }
        return false
    }

    private func requestAuthorization() async throws {
        let workoutType = HKObjectType.workoutType()
        let heartRate = HKObjectType.quantityType(forIdentifier: .heartRate)!
        let activeEnergy = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)!
        try await healthStore.requestAuthorization(
            toShare: [workoutType],
            read: [workoutType, heartRate, activeEnergy]
        )
    }

    private func beginSession(dayId: String) throws {
        let configuration = HKWorkoutConfiguration()
        configuration.activityType = .traditionalStrengthTraining
        configuration.locationType = .indoor

        let session = try HKWorkoutSession(healthStore: healthStore, configuration: configuration)
        let builder = session.associatedWorkoutBuilder()
        builder.dataSource = HKLiveWorkoutDataSource(
            healthStore: healthStore,
            workoutConfiguration: configuration
        )
        session.delegate = self
        builder.delegate = self

        let startDate = Date.now
        metrics = WatchWorkoutMetrics(
            dayId: dayId,
            localDate: startDate.formatted(.iso8601.year().month().day()),
            timezoneOffsetMinutes: TimeZone.current.secondsFromGMT(for: startDate) / 60,
            startedAt: startDate,
            endedAt: nil,
            durationSeconds: 0,
            activeEnergyKilocalories: 0,
            currentHeartRateBPM: 0,
            averageHeartRateBPM: 0,
            maxHeartRateBPM: 0,
            healthWorkoutUUID: nil,
            isFinal: false
        )
        self.session = session
        self.builder = builder

        session.startActivity(with: startDate)
        builder.beginCollection(withStart: startDate) { [weak self] success, error in
            Task { @MainActor [weak self] in
                guard let self else { return }
                if success {
                    updatePhase(.running)
                    publishMetrics()
                    startDurationUpdates()
                } else {
                    session.end()
                    updatePhase(.failed(error?.localizedDescription ?? "Não foi possível iniciar o treino."))
                }
            }
        }
    }

    private func startDurationUpdates() {
        durationTask?.cancel()
        durationTask = Task { @MainActor [weak self] in
            while !Task.isCancelled {
                guard let self, var value = metrics else { return }
                value.durationSeconds = max(0, Int(Date.now.timeIntervalSince(value.startedAt)))
                metrics = value
                publishMetrics()
                try? await Task.sleep(for: .seconds(1))
            }
        }
    }

    private func refreshStatistics(from builder: HKLiveWorkoutBuilder, collectedTypes: Set<HKSampleType>) {
        guard var value = metrics else { return }

        if let energyType = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned),
           collectedTypes.contains(energyType),
           let quantity = builder.statistics(for: energyType)?.sumQuantity() {
            value.activeEnergyKilocalories = quantity.doubleValue(for: .kilocalorie())
        }

        if let heartRateType = HKObjectType.quantityType(forIdentifier: .heartRate),
           collectedTypes.contains(heartRateType),
           let statistics = builder.statistics(for: heartRateType) {
            let unit = HKUnit.count().unitDivided(by: .minute())
            value.currentHeartRateBPM = statistics.mostRecentQuantity()?.doubleValue(for: unit) ?? value.currentHeartRateBPM
            value.averageHeartRateBPM = statistics.averageQuantity()?.doubleValue(for: unit) ?? value.averageHeartRateBPM
            value.maxHeartRateBPM = statistics.maximumQuantity()?.doubleValue(for: unit) ?? value.maxHeartRateBPM
        }

        metrics = value
        publishMetrics()
    }

    private func finishBuilder(at endDate: Date) {
        guard let builder else {
            finalize(workout: nil, endDate: endDate, error: nil)
            return
        }

        builder.endCollection(withEnd: endDate) { [weak self] success, error in
            guard success else {
                Task { @MainActor [weak self] in
                    self?.finalize(workout: nil, endDate: endDate, error: error)
                }
                return
            }

            builder.finishWorkout { [weak self] workout, error in
                Task { @MainActor [weak self] in
                    self?.finalize(workout: workout, endDate: endDate, error: error)
                }
            }
        }
    }

    private func finalize(workout: HKWorkout?, endDate: Date, error: Error?) {
        durationTask?.cancel()
        durationTask = nil

        guard error == nil, var value = metrics else {
            updatePhase(.failed(error?.localizedDescription ?? "Não foi possível salvar o treino no app Saúde."))
            resetSessionReferences()
            return
        }

        value.endedAt = endDate
        value.durationSeconds = max(0, Int(endDate.timeIntervalSince(value.startedAt)))
        value.healthWorkoutUUID = workout?.uuid.uuidString
        value.isFinal = true
        metrics = value
        updatePhase(.finished)
        publishMetrics()
        resetSessionReferences()
    }

    private func resetSessionReferences() {
        session = nil
        builder = nil
    }

    private func updatePhase(_ newPhase: WatchHealthWorkoutPhase) {
        phase = newPhase
        onUpdate?(newPhase, metrics)
    }

    private func publishMetrics() {
        onUpdate?(phase, metrics)
    }
}

extension WatchHealthWorkoutManager: HKWorkoutSessionDelegate {
    nonisolated func workoutSession(
        _ workoutSession: HKWorkoutSession,
        didChangeTo toState: HKWorkoutSessionState,
        from fromState: HKWorkoutSessionState,
        date: Date
    ) {
        guard toState == .ended else { return }
        Task { @MainActor [weak self] in
            self?.finishBuilder(at: date)
        }
    }

    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        Task { @MainActor [weak self] in
            self?.durationTask?.cancel()
            self?.updatePhase(.failed(error.localizedDescription))
            self?.resetSessionReferences()
        }
    }
}

extension WatchHealthWorkoutManager: HKLiveWorkoutBuilderDelegate {
    nonisolated func workoutBuilder(
        _ workoutBuilder: HKLiveWorkoutBuilder,
        didCollectDataOf collectedTypes: Set<HKSampleType>
    ) {
        Task { @MainActor [weak self] in
            self?.refreshStatistics(from: workoutBuilder, collectedTypes: collectedTypes)
        }
    }

    nonisolated func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}
}
