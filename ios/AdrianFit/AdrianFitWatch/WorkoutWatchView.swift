import Foundation
import SwiftUI

struct WorkoutWatchView: View {
    @EnvironmentObject private var store: WatchWorkoutStore

    var body: some View {
        WorkoutWatchContent(
            workout: store.workout,
            restRemaining: store.restRemaining,
            healthPhase: store.healthPhase,
            healthMetrics: store.healthMetrics,
            onStartWorkout: store.startWorkout,
            onCompleteSet: store.completeCurrentSet,
            onExtendRest: store.extendRest,
            onSkipRest: store.skipRest,
            onRefresh: store.requestState
        )
        .task { store.requestState() }
    }
}

private struct WorkoutWatchContent: View {
    let workout: WatchWorkoutState?
    let restRemaining: Int?
    let healthPhase: WatchHealthWorkoutPhase
    let healthMetrics: WatchWorkoutMetrics?
    let onStartWorkout: () -> Void
    let onCompleteSet: () -> Void
    let onExtendRest: () -> Void
    let onSkipRest: () -> Void
    let onRefresh: () -> Void

    var body: some View {
        ZStack {
            WatchTheme.background.ignoresSafeArea()
            WatchTheme.ambientGlow
                .frame(height: 180)
                .frame(maxHeight: .infinity, alignment: .top)
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 10) {
                    BrandHeader()

                    if let workout {
                        workoutContent(workout)
                    } else {
                        EmptyWorkoutCard(onRefresh: onRefresh)
                    }
                }
                .padding(.horizontal, 2)
                .padding(.bottom, 8)
            }
            .scrollIndicators(.hidden)
        }
        .tint(WatchTheme.accent)
    }

    @ViewBuilder
    private func workoutContent(_ workout: WatchWorkoutState) -> some View {
        ProgressHeader(workout: workout)

        if workout.isWorkoutFinished {
            WorkoutCompleteCard(metrics: healthMetrics)
        } else if healthPhase != .running {
            WorkoutStartCard(
                dayName: workout.dayName,
                phase: healthPhase,
                onStart: onStartWorkout
            )
        } else if let exerciseName = workout.exerciseName,
                  let currentSetIndex = workout.currentSetIndex {
            LiveHealthMetricsStrip(metrics: healthMetrics)

            if let restRemaining {
                RestTimerHero(
                    remaining: restRemaining,
                    total: workout.restTotal,
                    onExtend: onExtendRest,
                    onSkip: onSkipRest
                )

                NextSetStrip(
                    exerciseName: exerciseName,
                    currentSet: currentSetIndex + 1,
                    totalSets: workout.exerciseSetCount,
                    targetLoad: workout.targetLoad
                )
            } else {
                ExerciseCard(
                    name: exerciseName,
                    targetReps: workout.targetReps,
                    targetLoad: workout.targetLoad,
                    currentSet: currentSetIndex + 1,
                    setCount: workout.exerciseSetCount
                )

                CompleteSetButton(
                    setNumber: currentSetIndex + 1,
                    action: onCompleteSet
                )
            }
        } else {
            WorkoutCompleteCard(metrics: healthMetrics)
        }
    }
}

private struct WorkoutStartCard: View {
    let dayName: String
    let phase: WatchHealthWorkoutPhase
    let onStart: () -> Void

    private var errorMessage: String? {
        if case .failed(let message) = phase { return message }
        return nil
    }

    private var isBusy: Bool { phase == .authorizing || phase == .finishing }

