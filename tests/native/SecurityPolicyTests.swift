import Foundation

@main
struct SecurityPolicyTests {
    static func main() throws {
        let manager = FileManager.default
        let temporary = manager.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? manager.removeItem(at: temporary) }
        let root = temporary.appendingPathComponent("dist")
        let sibling = temporary.appendingPathComponent("dist-private")
        try manager.createDirectory(at: root, withIntermediateDirectories: true)
        try manager.createDirectory(at: sibling, withIntermediateDirectories: true)
        let index = root.appendingPathComponent("index.html")
        let secret = sibling.appendingPathComponent("secret.md")
        try Data("viewer".utf8).write(to: index)
        try Data("outside the served bundle".utf8).write(to: secret)
        try manager.createSymbolicLink(at: root.appendingPathComponent("escape.md"), withDestinationURL: secret)
        try manager.createSymbolicLink(at: root.appendingPathComponent("internal.html"), withDestinationURL: index)

        func resolve(_ url: String) -> URL? {
            SpecDownSecurityPolicy.bundledFile(for: URL(string: url)!, root: root)
        }
        precondition(resolve("specdown://app/")?.path == index.path)
        precondition(resolve("specdown://app/index.html?v=1")?.path == index.path)
        precondition(resolve("specdown://app/internal.html")?.path == index.path)
        for request in [
            "specdown://app/../dist-private/secret.md",
            "specdown://app/%2e%2e/dist-private/secret.md",
            "specdown://app/escape.md",
            "specdown://other/index.html",
            "https://app/index.html",
            "specdown://user@app/index.html",
            "specdown://app:123/index.html",
            "specdown://app/%00index.html",
        ] {
            precondition(resolve(request) == nil, "Unexpectedly served \(request)")
        }

        let normal = try SpecDownSecurityPolicy.readDocument(at: index)
        precondition(String(data: normal, encoding: .utf8) == "viewer")
        let limit = SpecDownSecurityPolicy.maximumDocumentBytes
        let boundary = root.appendingPathComponent("boundary.md")
        try Data(repeating: 65, count: limit).write(to: boundary)
        let exact = try SpecDownSecurityPolicy.readDocument(at: boundary)
        precondition(exact.count == limit)
        let oversized = root.appendingPathComponent("oversized.md")
        _ = manager.createFile(atPath: oversized.path, contents: nil)
        let handle = try FileHandle(forWritingTo: oversized)
        try handle.truncate(atOffset: UInt64(limit + 1))
        try handle.close()
        do {
            _ = try SpecDownSecurityPolicy.readDocument(at: oversized)
            preconditionFailure("Oversized file was accepted")
        } catch SpecDownSecurityPolicy.FileError.tooLarge { }
        for unsupported in [root, URL(string: "https://example.invalid/document.md")!] {
            do {
                _ = try SpecDownSecurityPolicy.readDocument(at: unsupported)
                preconditionFailure("Non-local or non-regular file was accepted")
            } catch SpecDownSecurityPolicy.FileError.unsupportedFile { }
        }
        print("Native security policy passed: bundle traversal/host/symlink boundaries and bounded document reads")
    }
}
