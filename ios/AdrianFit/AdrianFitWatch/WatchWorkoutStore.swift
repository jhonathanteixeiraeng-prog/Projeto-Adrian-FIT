import Foundation
import SwiftUI
@preconcurrency import UserNotifications
import WatchKit

@MainActor
final class WatchWorkoutStore: ObservableObject {
    @Published private(set) var workout: WatchWorkoutState?
    @Published private(set) var restRemaining: Int?
    @Published private(set) var healthPhase: WatchHealthWorkoutPhase = .idle
    @Published private(set) var healthMetrics: WatchWorkoutMetrics?

    private let connectivity: WatchWorkoutConnectivity
    private let healthWorkout: WatchHealthWorkoutManager
    private var restTask: Task<Void, Never>?
    private var notificationTask: Task<Void, Never>?
    private static let notificationIdentifier = "watch-rest-timer-done"

    init(
        connectivity: WatchWorkoutConnectivity = WatchWorkoutConnectivity(),
        healthWorkout: WatchHealthWorkoutManager = WatchHealthWorkoutManager()
    ) {
        self.connectivity = connectivity
        self.healthWorkout = healthWorkout
        healthWorkout.onUpdate = { [weak self] phase, metrics in
            guard let self else { return }
            healthPhase = phase
            healthMetrics = metrics
            if let metrics { connectivity.publish(metrics) }
        }
        connectivity.activate { [weak self] state in
            Task { @MainActor [weak self] in
                self?.apply(state)
            }
        }
    }

    func requestState() {
        connectivity.requestState()
    }

    func startWorkout() {
        guard let workout, !workout.isWorkoutFinished else { return }
        connectivity.send(.startWorkout)
        Task { await healthWorkout.start(dayId: workout.dayId) }
    }

    func completeCurrentSet() {
        guard let workout,
              let exerciseId = workout.exerciseId,
              let setIndex = workout.currentSetIndex else { return }
        WatchHaptics.play(.click)
        connectivity.send(.completeSet(exerciseId: exerciseId, setIndex: setIndex))
    }

    func extendRest() {
        guard var workout, let endDate = workout.restEndDate else { return }
        let updatedEndDate = max(Date.now, endDate).addingTimeInterval(15)
        workout.restEndDate = updatedEndDate
        workout.restTotal += 15
        apply(workout)
        WatchHaptics.play(.click)
        connectivity.send(.extendRest(seconds: 15))
    }

    func skipRest() {
        guard workout?.restEndDate != nil else { return }
        clearRest(playHaptic: false)
        WatchHaptics.play(.click)
        connectivity.send(.skipRest)
    }

    private func apply(_ state: WatchWorkoutState) {
        workout = state
        if state.isWorkoutFinished, healthPhase == .running {
            healthWorkout.finish()
        }
        guard let endDate = state.restEndDate, endDate > .now else {
            cancelRestTasks()
            restRemaining = nil
            return
        }
        startRest(until: endDate)
    }

    private func startRest(until endDate: Date) {
        restTask?.cancel()
        scheduleRestNotification(at: endDate)
        refreshRestRemaining(until: endDate)

        restTask = Task { @MainActor [weak self] in
            while !Task.isCancelled {
                guard let self else { return }
                let remaining = max(0, Int(endDate.timeIntervalSinceNow.rounded(.up)))
                guard remaining > 0 else {
                    clearRest(playHaptic: true)
                    return
                }
                restRemaining = remaining
                try? await Task.sleep(for: .seconds(1))
            }
        }
    }

    private func refreshRestRemaining(until endDate: Date) {
        restRemaining = max(1, Int(endDate.timeIntervalSinceNow.rounded(.up)))
    }

    private func clearRest(playHaptic: Bool) {
        cancelRestTasks()
        restRemaining = nil
        if var workout {
            workout.restEndDate = nil
            self.workout = workout
        }
        if playHaptic { WatchHaptics.play(.notification) }
    }

    private func cancelRestTasks() {
        restTask?.cancel()
        restTask = nil
        notificationTask?.cancel()
        notificationTask = nil
        UNUserNotificationCenter.current().removePendingNotificationRequests(
            withIdentifiers: [Self.notificationIdentifier]
        )
    }

    private func scheduleRestNotification(at endDate: Date) {
        notificationTask?.cancel()
        notificationTask = Task {
            let center = UNUserNotificationCenter.current()
            let granted = (try? await center.requestAuthorization(options: [.alert, .sound])) ?? false
            guard granted, !Task.isCancelled else { return }

            let interval = endDate.timeIntervalSinceNow
            guard interval > 0 else { return }

            center.removePendingNotificationRequests(withIdentifiers: [Self.notificationIdentifier])
            let content = UNMutableNotificationContent()
            content.title = "Descanso concluído"
            content.body = "Hora da próxima série!"
            content.sound = .default
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(interval, 1), repeats: false)
            let request = UNNotificationRequest(
                identifier: Self.notificationIdentifier,
                content: content,
                trigger: trigger
            )
            try? await center.add(request)
        }
    }
}

@MainActor
private enum WatchHaptics {
    static func play(_ type: WKHapticType) {
        WKInterfaceDevice.current().play(type)
    }
}
