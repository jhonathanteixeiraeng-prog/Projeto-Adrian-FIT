import SwiftUI
import PhotosUI
import UIKit

struct ProgressPhotosView: View {
    @State private var selectedItem: PhotosPickerItem?
    @State private var photos: [ProgressPhoto] = []
    @State private var error: String?

    private let columns = [GridItem(.adaptive(minimum: 135), spacing: 12)]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                SurfaceCard {
                    VStack(alignment: .leading, spacing: 10) {
                        Label("LINHA DO TEMPO VISUAL", systemImage: "camera.fill")
                            .font(.caption.bold()).foregroundStyle(FitTheme.orange)
                        Text("Compare sua evolução com consistência")
                            .font(.title3.bold())
                        Text("Use luz, distância e posição semelhantes. As fotos ficam armazenadas somente neste aparelho.")
                            .font(.subheadline).foregroundStyle(FitTheme.secondaryText)
                        PhotosPicker(selection: $selectedItem, matching: .images) {
                            Label("ADICIONAR FOTO", systemImage: "plus.circle.fill")
                                .font(.subheadline.bold()).frame(maxWidth: .infinity).padding(.vertical, 13)
                        }
                        .buttonStyle(.plain).foregroundStyle(.white)
                        .background(FitTheme.orange, in: RoundedRectangle(cornerRadius: 15))
                    }
                }

                if photos.isEmpty {
                    ContentUnavailableView("Nenhuma foto ainda", systemImage: "photo.on.rectangle.angled", description: Text("Adicione sua primeira foto para criar uma comparação visual."))
                        .frame(maxWidth: .infinity).padding(.top, 30)
                } else {
                    LazyVGrid(columns: columns, spacing: 12) {
                        ForEach(photos) { photo in
                            VStack(alignment: .leading, spacing: 7) {
                                if let image = UIImage(contentsOfFile: photo.url.path) {
                                    Image(uiImage: image).resizable().scaledToFill()
                                        .frame(height: 190).frame(maxWidth: .infinity).clipped()
                                        .clipShape(RoundedRectangle(cornerRadius: 18))
                                }
                                Text(photo.date.formatted(date: .abbreviated, time: .omitted))
                                    .font(.caption.weight(.semibold)).foregroundStyle(FitTheme.secondaryText)
                            }
                            .contextMenu {
                                Button("Excluir foto", systemImage: "trash", role: .destructive) { remove(photo) }
                            }
                        }
                    }
                }
                if let error { Text(error).font(.caption).foregroundStyle(.red) }
            }.padding(20).padding(.bottom, 80)
        }
        .fitScreen().navigationTitle("Fotos de evolução").navigationBarTitleDisplayMode(.inline)
        .task { loadPhotos() }
        .onChange(of: selectedItem) { _, item in Task { await importPhoto(item) } }
    }

    private func importPhoto(_ item: PhotosPickerItem?) async {
        guard let item, let data = try? await item.loadTransferable(type: Data.self),
              let image = UIImage(data: data), let jpeg = image.jpegData(compressionQuality: 0.88) else {
            if item != nil { error = "Não foi possível importar esta foto." }
            return
        }
        do {
            let directory = try photoDirectory()
            let url = directory.appendingPathComponent("\(Date.now.timeIntervalSince1970)-\(UUID().uuidString).jpg")
            try jpeg.write(to: url, options: .atomic)
            error = nil; selectedItem = nil; loadPhotos()
        } catch { self.error = "Não foi possível salvar a foto neste aparelho." }
    }

    private func photoDirectory() throws -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let directory = base.appendingPathComponent("ProgressPhotos", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }

    private func loadPhotos() {
        guard let directory = try? photoDirectory(),
              let urls = try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: [.creationDateKey]) else { return }
        photos = urls.compactMap { url in
            let values = try? url.resourceValues(forKeys: [.creationDateKey])
            return ProgressPhoto(url: url, date: values?.creationDate ?? .distantPast)
        }.sorted { $0.date > $1.date }
    }

    private func remove(_ photo: ProgressPhoto) {
        try? FileManager.default.removeItem(at: photo.url)
        loadPhotos()
    }
}

private struct ProgressPhoto: Identifiable {
    let url: URL
    let date: Date
    var id: URL { url }
}
