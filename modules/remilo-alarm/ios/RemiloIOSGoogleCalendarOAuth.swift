import CryptoKit
import Foundation

/// Google's native authorization-code protocol with S256 PKCE. This requests
/// online access and retains neither a refresh token nor an ID token.
struct RemiloIOSGoogleCalendarOAuth: Sendable, CustomDebugStringConvertible, CustomStringConvertible {
    typealias HTTP = RemiloIOSGoogleCalendarHTTP
    typealias Failure = RemiloIOSGoogleCalendarFailure

    private let configuration: RemiloIOSGoogleCalendarConfiguration
    private let purpose: RemiloIOSGoogleCalendarPurpose
    private let verifier: String
    private let state: String
    private static let redirectPath = "/oauth2callback"

    init(configuration: RemiloIOSGoogleCalendarConfiguration, purpose: RemiloIOSGoogleCalendarPurpose) {
        self.configuration = configuration
        self.purpose = purpose
        verifier = Self.random()
        state = Self.random()
    }

    var description: String { "Google Calendar authorization attempt" }
    var debugDescription: String { description }

    private var redirectURI: String { configuration.redirectScheme + ":" + Self.redirectPath }

    func browserURL() throws -> URL {
        let challenge = Self.base64URL(Data(SHA256.hash(data: Data(verifier.utf8))))
        return try HTTP.url(host: "accounts.google.com", path: ["o", "oauth2", "v2", "auth"], query: [
            .init("client_id", configuration.clientID), .init("redirect_uri", redirectURI), .init("response_type", "code"),
            .init("scope", purpose.required.sorted().joined(separator: " ")), .init("state", state),
            .init("code_challenge", challenge), .init("code_challenge_method", "S256"),
            .init("access_type", "online"), .init("prompt", "select_account"),
        ])
    }

    func exchange(callback: URL, http: HTTP, budget: HTTP.Budget, now: @Sendable () -> Date = { Date() })
        async throws -> RemiloIOSGoogleCalendarGrant {
        let code = try authorizationCode(callback)
        let url = try HTTP.url(host: "oauth2.googleapis.com", path: ["token"])
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        let form = try HTTP.form([
            .init("code", code), .init("client_id", configuration.clientID), .init("redirect_uri", redirectURI),
            .init("grant_type", "authorization_code"), .init("code_verifier", verifier),
        ])
        request.httpBody = Data(form.utf8)
        let response = try await http.request(request, budget: budget, limit: 32_768)
        switch response.status {
        case 200: break
        case 400, 401, 403: throw Failure.auth
        case 429, 500...599: throw Failure.retry
        default: throw Failure.apiError
        }
        guard let reply = try? JSONDecoder().decode(TokenResponse.self, from: response.body),
              reply.type.caseInsensitiveCompare("Bearer") == .orderedSame, (1...86_400).contains(reply.lifetime) else {
            throw Failure.invalidResponse
        }
        let scopes = Set(reply.scope.split(whereSeparator: \.isWhitespace).map(String.init))
        try purpose.verify(scopes)
        return try RemiloIOSGoogleCalendarGrant(token: reply.token, scopes: scopes,
                                               expiresAt: now().addingTimeInterval(TimeInterval(reply.lifetime)))
    }

    private func authorizationCode(_ url: URL) throws -> String {
        guard url.absoluteString.utf8.count <= 32_768,
              let callback = URLComponents(url: url, resolvingAgainstBaseURL: false),
              callback.scheme == configuration.redirectScheme, callback.host == nil, callback.port == nil,
              callback.user == nil, callback.password == nil, callback.fragment == nil,
              callback.percentEncodedPath == Self.redirectPath, let fields = callback.queryItems else { throw Failure.auth }
        let states = fields.filter { $0.name == "state" }
        let codes = fields.filter { $0.name == "code" }
        let errors = fields.filter { $0.name == "error" }
        guard states.count == 1, states.first?.value == state else { throw Failure.auth }
        if codes.isEmpty, errors.count == 1, errors.first?.value == "access_denied" { throw Failure.cancelled }
        guard errors.isEmpty, codes.count == 1, let code = codes.first?.value,
              (1...16_384).contains(code.utf8.count), code.utf8.allSatisfy({ (33...126).contains($0) }) else {
            throw Failure.auth
        }
        return code
    }

    private static func random() -> String {
        SymmetricKey(size: .bits256).withUnsafeBytes { base64URL(Data($0)) }
    }

    private static func base64URL(_ bytes: Data) -> String {
        bytes.base64EncodedString().replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }

    private struct TokenResponse: Decodable {
        let token: String
        let type: String
        let lifetime: Int
        let scope: String

        private enum CodingKeys: String, CodingKey {
            case token = "access_token"
            case type = "token_type"
            case lifetime = "expires_in"
            case scope
        }
    }
}