    var body: some View {
        VStack(spacing: 12) {
            ZStack {
                Circle().fill(WatchTheme.accent.opacity(0.15))
                Circle().stroke(WatchTheme.accent.opacity(0.45), lineWidth: 1)
                Image(systemName: "figure.strengthtraining.traditional")
                    .font(.system(size: 27, weight: .bold))
                    .foregroundStyle(WatchTheme.accentGradient)
            }
            .frame(width: 70, height: 70)

            VStack(spacing: 3) {
                Text(isBusy ? "Preparando treino…" : "Iniciar pelo relógio")
                    .font(.system(size: 17, weight: .black, design: .rounded))
                    .multilineTextAlignment(.center)
                Text(dayName)
                    .font(.system(size: 10, weight: .medium, design: .rounded))
                    .foregroundStyle(WatchTheme.secondaryText)
                    .lineLimit(2)
                    .multilineTextAlignment(.center)
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(.system(size: 9, weight: .medium, design: .rounded))
                    .foregroundStyle(.red.opacity(0.9))
                    .multilineTextAlignment(.center)
            }

            Button(action: onStart) {
                HStack(spacing: 7) {
                    if isBusy { ProgressView().tint(.white) }
                    else { Image(systemName: "play.fill") }
                    Text(isBusy ? "AUTORIZANDO" : "INICIAR TREINO")
                        .font(.system(size: 11, weight: .black, design: .rounded))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 11)
                .foregroundStyle(.white)
                .background(WatchTheme.accentGradient, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(isBusy)

            Label("Salva calorias e batimentos no app Saúde", systemImage: "heart.text.square")
                .font(.system(size: 8, weight: .medium, design: .rounded))
                .foregroundStyle(WatchTheme.tertiaryText)
                .multilineTextAlignment(.center)
        }
        .padding(14)
        .background(WatchTheme.surfaceGradient, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(WatchTheme.cardBorder, lineWidth: 0.8)
        }
    }
}

private struct LiveHealthMetricsStrip: View {
    let metrics: WatchWorkoutMetrics?

    var body: some View {
        HStack(spacing: 6) {
            LiveMetric(
                icon: "flame.fill",
                value: "\(Int((metrics?.activeEnergyKilocalories ?? 0).rounded()))",
                unit: "kcal",
                tint: WatchTheme.accentSoft
            )
            LiveMetric(
                icon: "heart.fill",
                value: metrics.map { "\(Int($0.currentHeartRateBPM.rounded()))" } ?? "—",
                unit: "bpm",
                tint: .red
            )
            LiveMetric(
                icon: "clock.fill",
                value: compactDuration(metrics?.durationSeconds ?? 0),
                unit: "tempo",
                tint: WatchTheme.success
            )
        }
        .accessibilityElement(children: .contain)
    }
}

private struct LiveMetric: View {
    let icon: String
    let value: String
    let unit: String
    let tint: Color

    var body: some View {
        VStack(spacing: 3) {
            Image(systemName: icon).font(.system(size: 9, weight: .bold)).foregroundStyle(tint)
            Text(value)
                .font(.system(size: 12, weight: .black, design: .rounded).monospacedDigit())
                .lineLimit(1)
                .minimumScaleFactor(0.75)
            Text(unit.uppercased())
                .font(.system(size: 6, weight: .bold, design: .rounded))
                .foregroundStyle(WatchTheme.tertiaryText)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 7)
        .background(WatchTheme.raisedSurface, in: RoundedRectangle(cornerRadius: 11, style: .continuous))
    }
}

private func compactDuration(_ seconds: Int) -> String {
    String(format: "%02d:%02d", seconds / 60, seconds % 60)
}

private struct BrandHeader: View {
    var body: some View {
        HStack(spacing: 7) {
            ZStack {
                Circle()
                    .fill(WatchTheme.accentGradient)
                Image(systemName: "dumbbell.fill")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(.white)
            }
            .frame(width: 25, height: 25)
            .shadow(color: WatchTheme.accent.opacity(0.35), radius: 7)

            VStack(alignment: .leading, spacing: 0) {
                Text("ADRIAN FIT")
                    .font(.system(size: 12, weight: .black, design: .rounded))
                    .tracking(0.7)
                Text("TREINO EM TEMPO REAL")
                    .font(.system(size: 7, weight: .semibold, design: .rounded))
                    .tracking(0.5)
                    .foregroundStyle(WatchTheme.secondaryText)
            }

            Spacer(minLength: 2)

            Circle()
                .fill(WatchTheme.success)
                .frame(width: 6, height: 6)
                .shadow(color: WatchTheme.success.opacity(0.7), radius: 4)
                .accessibilityLabel("Sincronização ativa")
        }
        .padding(.horizontal, 4)
    }
}

private struct ProgressHeader: View {
    let workout: WatchWorkoutState

    private var progress: Double {
        Double(workout.completedSetCount) / Double(max(workout.totalSetCount, 1))
    }

    private var percentage: Int {
        Int((progress * 100).rounded())
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("TREINO ATUAL")
                        .font(.system(size: 8, weight: .bold, design: .rounded))
                        .tracking(0.6)
                        .foregroundStyle(WatchTheme.accentSoft)
                    Text(workout.dayName)
                        .font(.system(size: 15, weight: .bold, design: .rounded))
                        .lineLimit(1)
                }

                Spacer(minLength: 4)

                Text("\(percentage)%")
                    .font(.system(size: 13, weight: .bold, design: .rounded).monospacedDigit())
                    .foregroundStyle(WatchTheme.accentSoft)
            }

            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(WatchTheme.track)
                    Capsule()
                        .fill(WatchTheme.accentGradient)
                        .frame(width: max(6, proxy.size.width * progress))
                }
            }
            .frame(height: 5)

            HStack {
                Label("\(workout.completedSetCount) concluídas", systemImage: "checkmark.circle.fill")
                Spacer()
                Text("\(workout.totalSetCount) séries")
            }
            .font(.system(size: 9, weight: .medium, design: .rounded))
            .foregroundStyle(WatchTheme.secondaryText)
        }
        .padding(11)
        .background(WatchTheme.surfaceGradient, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(WatchTheme.cardBorder, lineWidth: 0.8)
        }
    }
}

