import Foundation

enum RemiloIOSGoogleCalendarFailure: String, Error {
    case invalidConfiguration = "INVALID_CONFIGURATION"
    case invalidInput = "INVALID_INPUT"
    case needsAccess = "NEEDS_ACCESS"
    case accountChanged = "ACCOUNT_CHANGED"
    case staleConnection = "STALE_CONNECTION"
    case operationReused = "OPERATION_REUSED"
    case revocationInProgress = "REVOCATION_IN_PROGRESS"
    case discoveryLimit = "DISCOVERY_LIMIT"
    case invalidRange = "INVALID_RANGE"
    case staleCursor = "STALE_CURSOR"
    case cancelled = "CANCELLED"
    case budget = "BUDGET"
    case network = "NETWORK"
    case invalidResponse = "INVALID_RESPONSE"
    case responseLimit = "RESPONSE_LIMIT"
    case badRequest = "BAD_REQUEST"
    case auth = "AUTH"
    case retry = "RETRY"
    case forbidden = "FORBIDDEN"
    case notOwner = "NOT_OWNER"
    case notFound = "NOT_FOUND"
    case syncTokenExpired = "SYNC_TOKEN_EXPIRED"
    case remoteUnavailable = "REMOTE_UNAVAILABLE"
    case apiError = "API_ERROR"
}

/// No credential, request URL, provider response, or error details cross the bridge.
struct RemiloIOSGoogleCalendarHTTP: Sendable {
    struct Response: Sendable {
        let status: Int
        let body: Data
    }

    struct Parameter: Codable, Equatable, Sendable {
        let name: String
        let value: String

        init(_ name: String, _ value: String) {
            self.name = name
            self.value = value
        }
    }

    struct Budget: Sendable {
        fileprivate let deadline: ContinuousClock.Instant

        init(duration: Duration = .seconds(120)) {
            deadline = ContinuousClock.now.advanced(by: duration)
        }
    }

    typealias Send = @Sendable (URLRequest, Budget, Int) async throws -> Response
    private let send: Send

    init(send: Send? = nil) { self.send = send ?? Self.live }

    func request(_ request: URLRequest, budget: Budget, limit: Int = 2_000_000) async throws -> Response {
        guard let url = request.url, url.scheme == "https", let host = url.host,
              Self.hosts.contains(host), url.port == nil, url.user == nil, url.password == nil,
              url.fragment == nil else {
            throw RemiloIOSGoogleCalendarFailure.invalidInput
        }
        guard !Task.isCancelled else { throw RemiloIOSGoogleCalendarFailure.cancelled }
        guard ContinuousClock.now < budget.deadline else { throw RemiloIOSGoogleCalendarFailure.budget }
        do {
            let result = try await send(request, budget, limit)
            guard !Task.isCancelled else { throw RemiloIOSGoogleCalendarFailure.cancelled }
            guard ContinuousClock.now < budget.deadline else { throw RemiloIOSGoogleCalendarFailure.budget }
            let maximum = (200..<300).contains(result.status) ? limit : 16_384
            guard result.body.count <= maximum else {
                throw RemiloIOSGoogleCalendarFailure.responseLimit
            }
            return result
        } catch let failure as RemiloIOSGoogleCalendarFailure {
            throw failure
        } catch {
            throw Task.isCancelled || error is CancellationError
                ? RemiloIOSGoogleCalendarFailure.cancelled : .network
        }
    }

    static func url(host: String, path: [String], query: [Parameter] = []) throws -> URL {
        var parts = URLComponents()
        parts.scheme = "https"
        parts.host = host
        parts.percentEncodedPath = "/" + (try path.map(encode)).joined(separator: "/")
        if !query.isEmpty { parts.percentEncodedQuery = try form(query) }
        guard let url = parts.url else { throw RemiloIOSGoogleCalendarFailure.invalidInput }
        return url
    }

    static func form(_ values: [Parameter]) throws -> String {
        try values.map { try "\(encode($0.name))=\(encode($0.value))" }.joined(separator: "&")
    }

    private static func encode(_ value: String) throws -> String {
        let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~")
        guard value != ".", value != "..", let encoded = value.addingPercentEncoding(withAllowedCharacters: allowed) else {
            throw RemiloIOSGoogleCalendarFailure.invalidInput
        }
        return encoded
    }

    private static let hosts: Set<String> = ["www.googleapis.com", "openidconnect.googleapis.com", "oauth2.googleapis.com"]

    private static let session: URLSession = {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.urlCache = nil
        configuration.httpCookieStorage = nil
        configuration.httpShouldSetCookies = false
        configuration.urlCredentialStorage = nil
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        configuration.timeoutIntervalForRequest = 20
        configuration.timeoutIntervalForResource = 30
        return URLSession(configuration: configuration)
    }()

    private static let rejectRedirects = RejectRedirects()

    private static let live: Send = { request, budget, limit in
        try await withThrowingTaskGroup(of: Response.self) { group in
            group.addTask {
                let (stream, reply) = try await session.bytes(for: request, delegate: rejectRedirects)
                defer { stream.task.cancel() }
                guard let response = reply as? HTTPURLResponse else {
                    throw RemiloIOSGoogleCalendarFailure.invalidResponse
                }
                let success = (200..<300).contains(response.statusCode)
                let maxBytes = success ? limit : 16_384
                if response.expectedContentLength > Int64(maxBytes) {
                    if success { throw RemiloIOSGoogleCalendarFailure.responseLimit }
                    return Response(status: response.statusCode, body: Data())
                }
                var data = Data()
                for try await byte in stream {
                    if data.count == maxBytes {
                        if success { throw RemiloIOSGoogleCalendarFailure.responseLimit }
                        return Response(status: response.statusCode, body: Data())
                    }
                    data.append(byte)
                }
                return Response(status: response.statusCode, body: data)
            }
            group.addTask {
                try await ContinuousClock().sleep(until: budget.deadline)
                throw RemiloIOSGoogleCalendarFailure.budget
            }
            defer { group.cancelAll() }
            guard let result = try await group.next() else { throw RemiloIOSGoogleCalendarFailure.cancelled }
            return result
        }
    }

    private final class RejectRedirects: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
        func urlSession(_ session: URLSession, task: URLSessionTask,
                        willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest,
                        completionHandler: @escaping (URLRequest?) -> Void) {
            completionHandler(nil)
        }
    }
}
