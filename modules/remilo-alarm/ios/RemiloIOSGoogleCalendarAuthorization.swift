import Foundation

/// Optional native configuration. The signed bundle ID must be the one registered
/// in Google Cloud, including any suffix applied by the development signer.
struct RemiloIOSGoogleCalendarConfiguration: Equatable, Sendable {
    let clientID: String
    let redirectScheme: String

    init?(bundle: Bundle = .main) {
        let urlTypes = bundle.object(forInfoDictionaryKey: "CFBundleURLTypes") as? [[String: Any]] ?? []
        self.init(clientID: bundle.object(forInfoDictionaryKey: "GIDClientID") as? String,
                  registeredBundleID: bundle.object(forInfoDictionaryKey: "RemiloGoogleCalendarBundleIdentifier") as? String,
                  bundleID: bundle.bundleIdentifier,
                  urlSchemes: urlTypes.flatMap { $0["CFBundleURLSchemes"] as? [String] ?? [] })
    }

    init?(clientID: String?, registeredBundleID: String?, bundleID: String?, urlSchemes: [String]) {
        let suffix = ".apps.googleusercontent.com"
        guard let clientID, clientID.utf8.count <= 255, clientID.hasSuffix(suffix),
              let registeredBundleID, !registeredBundleID.isEmpty, registeredBundleID == bundleID else { return nil }
        let identifier = clientID.dropLast(suffix.count)
        guard !identifier.isEmpty, identifier.utf8.allSatisfy({
            (48...57).contains($0) || (65...90).contains($0) || (97...122).contains($0) || $0 == 45
        }) else { return nil }
        let redirectScheme = clientID.split(separator: ".").reversed().joined(separator: ".")
        guard urlSchemes.contains(redirectScheme) else { return nil }
        self.clientID = clientID
        self.redirectScheme = redirectScheme
    }
}

enum RemiloIOSGoogleCalendarPurpose: Equatable, Sendable {
    case ownedCalendars
    case writeOwnedEvents
    case createManagedCalendar

    private static let emailAlias = "https://www.googleapis.com/auth/userinfo.email"
    private static let readEvents = "https://www.googleapis.com/auth/calendar.events.owned.readonly"
    private static let writeEvents = "https://www.googleapis.com/auth/calendar.events.owned"
    private static let creation = "https://www.googleapis.com/auth/calendar.app.created"

    var required: Set<String> {
        let base: Set<String> = ["openid", "email", "https://www.googleapis.com/auth/calendar.calendarlist.readonly"]
        switch self {
        case .ownedCalendars: return base.union([Self.readEvents])
        case .writeOwnedEvents: return base.union([Self.writeEvents])
        case .createManagedCalendar: return base.union([Self.writeEvents, Self.creation])
        }
    }

    func verify(_ scopes: Set<String>) throws {
        var normalized = scopes
        if normalized.remove(Self.emailAlias) != nil { normalized.insert("email") }
        if normalized.contains(Self.writeEvents) { normalized.insert(Self.readEvents) }
        guard required.isSubset(of: normalized) else { throw RemiloIOSGoogleCalendarFailure.needsAccess }
    }
}

struct RemiloIOSGoogleCalendarGrant: Sendable, CustomDebugStringConvertible, CustomStringConvertible {
    private let token: String
    private let scopes: Set<String>
    private let expiresAt: Date

    init(token: String, scopes: Set<String>, expiresAt: Date) throws {
        // RFC 6750 b64token, without whitespace or control characters in the HTTP header.
        let tokenCharacters = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~+/=")
        guard (1...16_384).contains(token.utf8.count), token.unicodeScalars.allSatisfy(tokenCharacters.contains) else {
            throw RemiloIOSGoogleCalendarFailure.auth
        }
        self.token = token
        self.scopes = scopes
        self.expiresAt = expiresAt
    }

    var description: String { "Google Calendar access grant" }
    var debugDescription: String { description }

    func supports(_ purpose: RemiloIOSGoogleCalendarPurpose, now: Date) -> Bool {
        now < expiresAt && (try? purpose.verify(scopes)) != nil
    }