private struct ExerciseCard: View {
    let name: String
    let targetReps: String?
    let targetLoad: String?
    let currentSet: Int
    let setCount: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("AGORA")
                    .font(.system(size: 8, weight: .black, design: .rounded))
                    .tracking(0.8)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(WatchTheme.accentGradient, in: Capsule())

                Spacer()

                Image(systemName: "figure.strengthtraining.traditional")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(WatchTheme.accentSoft)
            }

            Text(name)
                .font(.system(size: 18, weight: .bold, design: .rounded))
                .lineLimit(2)
                .minimumScaleFactor(0.78)

            HStack(spacing: 8) {
                WorkoutMetric(
                    label: "SÉRIE",
                    value: "\(currentSet)/\(setCount)",
                    icon: "square.stack.3d.up.fill"
                )

                WorkoutMetric(
                    label: "REPETIÇÕES",
                    value: targetReps ?? "—",
                    icon: "repeat"
                )
            }

            if let targetLoad {
                WorkoutMetric(
                    label: "META DE CARGA",
                    value: targetLoad,
                    icon: "scalemass.fill"
                )
            }
        }
        .padding(12)
        .background(WatchTheme.surfaceGradient, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(alignment: .leading) {
            Capsule()
                .fill(WatchTheme.accentGradient)
                .frame(width: 3)
                .padding(.vertical, 14)
        }
        .overlay {
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(WatchTheme.cardBorder, lineWidth: 0.8)
        }
    }
}

private struct WorkoutMetric: View {
    let label: String
    let value: String
    let icon: String

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(WatchTheme.accentSoft)

