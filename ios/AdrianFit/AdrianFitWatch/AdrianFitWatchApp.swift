import SwiftUI

@main
struct AdrianFitWatchApp: App {
    @StateObject private var workoutStore = WatchWorkoutStore()

    var body: some Scene {
        WindowGroup {
            WorkoutWatchView()
                .environmentObject(workoutStore)
        }
    }
}
