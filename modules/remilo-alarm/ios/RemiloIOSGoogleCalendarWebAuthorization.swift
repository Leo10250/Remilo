#if os(iOS)
import AuthenticationServices
import Foundation
import UIKit

/// Call only from a reviewed, explicit foreground action. The caller owns the
/// serialized account/revision capture and acceptance before storing any binding.
@MainActor
final class RemiloIOSGoogleCalendarWebAuthorization {
    typealias Failure = RemiloIOSGoogleCalendarFailure

    private struct Presentation {
        let id: UUID
        let session: ASWebAuthenticationSession
        let anchor: Anchor
        let completion: CheckedContinuation<URL, Error>
    }

    private let http = RemiloIOSGoogleCalendarHTTP()
    private var presenting: Presentation?
    private var authorizing = false

    func authorizeFromUserAction(presentingWindow: UIWindow, purpose: RemiloIOSGoogleCalendarPurpose,
                                 expectedSubject: String?) async throws -> RemiloIOSGoogleCalendarAccess {
        guard let configuration = RemiloIOSGoogleCalendarConfiguration() else { throw Failure.invalidConfiguration }
        guard !authorizing, UIApplication.shared.isProtectedDataAvailable,
              presentingWindow.windowScene?.activationState == .foregroundActive else { throw Failure.needsAccess }
        authorizing = true
        defer { authorizing = false }
        let attempt = RemiloIOSGoogleCalendarOAuth(configuration: configuration, purpose: purpose)
        let browser = try attempt.browserURL()
        let callback = try await present(browser, scheme: configuration.redirectScheme, window: presentingWindow)
        let budget = RemiloIOSGoogleCalendarHTTP.Budget(duration: .seconds(60))
        let grant = try await attempt.exchange(callback: callback, http: http, budget: budget)
        return try await RemiloIOSGoogleCalendarAuthorization(http: http).verify(
            grant, configuration: configuration, expectedSubject: expectedSubject, purpose: purpose, budget: budget
        )
    }

    private func present(_ browser: URL, scheme: String, window: UIWindow) async throws -> URL {
        let id = UUID()
        return try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { completion in
                guard !Task.isCancelled else { completion.resume(throwing: Failure.cancelled); return }
                let anchor = Anchor(window: window)
                let session = ASWebAuthenticationSession(url: browser, callbackURLScheme: scheme) { url, error in
                    Task { @MainActor in
                        if let url, error == nil { self.finish(id, .success(url)) }
                        else if (error as? ASWebAuthenticationSessionError)?.code == .canceledLogin {
                            self.finish(id, .failure(Failure.cancelled))
                        } else { self.finish(id, .failure(Failure.auth)) }
                    }
                }
                session.presentationContextProvider = anchor
                session.prefersEphemeralWebBrowserSession = true
                presenting = Presentation(id: id, session: session, anchor: anchor, completion: completion)
                if !session.start() { finish(id, .failure(Failure.auth)) }
            }
        } onCancel: {
            Task { @MainActor in
                guard let presenting = self.presenting, presenting.id == id else { return }
                presenting.session.cancel()
                self.finish(id, .failure(Failure.cancelled))
            }
        }
    }

    private func finish(_ id: UUID, _ result: Result<URL, Error>) {
        guard let presenting, presenting.id == id else { return }
        self.presenting = nil
        presenting.completion.resume(with: result)
    }

    @MainActor
    private final class Anchor: NSObject, ASWebAuthenticationPresentationContextProviding {
        let window: UIWindow

        init(window: UIWindow) { self.window = window }

        func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor { window }
    }
}
#endif