            VStack(alignment: .leading, spacing: 1) {
                Text(label)
                    .font(.system(size: 7, weight: .bold, design: .rounded))
                    .foregroundStyle(WatchTheme.tertiaryText)
                Text(value)
                    .font(.system(size: 13, weight: .bold, design: .rounded).monospacedDigit())
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(8)
        .background(WatchTheme.raisedSurface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

private struct CompleteSetButton: View {
    let setNumber: Int
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 9) {
                ZStack {
                    Circle().fill(.white.opacity(0.18))
                    Image(systemName: "checkmark")
                        .font(.system(size: 12, weight: .black))
                }
                .frame(width: 30, height: 30)

                VStack(alignment: .leading, spacing: 1) {
                    Text("CONCLUIR SÉRIE \(setNumber)")
                        .font(.system(size: 12, weight: .black, design: .rounded))
                    Text("Iniciar descanso")
                        .font(.system(size: 9, weight: .medium, design: .rounded))
                        .foregroundStyle(.white.opacity(0.8))
                }

                Spacer(minLength: 2)
                Image(systemName: "chevron.right")
                    .font(.system(size: 10, weight: .bold))
            }
            .foregroundStyle(.white)
            .padding(10)
            .background(WatchTheme.accentGradient, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .shadow(color: WatchTheme.accent.opacity(0.35), radius: 10, y: 4)
        }
        .buttonStyle(.plain)
        .accessibilityHint("Marca a série como concluída e sincroniza com o iPhone")
    }
}

private struct RestTimerHero: View {
    let remaining: Int
    let total: Int
    let onExtend: () -> Void
    let onSkip: () -> Void

    private var progress: Double {
        min(max(Double(remaining) / Double(max(total, 1)), 0), 1)
    }

    var body: some View {
        VStack(spacing: 10) {
            ZStack {
                Circle()
                    .fill(WatchTheme.timerGlow)
                    .frame(width: 148, height: 148)
                    .blur(radius: 12)

                Circle()
                    .stroke(WatchTheme.track, lineWidth: 11)

                Circle()
                    .trim(from: 0, to: progress)
                    .stroke(
                        AngularGradient(
                            colors: [WatchTheme.accentSoft, WatchTheme.accent, WatchTheme.accentSoft],
                            center: .center
                        ),
                        style: StrokeStyle(lineWidth: 11, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))
                    .shadow(color: WatchTheme.accent.opacity(0.55), radius: 7)
                    .animation(.easeInOut(duration: 0.35), value: progress)

                VStack(spacing: 2) {
                    Image(systemName: "timer")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(WatchTheme.accentSoft)
                    Text("DESCANSO")
                        .font(.system(size: 8, weight: .black, design: .rounded))
                        .tracking(1.0)
                        .foregroundStyle(WatchTheme.secondaryText)
                    Text(durationText(remaining))
                        .font(.system(size: 35, weight: .black, design: .rounded).monospacedDigit())
                        .contentTransition(.numericText())
                        .animation(.snappy(duration: 0.25), value: remaining)
                    Text("RECUPERE O FÔLEGO")
                        .font(.system(size: 7, weight: .bold, design: .rounded))
                        .tracking(0.5)
                        .foregroundStyle(WatchTheme.tertiaryText)
                }
            }
            .frame(width: 150, height: 150)

            HStack(spacing: 16) {
                TimerActionButton(
                    title: "+15s",
                    systemImage: "plus",
                    prominence: .accent,
                    action: onExtend
                )

                TimerActionButton(
                    title: "Pular",
                    systemImage: "forward.fill",
                    prominence: .neutral,
                    action: onSkip
                )
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Descanso, \(remaining) segundos restantes")
    }

    private func durationText(_ value: Int) -> String {
        String(format: "%02d:%02d", value / 60, value % 60)
    }
}

private struct TimerActionButton: View {
    enum Prominence {
        case accent
        case neutral
    }

    let title: String
    let systemImage: String
    let prominence: Prominence
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 5) {
                ZStack {
                    Circle()
                        .fill(prominence == .accent ? WatchTheme.accent.opacity(0.18) : WatchTheme.raisedSurface)
                    Circle()
                        .stroke(prominence == .accent ? WatchTheme.accent.opacity(0.65) : WatchTheme.cardBorder, lineWidth: 1)
                    Image(systemName: systemImage)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(prominence == .accent ? WatchTheme.accentSoft : .white)
                }
                .frame(width: 40, height: 40)

                Text(title)
                    .font(.system(size: 9, weight: .bold, design: .rounded))
                    .foregroundStyle(prominence == .accent ? WatchTheme.accentSoft : WatchTheme.secondaryText)
            }
        }
        .buttonStyle(.plain)
    }
}

