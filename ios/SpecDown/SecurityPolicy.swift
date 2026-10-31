import Foundation

/// Shared by the native file picker and bundle scheme handler. Keep the document
/// limit aligned with markdown-viewer/src/core/document-limits.js.
enum SpecDownSecurityPolicy {
    static let maximumDocumentBytes = 8 * 1024 * 1024

    enum FileError: Error {
        case unsupportedFile
        case tooLarge
    }

    static func bundledFile(for request: URL, root: URL) -> URL? {
        guard request.scheme?.lowercased() == "specdown",
              request.host?.lowercased() == "app",
              request.user == nil, request.password == nil, request.port == nil,
              root.isFileURL else { return nil }

        var relativePath = request.path
        guard !relativePath.contains("\0") else { return nil }
        if relativePath.hasPrefix("/") { relativePath.removeFirst() }
        if relativePath.isEmpty { relativePath = "index.html" }

        let resolvedRoot = root.standardizedFileURL.resolvingSymlinksInPath()
        let file = resolvedRoot.appendingPathComponent(relativePath)
            .standardizedFileURL.resolvingSymlinksInPath()
        // A sibling such as dist-private is never inside dist. Resolve symlinks
        // before comparing; the signed app bundle is immutable at runtime.
        let prefix = resolvedRoot.path.hasSuffix("/") ? resolvedRoot.path : resolvedRoot.path + "/"
        guard file.path.hasPrefix(prefix) else { return nil }
        return file
    }

    static func readDocument(at url: URL) throws -> Data {
        guard url.isFileURL else { throw FileError.unsupportedFile }
        let values = try url.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey])
        guard values.isRegularFile == true else { throw FileError.unsupportedFile }
        guard let size = values.fileSize, size <= maximumDocumentBytes else {
            throw FileError.tooLarge
        }

        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        // Bound the read itself as well as the metadata check: a file can grow
        // between the check and this read. Never allocate its full new size.
        var data = Data()
        while data.count <= maximumDocumentBytes {
            let remaining = maximumDocumentBytes + 1 - data.count
            guard let chunk = try handle.read(upToCount: min(64 * 1024, remaining)),
                  !chunk.isEmpty else { break }
            data.append(chunk)
        }
        guard data.count <= maximumDocumentBytes else { throw FileError.tooLarge }
        return data
    }
}
