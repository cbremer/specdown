import Foundation
import ImageIO
import CoreGraphics

@main
struct DocumentResourcesTests {
    static func main() throws {
        let fm = FileManager.default
        let root = fm.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try fm.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? fm.removeItem(at: root) }
        // A real 1x1 PNG, never a document from the owner's stores.
        let png = Data(base64Encoded: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")!
        try png.write(to: root.appendingPathComponent("diagram.png"))
        try png.write(to: root.appendingPathComponent("my diagram.png"))
        try fm.createSymbolicLink(at: root.appendingPathComponent("escape.png"), withDestinationURL: root.appendingPathComponent("diagram.png"))
        func makePNG(width: Int, height: Int, name: String) throws {
            let rgba = Data(repeating: 0, count: width * height * 4)
            let provider = CGDataProvider(data: rgba as CFData)!
            let image = CGImage(width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: width * 4,
                space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
                provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent)!
            let target = root.appendingPathComponent(name)
            let destination = CGImageDestinationCreateWithURL(target as CFURL, "public.png" as CFString, 1, nil)!
            CGImageDestinationAddImage(destination, image, nil)
            precondition(CGImageDestinationFinalize(destination))
        }
        try makePNG(width: 8193, height: 1, name: "too-wide.png")
        try makePNG(width: 4000, height: 4000, name: "large.png")
        let resources = DocumentResources()
        resources.activate(token: "view-a", documentURL: root.appendingPathComponent("a.md"))
        do { _ = try resources.read(token: "view-a", relative: "diagram.png"); preconditionFailure("No folder grant required") } catch { }
        resources.grant(root: root, token: "view-a")
        let result = try resources.read(token: "view-a", relative: "./diagram.png")
        precondition(result.data == png && result.mime == "image/png")
        let spaced = try resources.read(token: "view-a", relative: "my%20diagram.png")
        precondition(spaced.data == png)
        for path in ["../diagram.png", "%2e%2e/diagram.png", "%252e%252e/diagram.png", "/diagram.png", "escape.png", "https://example.test/a.png", "a\\b.png", "diagram.png%00"] {
            do { _ = try resources.read(token: "view-a", relative: path); preconditionFailure("Accepted escape: \(path)") } catch { }
        }
        resources.activate(token: "view-b", documentURL: root.appendingPathComponent("b.md"))
        do { _ = try resources.read(token: "view-a", relative: "diagram.png"); preconditionFailure("Old view loaded") } catch { }
        resources.grant(root: root, token: "view-b")
        try Data("not an image".utf8).write(to: root.appendingPathComponent("fake.png"))
        do { _ = try resources.read(token: "view-b", relative: "fake.png"); preconditionFailure("Invalid image accepted") } catch { }
        resources.activate(token: "dimensions", documentURL: root.appendingPathComponent("a.md"))
        resources.grant(root: root, token: "dimensions")
        do { _ = try resources.read(token: "dimensions", relative: "too-wide.png"); preconditionFailure("Decoded edge limit bypassed") } catch { }
        _ = try resources.read(token: "dimensions", relative: "large.png")
        _ = try resources.read(token: "dimensions", relative: "large.png")
        do { _ = try resources.read(token: "dimensions", relative: "large.png"); preconditionFailure("Aggregate decoded pixels bypassed") } catch { }
        let parent = root.appendingPathComponent("parent")
        let grantedFolder = parent.appendingPathComponent("folder")
        let outside = root.appendingPathComponent("outside")
        try fm.createDirectory(at: grantedFolder, withIntermediateDirectories: true)
        try fm.createDirectory(at: outside.appendingPathComponent("folder"), withIntermediateDirectories: true)
        try png.write(to: grantedFolder.appendingPathComponent("inside.png"))
        try png.write(to: outside.appendingPathComponent("folder/secret.png"))
        resources.activate(token: "pinned", documentURL: grantedFolder.appendingPathComponent("a.md"))
        precondition(resources.grant(root: grantedFolder, token: "pinned"))
        try fm.moveItem(at: parent, to: root.appendingPathComponent("renamed"))
        try fm.createSymbolicLink(at: parent, withDestinationURL: outside)
        let pinned = try resources.read(token: "pinned", relative: "inside.png")
        precondition(pinned.data == png, "Pinned grant followed replaced ancestor")
        do { _ = try resources.read(token: "pinned", relative: "secret.png"); preconditionFailure("Replaced ancestor escaped grant") } catch { }
        print("Document resources: explicit authority, bytes, actual decode, traversal, encoding, symlinks and generations passed")
    }
}