private struct NextSetStrip: View {
    let exerciseName: String
    let currentSet: Int
    let totalSets: Int
    var targetLoad: String?

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "arrow.right.circle.fill")
                .foregroundStyle(WatchTheme.accentSoft)

            VStack(alignment: .leading, spacing: 1) {
                Text("A SEGUIR · SÉRIE \(currentSet)/\(totalSets)" + (targetLoad.map { " · \($0.uppercased())" } ?? ""))
                    .font(.system(size: 7, weight: .black, design: .rounded))
                    .tracking(0.5)
                    .foregroundStyle(WatchTheme.tertiaryText)
                Text(exerciseName)
                    .font(.system(size: 10, weight: .semibold, design: .rounded))
                    .lineLimit(1)
            }

            Spacer(minLength: 0)
        }
        .padding(9)
        .background(WatchTheme.raisedSurface, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
    }
}

private struct WorkoutCompleteCard: View {
    let metrics: WatchWorkoutMetrics?

    var body: some View {
        VStack(spacing: 10) {
            ZStack {
                Circle()
                    .fill(WatchTheme.success.opacity(0.16))
                Circle()
                    .stroke(WatchTheme.success.opacity(0.45), lineWidth: 1)
                Image(systemName: "checkmark")
                    .font(.system(size: 26, weight: .black))
                    .foregroundStyle(WatchTheme.success)
            }
            .frame(width: 66, height: 66)
            .shadow(color: WatchTheme.success.opacity(0.25), radius: 12)

            Text("Treino concluído")
                .font(.system(size: 18, weight: .black, design: .rounded))
            Text("Excelente trabalho hoje!")
                .font(.system(size: 10, weight: .medium, design: .rounded))
                .foregroundStyle(WatchTheme.secondaryText)

            if let metrics {
                HStack(spacing: 6) {
                    LiveMetric(
                        icon: "flame.fill",
                        value: "\(Int(metrics.activeEnergyKilocalories.rounded()))",
                        unit: "kcal",
                        tint: WatchTheme.accentSoft
                    )
                    LiveMetric(
                        icon: "heart.fill",
                        value: "\(Int(metrics.averageHeartRateBPM.rounded()))",
                        unit: "FC média",
                        tint: .red
                    )
                    LiveMetric(
                        icon: "clock.fill",
                        value: compactDuration(metrics.durationSeconds),
                        unit: "tempo",
                        tint: WatchTheme.success
                    )
                }
                .padding(.top, 3)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 22)
        .background(WatchTheme.surfaceGradient, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(WatchTheme.success.opacity(0.22), lineWidth: 1)
        }
    }
}

private struct EmptyWorkoutCard: View {
    let onRefresh: () -> Void

