import SwiftUI

enum FitTheme {
    static let orange = Color(red: 1, green: 0.38, blue: 0.07)
    static let orangeSoft = Color(red: 1, green: 0.55, blue: 0.24)
    static let background = Color(red: 0.035, green: 0.035, blue: 0.042)
    static let surface = Color(red: 0.085, green: 0.085, blue: 0.10)
    static let surfaceRaised = Color(red: 0.12, green: 0.12, blue: 0.14)
    static let secondaryText = Color.white.opacity(0.58)
    static let green = Color(red: 0.30, green: 0.83, blue: 0.55)
    static let blue = Color(red: 0.30, green: 0.62, blue: 1)
}

struct BrandMark: View {
    var size: CGFloat = 46

    var body: some View {
        RoundedRectangle(cornerRadius: size * 0.28, style: .continuous)
            .fill(LinearGradient(colors: [FitTheme.orangeSoft, FitTheme.orange], startPoint: .topLeading, endPoint: .bottomTrailing))
            .frame(width: size, height: size)
            .overlay {
                Image(systemName: "dumbbell.fill")
                    .font(.system(size: size * 0.42, weight: .bold))
                    .foregroundStyle(.white)
            }
            .shadow(color: FitTheme.orange.opacity(0.25), radius: 18, y: 8)
    }
}

struct SurfaceCard<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(18)
            .background(FitTheme.surface, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .stroke(Color.white.opacity(0.06))
            }
    }
}

struct MetricPill: View {
    let icon: String
    let value: String
    let label: String
    var tint: Color = FitTheme.orange

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: icon).foregroundStyle(tint)
            Text(value).font(.title2.bold())
            Text(label).font(.caption).foregroundStyle(FitTheme.secondaryText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(FitTheme.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
}

struct SectionHeading: View {
    let title: String
    var action: String?

    var body: some View {
        HStack {
            Text(title).font(.title3.bold())
            Spacer()
            if let action { Text(action).font(.subheadline.weight(.semibold)).foregroundStyle(FitTheme.orange) }
        }
    }
}

extension View {
    func fitScreen() -> some View {
        self.background(FitTheme.background.ignoresSafeArea())
    }
}

