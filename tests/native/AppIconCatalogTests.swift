import Foundation

@main
struct AppIconCatalogTests {
    static func main() {
        let artworks = ["original", "flat", "glass", "ceramic", "metallic", "layered", "minimal", "light"]
        for (primary, defaultChoice) in [("AppIcon", "original"), ("AppIcon-flat", "flat"), ("AppIcon-light", "light")] {
            var alternateNames = Set<String>()
            var primaryCount = 0
            for artwork in artworks {
                let actual = AppIconCatalog.alternateName(for: artwork, primary: primary)
                if artwork == defaultChoice {
                    precondition(actual == nil, "Default must use UIKit's nil sentinel")
                    primaryCount += 1
                } else {
                    let expected = artwork == "original" ? "AppIcon" : "AppIcon-\(artwork)"
                    precondition(actual == expected, "An artwork resolved to the wrong catalog")
                    precondition(alternateNames.insert(actual!).inserted, "Duplicate alternate mapping")
                }
            }
            precondition(primaryCount == 1 && alternateNames.count == 7)
            precondition(!alternateNames.contains(primary))
            precondition(AppIconCatalog.defaultTitle(primary: primary) == defaultChoice.capitalized)
        }
        print("All 24 channel/artwork mappings and default reset titles passed.")
    }
}
