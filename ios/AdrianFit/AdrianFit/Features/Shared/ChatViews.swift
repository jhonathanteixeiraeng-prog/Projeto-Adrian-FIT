import SwiftUI

struct PersonalInboxView: View {
    @Environment(\.apiClient) private var api
    @State private var students: [StudentListItem] = []
    @State private var error: String?

    var body: some View {
        Group {
            if let error, students.isEmpty { ContentUnavailableView("Chat indisponível", systemImage: "bubble.left.and.exclamationmark.bubble.right", description: Text(error)) }
            else {
                List(students) { student in
                    NavigationLink { ConversationView(contactId: student.user.id, contactName: student.user.name) } label: {
                        HStack(spacing: 13) {
                            Circle().fill(FitTheme.orange.opacity(0.15)).frame(width: 46, height: 46)
                                .overlay { Text(student.user.name.prefix(1)).foregroundStyle(FitTheme.orange).font(.headline) }
                            VStack(alignment: .leading, spacing: 4) {
                                Text(student.user.name).font(.headline)
                                Text("Abrir conversa").font(.caption).foregroundStyle(FitTheme.secondaryText)
                            }
                        }.padding(.vertical, 5)
                    }.listRowBackground(FitTheme.surface)
                }.scrollContentBackground(.hidden)
            }
        }.fitScreen().navigationTitle("Chat").task { await load() }
    }

    private func load() async { do { students = try await api.get("/api/students") } catch { self.error = error.localizedDescription } }
}

struct ConversationView: View {
    let contactId: String
    let contactName: String
    @Environment(\.apiClient) private var api
    @State private var messages: [ChatMessage] = []
    @State private var text = ""
    @State private var isSending = false
    @State private var error: String?
    @FocusState private var isFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 10) {
                        ForEach(messages) { message in
                            HStack {
                                if message.fromMe { Spacer(minLength: 54) }
                                VStack(alignment: message.fromMe ? .trailing : .leading, spacing: 4) {
                                    Text(message.text).font(.body)
                                    Text(message.time).font(.caption2).foregroundStyle(message.fromMe ? Color.white.opacity(0.7) : FitTheme.secondaryText)
                                }
                                .padding(.horizontal, 14).padding(.vertical, 10)
                                .background(message.fromMe ? FitTheme.orange : FitTheme.surfaceRaised, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                                if !message.fromMe { Spacer(minLength: 54) }
                            }.id(message.id)
                        }
                    }.padding(16)
                }
                .onChange(of: messages.count) { _, _ in if let last = messages.last { withAnimation { proxy.scrollTo(last.id, anchor: .bottom) } } }
            }
            if let error { Text(error).font(.caption).foregroundStyle(.red).padding(.horizontal) }
            HStack(alignment: .bottom, spacing: 10) {
                TextField("Mensagem", text: $text, axis: .vertical).lineLimit(1...5).focused($isFocused)
                    .padding(.horizontal, 15).padding(.vertical, 11).background(FitTheme.surfaceRaised, in: RoundedRectangle(cornerRadius: 20))
                Button { Task { await send() } } label: {
                    Image(systemName: "arrow.up").font(.headline).foregroundStyle(.white).frame(width: 44, height: 44)
                        .background(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? Color.gray : FitTheme.orange, in: Circle())
                }.disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSending)
            }.padding(12).background(.ultraThinMaterial)
        }
        .fitScreen().navigationTitle(contactName).navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func load() async { do { messages = try await api.get("/api/messages/\(contactId)"); error = nil } catch { self.error = error.localizedDescription } }
    private func send() async {
        let content = text.trimmingCharacters(in: .whitespacesAndNewlines); guard !content.isEmpty else { return }
        isSending = true; text = ""; defer { isSending = false }
        do {
            struct MessageBody: Encodable { let text: String }
            let message: ChatMessage = try await api.post("/api/messages/\(contactId)", body: MessageBody(text: content))
            messages.append(message); error = nil
        } catch { text = content; self.error = error.localizedDescription }
    }
}