    var body: some View {
        VStack(spacing: 10) {
            ZStack {
                Circle()
                    .fill(WatchTheme.accent.opacity(0.13))
                Circle()
                    .stroke(WatchTheme.accent.opacity(0.4), lineWidth: 1)
                Image(systemName: "dumbbell.fill")
                    .font(.system(size: 25, weight: .bold))
                    .foregroundStyle(WatchTheme.accentGradient)
            }
            .frame(width: 64, height: 64)
            .shadow(color: WatchTheme.accent.opacity(0.22), radius: 12)

            Text("Pronto para treinar?")
                .font(.system(size: 17, weight: .black, design: .rounded))
                .multilineTextAlignment(.center)
            Text("Inicie um treino no iPhone e acompanhe tudo pelo pulso.")
                .font(.system(size: 10, weight: .medium, design: .rounded))
                .foregroundStyle(WatchTheme.secondaryText)
                .multilineTextAlignment(.center)

            Button(action: onRefresh) {
                Label("Sincronizar", systemImage: "arrow.triangle.2.circlepath")
                    .font(.system(size: 10, weight: .bold, design: .rounded))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(WatchTheme.accent.opacity(0.16), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .foregroundStyle(WatchTheme.accentSoft)
            }
            .buttonStyle(.plain)
        }
        .padding(14)
        .background(WatchTheme.surfaceGradient, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(WatchTheme.cardBorder, lineWidth: 0.8)
        }
    }
}

private enum WatchTheme {
    static let accent = Color(red: 1, green: 0.30, blue: 0.04)
    static let accentSoft = Color(red: 1, green: 0.53, blue: 0.18)
    static let success = Color(red: 0.28, green: 0.88, blue: 0.57)
    static let background = Color(red: 0.025, green: 0.025, blue: 0.032)
    static let raisedSurface = Color.white.opacity(0.075)
    static let track = Color.white.opacity(0.10)
    static let cardBorder = Color.white.opacity(0.11)
    static let secondaryText = Color.white.opacity(0.62)
    static let tertiaryText = Color.white.opacity(0.42)
    static let timerGlow = accent.opacity(0.13)

    static let accentGradient = LinearGradient(
        colors: [accentSoft, accent],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static let surfaceGradient = LinearGradient(
        colors: [Color.white.opacity(0.105), Color.white.opacity(0.045)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static let ambientGlow = RadialGradient(
        colors: [accent.opacity(0.18), accent.opacity(0.045), .clear],
        center: .topLeading,
        startRadius: 0,
        endRadius: 150
    )
}

private extension WatchWorkoutState {
    static let previewActive = WatchWorkoutState(
        dayId: "dorsal",
        dayName: "Dorsal, bíceps +1",
        exerciseId: "remada",
        exerciseName: "Remada curvada pronada",
        targetReps: "12",
        targetLoad: "22,5 kg",
        currentSetIndex: 1,
        exerciseSetCount: 4,
        completedSetCount: 6,
        totalSetCount: 18,
        restEndDate: nil,
        restTotal: 90,
        isWorkoutFinished: false
    )

    static let previewRest = WatchWorkoutState(
        dayId: "dorsal",
        dayName: "Dorsal, bíceps +1",
        exerciseId: "remada",
        exerciseName: "Remada curvada pronada",
        targetReps: "12",
        targetLoad: "25 kg",
        currentSetIndex: 2,
        exerciseSetCount: 4,
        completedSetCount: 7,
        totalSetCount: 18,
        restEndDate: Date.now.addingTimeInterval(54),
        restTotal: 90,
        isWorkoutFinished: false
    )
}

#Preview("Série ativa") {
    WorkoutWatchContent(
        workout: .previewActive,
        restRemaining: nil,
        healthPhase: .running,
        healthMetrics: nil,
        onStartWorkout: {},
        onCompleteSet: {},
        onExtendRest: {},
        onSkipRest: {},
        onRefresh: {}
    )
}

#Preview("Descanso") {
    WorkoutWatchContent(
        workout: .previewRest,
        restRemaining: 54,
        healthPhase: .running,
        healthMetrics: nil,
        onStartWorkout: {},
        onCompleteSet: {},
        onExtendRest: {},
        onSkipRest: {},
        onRefresh: {}
    )
}

#Preview("Sem treino") {
    WorkoutWatchContent(
        workout: nil,
        restRemaining: nil,
        healthPhase: .idle,
        healthMetrics: nil,
        onStartWorkout: {},
        onCompleteSet: {},
        onExtendRest: {},
        onSkipRest: {},
        onRefresh: {}
    )
}
