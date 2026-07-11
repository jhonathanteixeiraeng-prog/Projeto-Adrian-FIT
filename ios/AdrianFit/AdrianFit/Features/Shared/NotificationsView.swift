import SwiftUI

struct AppNotification: Codable, Identifiable, Sendable {
    let id: String
    let type: String
    let title: String
    let body: String
    let read: Bool
    let createdAt: String

    var icon: String {
        switch type {
        case "WORKOUT_REMINDER": "dumbbell.fill"
        case "MEAL_REMINDER": "fork.knife"
        case "CHECKIN_REMINDER": "checkmark.seal.fill"
        case "PLAN_UPDATED": "arrow.triangle.2.circlepath"
        case "LOW_ADHERENCE": "exclamationmark.triangle.fill"
        case "NEW_MESSAGE": "bubble.left.fill"
        default: "bell.fill"
        }
    }

    var when: Date {
        (try? Date(createdAt, strategy: .iso8601.year().month().day().timeZone(separator: .omitted).time(includingFractionalSeconds: true)))
            ?? (try? Date(createdAt, strategy: .iso8601))
            ?? .now
    }
}

struct NotificationsPayload: Codable, Sendable {
    let notifications: [AppNotification]
    let unreadMessages: Int
    let unreadCount: Int
}

struct NotificationsView: View {
    @Environment(\.apiClient) private var api
    let role: UserRole

    @State private var payload: NotificationsPayload?
    @State private var loading = true
    @State private var error: String?

    private var basePath: String {
        role == .personal ? "/api/personal/notifications" : "/api/student/notifications"
    }

    var body: some View {
        Group {
            if loading && payload == nil { ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity) }
            else if let payload, payload.notifications.isEmpty {
                ContentUnavailableView("Tudo em dia", systemImage: "bell.slash", description: Text("Nenhuma notificação por aqui."))
            } else if let payload {
                List(payload.notifications) { notification in
                    Button {
                        Task { await markRead(id: notification.id) }
                    } label: {
                        HStack(alignment: .top, spacing: 12) {
                            Image(systemName: notification.icon)
                                .foregroundStyle(notification.read ? FitTheme.secondaryText : FitTheme.orange)
                                .frame(width: 26)
                            VStack(alignment: .leading, spacing: 4) {
                                Text(notification.title)
                                    .font(.subheadline.weight(notification.read ? .regular : .semibold))
                                    .foregroundStyle(.white)
                                Text(notification.body).font(.caption).foregroundStyle(FitTheme.secondaryText)
                                Text(notification.when.formatted(.relative(presentation: .named)))
                                    .font(.caption2).foregroundStyle(FitTheme.secondaryText.opacity(0.7))
                            }
                            Spacer()
                            if !notification.read {
                                Circle().fill(FitTheme.orange).frame(width: 9, height: 9).padding(.top, 5)
                            }
                        }
                        .padding(.vertical, 3)
                    }
                    .listRowBackground(FitTheme.surface)
                }
                .scrollContentBackground(.hidden)
            } else if let error {
                ContentUnavailableView("Erro", systemImage: "exclamationmark.triangle", description: Text(error))
            }
        }
        .fitScreen()
        .navigationTitle("Notificações")
        .toolbar {
            if let payload, payload.notifications.contains(where: { !$0.read }) {
                ToolbarItem(placement: .primaryAction) {
                    Button("Ler todas") { Task { await markAllRead() } }.font(.subheadline)
                }
            }
        }
        .task { await load() }
        .refreshable { await load() }
    }

    private func load() async {
        loading = payload == nil
        defer { loading = false }
        do { payload = try await api.get(basePath); error = nil }
        catch { self.error = error.localizedDescription }
    }

    private func markRead(id: String) async {
        struct Body: Encodable { let id: String }
        try? await api.patchAck(basePath, body: Body(id: id))
        await load()
    }

    private func markAllRead() async {
        struct Body: Encodable { let readAll: Bool }
        try? await api.patchAck(basePath, body: Body(readAll: true))
        await load()
    }
}
