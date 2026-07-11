import Foundation
import SwiftUI

struct APIAck: Decodable, Sendable {
    let success: Bool
    let error: String?
}

enum APIError: LocalizedError {
    case invalidResponse
    case server(String)
    case unauthenticated

    var errorDescription: String? {
        switch self {
        case .invalidResponse: "Não foi possível interpretar a resposta do servidor."
        case .server(let message): message
        case .unauthenticated: "Sua sessão expirou. Entre novamente."
        }
    }
}

struct APIClient: Sendable {
    static let live = APIClient(baseURL: URL(string: "https://projeto-adrian-fit.vercel.app")!)

    let baseURL: URL
    private let session: URLSession
    private let decoder: JSONDecoder

    init(baseURL: URL) {
        self.baseURL = baseURL
        let configuration = URLSessionConfiguration.default
        configuration.httpCookieStorage = .shared
        configuration.httpShouldSetCookies = true
        configuration.requestCachePolicy = .reloadRevalidatingCacheData
        session = URLSession(configuration: configuration)
        decoder = JSONDecoder()
    }

    func signIn(email: String, password: String) async throws -> AppUser {
        struct CSRF: Decodable { let csrfToken: String }
        let csrf: CSRF = try await raw(path: "/api/auth/csrf")

        var request = URLRequest(url: url(for: "/api/auth/callback/credentials"))
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        let fields = [
            "csrfToken": csrf.csrfToken,
            "email": email,
            "password": password,
            "callbackUrl": baseURL.absoluteString,
            "json": "true"
        ]
        request.httpBody = fields
            .map { key, value in "\(key.urlEncoded)=\(value.urlEncoded)" }
            .joined(separator: "&")
            .data(using: .utf8)
        _ = try await perform(request)

        guard let user = try await currentSession().user else { throw APIError.server("E-mail ou senha inválidos.") }
        return user
    }

    func currentSession() async throws -> SessionResponse {
        try await raw(path: "/api/auth/session")
    }

    func signOut() async {
        HTTPCookieStorage.shared.cookies?.forEach(HTTPCookieStorage.shared.deleteCookie)
        URLCache.shared.removeAllCachedResponses()
    }

    func get<Value: Decodable & Sendable>(_ path: String, as type: Value.Type = Value.self) async throws -> Value {
        let envelope: APIEnvelope<Value> = try await raw(path: path)
        guard envelope.success else { throw APIError.server(envelope.error ?? "Erro ao carregar os dados.") }
        guard let data = envelope.data else { throw APIError.server(envelope.error ?? "Nenhum dado encontrado.") }
        return data
    }

    func post<Body: Encodable, Value: Decodable & Sendable>(_ path: String, body: Body, as type: Value.Type = Value.self) async throws -> Value {
        try await send(path: path, method: "POST", body: body)
    }

    func put<Body: Encodable, Value: Decodable & Sendable>(_ path: String, body: Body, as type: Value.Type = Value.self) async throws -> Value {
        try await send(path: path, method: "PUT", body: body)
    }

    /// PUT para rotas que respondem apenas { success, message } sem data.
    func putAck<Body: Encodable>(_ path: String, body: Body) async throws {
        try await sendAck(path: path, method: "PUT", body: body)
    }

    /// PATCH para rotas que respondem apenas { success, message } sem data.
    func patchAck<Body: Encodable>(_ path: String, body: Body) async throws {
        try await sendAck(path: path, method: "PATCH", body: body)
    }

    private func sendAck<Body: Encodable>(path: String, method: String, body: Body) async throws {
        var request = URLRequest(url: url(for: path))
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        let data = try await perform(request)
        let ack = try decoder.decode(APIAck.self, from: data)
        guard ack.success else { throw APIError.server(ack.error ?? "Não foi possível concluir a ação.") }
    }

    func delete(_ path: String) async throws {
        var request = URLRequest(url: url(for: path))
        request.httpMethod = "DELETE"
        _ = try await perform(request)
    }

    /// Para rotas que retornam o objeto direto, sem envelope { success, data }.
    func getRaw<Value: Decodable & Sendable>(_ path: String, as type: Value.Type = Value.self) async throws -> Value {
        try await raw(path: path)
    }

    /// POST para rotas que retornam o objeto direto, sem envelope.
    func postRaw<Body: Encodable, Value: Decodable & Sendable>(_ path: String, body: Body, as type: Value.Type = Value.self) async throws -> Value {
        try await sendRaw(path: path, method: "POST", body: body)
    }

    /// PUT para rotas que retornam o objeto direto, sem envelope.
    func putRaw<Body: Encodable, Value: Decodable & Sendable>(_ path: String, body: Body, as type: Value.Type = Value.self) async throws -> Value {
        try await sendRaw(path: path, method: "PUT", body: body)
    }

    private func sendRaw<Body: Encodable, Value: Decodable & Sendable>(path: String, method: String, body: Body) async throws -> Value {
        var request = URLRequest(url: url(for: path))
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        let data = try await perform(request)
        return try decoder.decode(Value.self, from: data)
    }

    private func send<Body: Encodable, Value: Decodable & Sendable>(path: String, method: String, body: Body) async throws -> Value {
        var request = URLRequest(url: url(for: path))
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        let data = try await perform(request)
        let envelope = try decoder.decode(APIEnvelope<Value>.self, from: data)
        guard envelope.success, let value = envelope.data else { throw APIError.server(envelope.error ?? "Não foi possível concluir a ação.") }
        return value
    }

    private func url(for path: String) -> URL {
        // Preserva query strings (ex.: /api/exercises?search=x), que
        // appending(path:) codificaria como parte do caminho.
        URL(string: path, relativeTo: baseURL) ?? baseURL.appending(path: path)
    }

    private func raw<Value: Decodable>(path: String) async throws -> Value {
        let data = try await perform(URLRequest(url: url(for: path)))
        return try decoder.decode(Value.self, from: data)
    }

    private func perform(_ request: URLRequest) async throws -> Data {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        if http.statusCode == 401 { throw APIError.unauthenticated }
        guard (200..<400).contains(http.statusCode) else {
            let message = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String
            throw APIError.server(message ?? "Erro do servidor (\(http.statusCode)).")
        }
        return data
    }
}

private struct APIClientKey: EnvironmentKey {
    static let defaultValue = APIClient.live
}

extension EnvironmentValues {
    var apiClient: APIClient {
        get { self[APIClientKey.self] }
        set { self[APIClientKey.self] = newValue }
    }
}

private extension String {
    var urlEncoded: String { addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? self }
}
