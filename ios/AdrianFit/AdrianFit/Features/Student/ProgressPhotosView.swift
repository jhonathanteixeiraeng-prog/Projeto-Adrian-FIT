import SwiftUI
import PhotosUI
import UIKit

struct RemoteProgressPhoto: Codable, Identifiable, Sendable {
    let id: String
    let url: String
    let angle: String
    let weight: Double?
    let createdAt: String

    var createdDate: Date {
        (try? Date(createdAt, strategy: .iso8601.year().month().day().timeZone(separator: .omitted).time(includingFractionalSeconds: true)))
            ?? (try? Date(createdAt, strategy: .iso8601))
            ?? .now
    }

    var fullURL: URL? {
        if url.hasPrefix("http") {
            return URL(string: url)
        }
        return URL(string: url, relativeTo: APIClient.live.baseURL)
    }

    var angleLabel: String {
        switch angle.uppercased() {
        case "FRONT": "Frente"
        case "SIDE": "Lado"
        case "BACK": "Costas"
        default: "Outro"
        }
    }
}

struct ProgressPhotosView: View {
    @Environment(\.apiClient) private var api
    @State private var selectedItem: PhotosPickerItem?
    @State private var photos: [RemoteProgressPhoto] = []
    @State private var loading = true
    @State private var uploading = false
    @State private var error: String?
    @State private var angleFilter: String? = nil // nil = todas
    @State private var uploadAngle = "FRONT"
    @State private var showAnglePicker = false
    @State private var showCompareSheet = false
    @State private var pendingImageData: Data?

    private let columns = [GridItem(.adaptive(minimum: 140), spacing: 12)]

