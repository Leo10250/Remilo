import AlarmKit
import AVFAudio
import Foundation
import UIKit

enum RemiloIOSSound {
    static let resourceName = "remilo_alarm.wav"
}

extension Notification.Name {
    static let remiloIOSSoundPreviewChanged = Notification.Name("remilo.ios.sound-preview.changed")
}

@MainActor
final class RemiloIOSSoundPreview {
    static let shared = RemiloIOSSoundPreview()

    private struct Request {
        let id: String
        let sound: String
        var state: String
        var reason: String?

        var snapshot: [String: Any] {
            var result: [String: Any] = ["requestId": id, "sound": sound, "state": state]
            if state == "Playing" { result["actualSound"] = sound }
            if let reason { result["reason"] = reason }
            return result
        }
    }

    private var request: Request?
    private var player: AVAudioPlayer?
    private var cutoff: Task<Void, Never>?
    private var alarmWatch: Task<Void, Never>?
    private var observations: [NSObjectProtocol] = []

    var snapshot: [String: Any]? { request?.snapshot }

    private init() {
        let center = NotificationCenter.default
        observations = [
            center.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) {
                [weak self] _ in
                Task { @MainActor in self?.finish(state: "Interrupted", reason: "Background") }
            },
            center.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) {
                [weak self] notification in
                let type = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt
                if type == AVAudioSession.InterruptionType.began.rawValue {
                    Task { @MainActor in self?.finish(state: "Interrupted", reason: "Interrupted") }
                }
            },
        ]
    }

    func start(_ sound: String, requestID: String) -> [String: Any] {
        if let request, request.id == requestID { return request.snapshot }
        finish(state: "Interrupted", reason: "Replaced")

        let activeAlarm = (try? AlarmManager.shared.alarms.contains { $0.state == .alerting }) == true
        guard !activeAlarm, UIApplication.shared.applicationState == .active,
              sound == "remilo", let url = Bundle.main.url(forResource: "remilo_alarm", withExtension: "wav") else {
            return fail(sound: sound, id: requestID, reason: activeAlarm ? "AlarmActive" : "Failed")
        }
        do {
            // Preview audio mixes with other audio. The OS continues to own alarm playback.
            let audio = try AVAudioPlayer(contentsOf: url)
            try AVAudioSession.sharedInstance().setCategory(.ambient)
            audio.numberOfLoops = -1
            guard audio.play() else { return fail(sound: sound, id: requestID, reason: "Failed") }
            player = audio
            let playing = Request(id: requestID, sound: sound, state: "Playing")
            request = playing
            publish()
            cutoff = Task { [weak self] in
                do { try await Task.sleep(for: .seconds(5)) } catch { return }
                guard self?.request?.id == requestID else { return }
                self?.finish(state: "Ended", reason: "TimedOut")
            }
            alarmWatch = Task { [weak self] in
                for await alarms in AlarmManager.shared.alarmUpdates {
                    guard !Task.isCancelled, self?.request?.id == requestID else { return }
                    if alarms.contains(where: { $0.state == .alerting }) {
                        self?.finish(state: "Interrupted", reason: "AlarmActive")
                        return
                    }
                }
            }
            return playing.snapshot
        } catch {
            return fail(sound: sound, id: requestID, reason: "Failed")
        }
    }

    func stop(requestID: String) -> [String: Any]? {
        if request?.id == requestID { finish(state: "Ended", reason: "Stopped") }
        return snapshot
    }

    private func fail(sound: String, id: String, reason: String) -> [String: Any] {
        let failed = Request(id: id, sound: sound, state: "Failed", reason: reason)
        request = failed
        publish()
        return failed.snapshot
    }

    private func finish(state: String, reason: String) {
        guard request?.state == "Playing" else { return }
        cutoff?.cancel()
        cutoff = nil
        alarmWatch?.cancel()
        alarmWatch = nil
        player?.stop()
        player = nil
        request?.state = state
        request?.reason = reason
        publish()
    }

    private func publish() {
        NotificationCenter.default.post(name: .remiloIOSSoundPreviewChanged, object: snapshot)
    }
}
