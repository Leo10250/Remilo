import CoreFoundation
import Foundation

enum RemiloIOSTime {
  enum InvalidTime: Error { case input }

  static func timeZones(at milliseconds: Double) throws -> [[String: Any]] {
    let date = try instant(milliseconds)
    let names = Set(TimeZone.knownTimeZoneIdentifiers + ["UTC", TimeZone.current.identifier])
    let zones: [(id: String, offset: Int)] = names.compactMap { name in
      guard let zone = TimeZone(identifier: name) else { return nil }
      return (id: name, offset: zone.secondsFromGMT(for: date))
    }
    let sorted = zones.sorted { first, second in
      if first.offset == second.offset { return first.id < second.id }
      return first.offset < second.offset
    }
    return sorted.map { zone in
      ["id": zone.id, "label": zone.id.replacingOccurrences(of: "_", with: " "),
       "region": zone.id.split(separator: "/").first.map(String.init) ?? zone.id,
       "offsetSeconds": zone.offset]
    }
  }

  static func convert(_ input: [String: Any]) throws -> [String: Any] {
    let (id, zone) = try timeZone(input)
    var converted: [String: Any]
    switch (input["instantMs"], input["local"]) {
    case (let value as NSNumber, nil) where CFGetTypeID(value) != CFBooleanGetTypeID():
      converted = try result(instant(value.doubleValue), in: zone)
    case (nil, let local as String): converted = try resolve(local, in: zone)
    default: throw InvalidTime.input
    }
    converted["zoneId"] = id
    return converted
  }

  static func postpone(_ input: [String: Any]) throws -> [String: Any] {
    let (id, zone) = try timeZone(input)
    let reference = try instant(integer(input["referenceAtMs"], in: 0...8_640_000_000_000_000))
    _ = try result(reference, in: zone)
    var target: [String: Any]
    switch input["kind"] as? String {
    case "Relative":
      let minutes = try integer(input["minutes"], in: 1...1440)
      guard [15, 30, 60, 1440].contains(minutes) else { throw InvalidTime.input }
      target = try result(reference.addingTimeInterval(minutes * 60), in: zone)
    case "Tomorrow":
      let minutes = Int(try integer(input["minutesOfDay"], in: 0...1439))
      let today = calendar(in: zone).dateComponents([.year, .month, .day], from: reference)
      guard let midnight = calendar(in: utc).date(from: today) else { throw InvalidTime.input }
      let nominal = midnight.addingTimeInterval(86_400 + Double(minutes * 60))
      target = try resolve(civil(nominal, in: utc), in: zone)
    case "Custom":
      guard let local = input["local"] as? String else { throw InvalidTime.input }
      target = try resolve(local, in: zone)
    default: throw InvalidTime.input
    }
    guard let targetMs = target["instantMs"] as? Double,
          targetMs > reference.timeIntervalSince1970 * 1_000 else { throw InvalidTime.input }
    target["zoneId"] = id
    return target
  }

  private static let utc = TimeZone(secondsFromGMT: 0)!

  private static func timeZone(_ input: [String: Any]) throws -> (String, TimeZone) {
    guard let id = input["zoneId"] as? String, let zone = TimeZone(identifier: id) else {
      throw InvalidTime.input
    }
    return (id, zone)
  }

  private static func calendar(in zone: TimeZone) -> Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = zone
    return calendar
  }

  private static func instant(_ milliseconds: Double) throws -> Date {
    guard milliseconds.isFinite, abs(milliseconds) <= 8_640_000_000_000_000,
          milliseconds.rounded(.towardZero) == milliseconds else { throw InvalidTime.input }
    return Date(timeIntervalSince1970: milliseconds / 1_000)
  }

  private static func integer(_ value: Any?, in range: ClosedRange<Double>) throws -> Double {
    guard let boxed = value as? NSNumber, CFGetTypeID(boxed) != CFBooleanGetTypeID() else { throw InvalidTime.input }
    let number = boxed.doubleValue
    guard range.contains(number), number.rounded(.towardZero) == number else { throw InvalidTime.input }
    return number
  }

  private static func civil(_ date: Date, in zone: TimeZone) throws -> String {
    let parts = calendar(in: zone).dateComponents([.year, .month, .day, .hour, .minute, .second], from: date)
    guard let year = parts.year, (1970...9999).contains(year), let month = parts.month,
          let day = parts.day, let hour = parts.hour, let minute = parts.minute, let second = parts.second else {
      throw InvalidTime.input
    }
    return String(format: "%04d-%02d-%02dT%02d:%02d:%02d", year, month, day, hour, minute, second)
  }

  private static func nominalInstant(_ local: String) throws -> Date {
    let standard = local.count == 16 ? local + ":00" : local
    guard standard.range(of: "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}$", options: .regularExpression) != nil else {
      throw InvalidTime.input
    }
    let values = standard.split(whereSeparator: { "-T:".contains($0) }).compactMap { Int($0) }
    guard values.count == 6, let nominal = calendar(in: utc).date(from: DateComponents(
      year: values[0], month: values[1], day: values[2], hour: values[3], minute: values[4], second: values[5]
    )), try civil(nominal, in: utc) == standard else { throw InvalidTime.input }
    return nominal
  }

  private static func result(_ instant: Date, in zone: TimeZone, adjustment: String = "none") throws -> [String: Any] {
    ["zoneId": zone.identifier, "instantMs": (instant.timeIntervalSince1970 * 1_000).rounded(),
     "local": try civil(instant, in: zone), "offsetSeconds": zone.secondsFromGMT(for: instant),
     "adjustment": adjustment]
  }

  private static func resolve(_ local: String, in zone: TimeZone) throws -> [String: Any] {
    let resolved = try resolveNominal(nominalInstant(local), in: zone)
    return try result(resolved.instant, in: zone, adjustment: resolved.adjustment)
  }

  /// `nominal` encodes Gregorian civil components as if the zone were UTC.
  static func resolveNominal(_ nominal: Date, in zone: TimeZone) throws -> (instant: Date, adjustment: String) {
    // Try the offsets on both sides of nearby zone changes. An overlap has two valid
    // instants. A gap moves forward by the change in offset, retaining the minutes.
    let nearby = stride(from: -172_800, through: 172_800, by: 21_600)
    let offsets = Set(nearby.map { zone.secondsFromGMT(for: nominal.addingTimeInterval(Double($0))) })
    let candidates = offsets.map { nominal.addingTimeInterval(-Double($0)) }
    let nominalMs = (nominal.timeIntervalSince1970 * 1_000).rounded()
    let projections = candidates.map { candidate in
      let wall = candidate.addingTimeInterval(Double(zone.secondsFromGMT(for: candidate)))
      return (candidate, (wall.timeIntervalSince1970 * 1_000).rounded())
    }
    let valid = projections.filter { $0.1 == nominalMs }.map { $0.0 }.sorted()
    if let first = valid.first {
      return (first, valid.count > 1 ? "earlierFold" : "none")
    }
    let later = projections.filter { $0.1 > nominalMs }.min { $0.1 < $1.1 }
    guard let later else { throw InvalidTime.input }
    return (later.0, "gapForward")
  }
}