    private var filteredPhotos: [RemoteProgressPhoto] {
        if let angleFilter {
            return photos.filter { $0.angle.uppercased() == angleFilter }
        }
        return photos
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                SurfaceCard {
                    VStack(alignment: .leading, spacing: 10) {
                        Label("LINHA DO TEMPO VISUAL", systemImage: "camera.fill")
                            .font(.caption.bold()).foregroundStyle(FitTheme.orange)
                        Text("Compare sua evolução com consistência")
                            .font(.title3.bold())
                        Text("As fotos são salvas com segurança na nuvem e podem ser acompanhadas pelo seu personal trainer.")
                            .font(.subheadline).foregroundStyle(FitTheme.secondaryText)

                        HStack(spacing: 10) {
                            PhotosPicker(selection: $selectedItem, matching: .images) {
                                HStack {
                                    if uploading {
                                        ProgressView().tint(.white).padding(.trailing, 4)
                                        Text("Enviando foto…").font(.subheadline.bold())
                                    } else {
                                        Label("ADICIONAR FOTO", systemImage: "plus.circle.fill")
                                            .font(.subheadline.bold())
                                    }
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 13)
                            }
                            .disabled(uploading)
                            .buttonStyle(.plain)
                            .foregroundStyle(.white)
                            .background(FitTheme.orange, in: RoundedRectangle(cornerRadius: 15))

                            if photos.count >= 2 {
                                Button {
                                    showCompareSheet = true
                                } label: {
                                    Image(systemName: "arrow.left.and.right.square.fill")
                                        .font(.title3)
                                        .frame(width: 48, height: 48)
                                        .background(FitTheme.surfaceRaised, in: RoundedRectangle(cornerRadius: 15))
                                        .foregroundStyle(FitTheme.orange)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }

                // Filtro de Ângulo
                if !photos.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            FilterChip(title: "Todas", isSelected: angleFilter == nil) {
                                angleFilter = nil
                            }
                            FilterChip(title: "Frente", isSelected: angleFilter == "FRONT") {
                                angleFilter = "FRONT"
                            }
                            FilterChip(title: "Lado", isSelected: angleFilter == "SIDE") {
                                angleFilter = "SIDE"
                            }
                            FilterChip(title: "Costas", isSelected: angleFilter == "BACK") {
                                angleFilter = "BACK"
                            }
                        }
                    }
                }

                if loading && photos.isEmpty {
                    ProgressView("Carregando fotos…")
                        .frame(maxWidth: .infinity).padding(.top, 40)
                } else if filteredPhotos.isEmpty {
                    ContentUnavailableView(
                        "Nenhuma foto encontrada",
                        systemImage: "photo.on.rectangle.angled",
                        description: Text("Adicione sua primeira foto para acompanhar suas transformações.")
                    )
                    .frame(maxWidth: .infinity).padding(.top, 30)
                } else {
                    LazyVGrid(columns: columns, spacing: 12) {
                        ForEach(filteredPhotos) { photo in
                            VStack(alignment: .leading, spacing: 6) {
                                ZStack(alignment: .topLeading) {
                                    AsyncImage(url: photo.fullURL) { phase in
                                        switch phase {
                                        case .empty:
                                            Rectangle()
                                                .fill(FitTheme.surfaceRaised)
                                                .overlay(ProgressView())
                                        case .success(let image):
                                            image
                                                .resizable()
                                                .scaledToFill()
                                        case .failure:
                                            Rectangle()
                                                .fill(FitTheme.surfaceRaised)
                                                .overlay(Image(systemName: "photo").foregroundStyle(FitTheme.secondaryText))
                                        @unknown default:
                                            EmptyView()
                                        }
                                    }
                                    .frame(height: 190)
                                    .frame(maxWidth: .infinity)
                                    .clipped()
                                    .clipShape(RoundedRectangle(cornerRadius: 16))

                                    Text(photo.angleLabel)
                                        .font(.caption2.bold())
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(.black.opacity(0.65), in: Capsule())
                                        .foregroundStyle(.white)
                                        .padding(8)
                                }

                                HStack {
                                    Text(photo.createdDate.formatted(date: .abbreviated, time: .omitted))
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(FitTheme.secondaryText)
                                    Spacer()
                                    if let weight = photo.weight {
                                        Text(String(format: "%.1fkg", weight))
                                            .font(.caption2.bold())
                                            .foregroundStyle(FitTheme.orange)
                                    }
                                }
                            }
                            .contextMenu {
                                Button("Excluir foto", systemImage: "trash", role: .destructive) {
                                    Task { await deletePhoto(photo) }
                                }
                            }
                        }
                    }
                }

                if let error {
                    Text(error).font(.caption).foregroundStyle(.red)
                }
            }
            .padding(20)
            .padding(.bottom, 80)
        }
        .fitScreen()
        .navigationTitle("Fotos de evolução")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadPhotos() }
        .refreshable { await loadPhotos() }
        .onChange(of: selectedItem) { _, item in
            Task { await preparePhotoUpload(item) }
        }
        .confirmationDialog("Selecione a pose da foto", isPresented: $showAnglePicker, titleVisibility: .visible) {
            Button("Frente") { Task { await uploadConfirmed(angle: "FRONT") } }
            Button("Lado") { Task { await uploadConfirmed(angle: "SIDE") } }
            Button("Costas") { Task { await uploadConfirmed(angle: "BACK") } }
            Button("Outra") { Task { await uploadConfirmed(angle: "OTHER") } }
            Button("Cancelar", role: .cancel) { pendingImageData = nil }
        }
        .sheet(isPresented: $showCompareSheet) {
            BeforeAfterComparisonView(photos: photos)
        }
    }

    private func loadPhotos() async {
        loading = true
        defer { loading = false }
        do {
            photos = try await api.get("/api/student/photos")
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func preparePhotoUpload(_ item: PhotosPickerItem?) async {
        guard let item,
              let data = try? await item.loadTransferable(type: Data.self),
              let image = UIImage(data: data),
              let jpeg = image.jpegData(compressionQuality: 0.85) else {
            if item != nil { error = "Não foi possível carregar a imagem selecionada." }
            return
        }
        self.pendingImageData = jpeg
        self.showAnglePicker = true
        self.selectedItem = nil
    }

    private func uploadConfirmed(angle: String) async {
        guard let jpeg = pendingImageData else { return }
        uploading = true
        defer {
            uploading = false
            pendingImageData = nil
        }

        do {
            let uploadedUrl = try await api.uploadImage(data: jpeg)
            struct CreateBody: Encodable {
                let url: String
                let angle: String
            }
            let _: RemoteProgressPhoto = try await api.post("/api/student/photos", body: CreateBody(url: uploadedUrl, angle: angle))
            await loadPhotos()
            error = nil
        } catch {
            self.error = "Erro ao enviar foto: \(error.localizedDescription)"
        }
    }

    private func deletePhoto(_ photo: RemoteProgressPhoto) async {
        do {
            try await api.delete("/api/student/photos/\(photo.id)")
            photos.removeAll { $0.id == photo.id }
        } catch {
            self.error = "Erro ao excluir foto: \(error.localizedDescription)"
        }
    }
}

private struct FilterChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(.medium))
                .padding(.horizontal, 14)
                .padding(.vertical, 7)
                .background(isSelected ? FitTheme.orange : FitTheme.surfaceRaised, in: Capsule())
                .foregroundStyle(isSelected ? .white : FitTheme.secondaryText)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Comparador Antes vs Depois no iOS