    func authorize(_ request: inout URLRequest, for purpose: RemiloIOSGoogleCalendarPurpose, now: Date) throws {
        try purpose.verify(scopes)
        guard now < expiresAt else { throw RemiloIOSGoogleCalendarFailure.needsAccess }
        request.setValue("Bearer " + token, forHTTPHeaderField: "Authorization")
    }

    func revocationRequest() throws -> URLRequest {
        typealias HTTP = RemiloIOSGoogleCalendarHTTP
        var request = URLRequest(url: try HTTP.url(host: "oauth2.googleapis.com", path: ["revoke"]))
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.httpBody = Data(try HTTP.form([.init("token", token)]).utf8)
        return request
    }
}

struct RemiloIOSGoogleCalendarAccount: Decodable, Sendable {
    let subject: String
    let email: String
    fileprivate let verifiedEmail: Bool

    private enum CodingKeys: String, CodingKey {
        case subject = "sub"
        case email
        case verifiedEmail = "email_verified"
    }
}

struct RemiloIOSGoogleCalendarAccess: Sendable {
    let account: RemiloIOSGoogleCalendarAccount
    let clientID: String
    private let grant: RemiloIOSGoogleCalendarGrant

    fileprivate init(account: RemiloIOSGoogleCalendarAccount, clientID: String, grant: RemiloIOSGoogleCalendarGrant) {
        self.account = account
        self.clientID = clientID
        self.grant = grant
    }

    func authorize(_ request: inout URLRequest, for purpose: RemiloIOSGoogleCalendarPurpose = .ownedCalendars, now: Date) throws {
        try grant.authorize(&request, for: purpose, now: now)
    }

    func supports(_ purpose: RemiloIOSGoogleCalendarPurpose, now: Date) -> Bool {
        grant.supports(purpose, now: now)
    }

    func revoke(using http: RemiloIOSGoogleCalendarHTTP) async throws {
        let response = try await http.request(grant.revocationRequest(), budget: .init(duration: .seconds(30)), limit: 4096)
        guard response.status == 200 else { throw RemiloIOSGoogleCalendarFailure.apiError }
    }
}

/// A native runner passes the subject already captured on the engine worker.
/// An unbound verification is only useful to a foreground connection review.
struct RemiloIOSGoogleCalendarAuthorization: Sendable {
    private let http: RemiloIOSGoogleCalendarHTTP
    private let now: @Sendable () -> Date

    init(http: RemiloIOSGoogleCalendarHTTP = .init(), now: @escaping @Sendable () -> Date = { Date() }) {
        self.http = http
        self.now = now
    }

    func verify(_ grant: RemiloIOSGoogleCalendarGrant, configuration: RemiloIOSGoogleCalendarConfiguration,
                expectedSubject: String?, purpose: RemiloIOSGoogleCalendarPurpose = .ownedCalendars,
                budget: RemiloIOSGoogleCalendarHTTP.Budget = .init()) async throws -> RemiloIOSGoogleCalendarAccess {
        let url = try RemiloIOSGoogleCalendarHTTP.url(host: "openidconnect.googleapis.com", path: ["v1", "userinfo"])
        var request = URLRequest(url: url)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        try grant.authorize(&request, for: purpose, now: now())
        let response = try await http.request(request, budget: budget, limit: 16_384)
        guard response.status == 200 else {
            switch response.status {
            case 401, 403: throw RemiloIOSGoogleCalendarFailure.auth
            case 429, 500...599: throw RemiloIOSGoogleCalendarFailure.retry
            default: throw RemiloIOSGoogleCalendarFailure.apiError
            }
        }
        guard let account = try? JSONDecoder().decode(RemiloIOSGoogleCalendarAccount.self, from: response.body),
              account.verifiedEmail, (1...255).contains(account.subject.utf8.count),
              account.subject == account.subject.trimmingCharacters(in: .whitespacesAndNewlines),
              (1...512).contains(account.email.utf8.count), account.email.contains("@") else {
            throw RemiloIOSGoogleCalendarFailure.auth
        }
        guard expectedSubject == nil || expectedSubject == account.subject else {
            throw RemiloIOSGoogleCalendarFailure.accountChanged
        }
        return RemiloIOSGoogleCalendarAccess(account: account, clientID: configuration.clientID, grant: grant)
    }
}
