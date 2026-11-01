import Foundation

/// Maps artwork choices to UIKit's primary-icon sentinel for each installation.
/// The same eight artworks are available in every channel; no image is changed.
enum AppIconCatalog {
    static let choices = ["original", "flat", "glass", "ceramic", "metallic", "layered", "minimal", "light"]

    static var primaryName: String {
        Bundle.main.object(forInfoDictionaryKey: "SpecDownPrimaryIcon") as? String ?? "AppIcon"
    }

    static func name(for choice: String) -> String {
        choice == "original" ? "AppIcon" : "AppIcon-\(choice)"
    }

    static func alternateName(for choice: String, primary: String) -> String? {
        let catalog = name(for: choice)
        return catalog == primary ? nil : catalog
    }

    static func defaultTitle(primary: String) -> String {
        (choices.first { name(for: $0) == primary } ?? "original").capitalized
    }
}