struct BeforeAfterComparisonView: View {
    let photos: [RemoteProgressPhoto]
    @Environment(\.dismiss) private var dismiss

    @State private var beforeIndex = 0
    @State private var afterIndex = 0
    @State private var sliderPosition: CGFloat = 0.5

    init(photos: [RemoteProgressPhoto]) {
        self.photos = photos.sorted { $0.createdDate < $1.createdDate }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                if photos.count >= 2 {
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("ANTES").font(.caption2.bold()).foregroundStyle(FitTheme.secondaryText)
                            Picker("Antes", selection: $beforeIndex) {
                                ForEach(photos.indices, id: \.self) { idx in
                                    Text("\(photos[idx].createdDate.formatted(date: .abbreviated, time: .omitted)) (\(photos[idx].angleLabel))").tag(idx)
                                }
                            }
                            .tint(FitTheme.orange)
                        }

                        Spacer()

                        VStack(alignment: .trailing, spacing: 4) {
                            Text("DEPOIS").font(.caption2.bold()).foregroundStyle(FitTheme.secondaryText)
                            Picker("Depois", selection: $afterIndex) {
                                ForEach(photos.indices, id: \.self) { idx in
                                    Text("\(photos[idx].createdDate.formatted(date: .abbreviated, time: .omitted)) (\(photos[idx].angleLabel))").tag(idx)
                                }
                            }
                            .tint(FitTheme.orange)
                        }
                    }
                    .padding(.horizontal)

                    // Comparação Visual
                    let beforePhoto = photos[safe: beforeIndex] ?? photos[0]
                    let afterPhoto = photos[safe: afterIndex] ?? photos[photos.count - 1]

                    GeometryReader { geo in
                        let width = geo.size.width
                        let height = geo.size.height

                        ZStack(alignment: .leading) {
                            // Imagem DEPOIS
                            AsyncImage(url: afterPhoto.fullURL) { phase in
                                if let img = phase.image {
                                    img.resizable().scaledToFill().frame(width: width, height: height).clipped()
                                } else {
                                    Rectangle().fill(FitTheme.surfaceRaised)
                                }
                            }

                            // Imagem ANTES cortada pela posição
                            AsyncImage(url: beforePhoto.fullURL) { phase in
                                if let img = phase.image {
                                    img.resizable().scaledToFill().frame(width: width, height: height).clipped()
                                } else {
                                    Rectangle().fill(FitTheme.surfaceRaised)
                                }
                            }
                            .frame(width: width * sliderPosition, height: height, alignment: .leading)
                            .clipped()

                            // Linha Divisória
                            Rectangle()
                                .fill(.white)
                                .frame(width: 3, height: height)
                                .offset(x: width * sliderPosition - 1.5)
                                .shadow(radius: 4)

                            // Ícone central do Slider
                            Circle()
                                .fill(.white)
                                .frame(width: 36, height: 36)
                                .overlay(Image(systemName: "arrow.left.and.right").font(.caption.bold()).foregroundStyle(.black))
                                .offset(x: width * sliderPosition - 18, y: height / 2 - 18)
                                .shadow(radius: 5)
                        }
                        .clipShape(RoundedRectangle(cornerRadius: 20))
                        .gesture(
                            DragGesture()
                                .onChanged { value in
                                    let newPos = value.location.x / width
                                    sliderPosition = min(max(newPos, 0.05), 0.95)
                                }
                        )
                    }
                    .frame(maxHeight: 460)
                    .padding(.horizontal)

                    Text("Arraste para os lados para visualizar a transformação.")
                        .font(.caption)
                        .foregroundStyle(FitTheme.secondaryText)
                }
                Spacer()
            }
            .fitScreen()
            .navigationTitle("Antes & Depois")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fechar") { dismiss() }
                }
            }
            .onAppear {
                if photos.count >= 2 {
                    beforeIndex = 0
                    afterIndex = photos.count - 1
                }
            }
        }
    }
}

private extension Array {
    subscript(safe index: Index) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
