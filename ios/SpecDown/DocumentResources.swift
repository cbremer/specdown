import Foundation
import ImageIO
import Darwin

/// A separate authority domain from specdown://app. A file grant never grants
/// its parent. Folder authority belongs to one accepted document-view token.
final class DocumentResources: @unchecked Sendable {
    struct Image { let data: Data; let mime: String }
    enum Failure: Error { case denied, invalid, limit, stale }
    private let lock = NSLock()
    private var token = ""
    private var documentURL: URL?
    private var root: URL?
    private var rootDescriptor: Int32 = -1
    private var rootScopeActive = false
    deinit { releaseRoot() }
    private func releaseRoot() {
        if rootDescriptor >= 0 { Darwin.close(rootDescriptor) }; rootDescriptor = -1
        if rootScopeActive { root?.stopAccessingSecurityScopedResource() }; rootScopeActive = false
        root = nil
    }
    private var bytes = 0
    private var pixels = 0
    private var count = 0
    static let maximumBytes = 8 * 1024 * 1024
    static let maximumPixels = 16_000_000

    func activate(token: String, documentURL: URL?) {
        lock.lock(); defer { lock.unlock() }
        guard self.token != token else {
            if self.documentURL == nil { self.documentURL = documentURL }
            return
        }
        self.token = token
        self.documentURL = documentURL
        releaseRoot()
        bytes = 0; pixels = 0; count = 0
    }

    /// Pin each canonical ancestor, never follow a substituted symlink while
    /// establishing the selected root. Reads subsequently duplicate this fd.
    private static func openPinnedDirectory(_ root: URL) -> Int32 {
        guard root.isFileURL, root.path.hasPrefix("/"), let canonical = Darwin.realpath(root.path, nil) else { return -1 }
        defer { free(canonical) }
        // Foundation may rewrite /private/var back to the /var symlink; walk
        // the POSIX canonical string directly instead of re-wrapping a URL.
        let canonicalPath = String(cString: canonical)
        var descriptor = Darwin.open("/", O_SEARCH | O_NOFOLLOW)
        guard descriptor >= 0 else { return -1 }
        for component in canonicalPath.split(separator: "/") {
            let next = openat(descriptor, String(component), O_SEARCH | O_NOFOLLOW)
            Darwin.close(descriptor)
            guard next >= 0 else { return -1 }
            descriptor = next
        }
        return descriptor
    }

    @discardableResult
    func grant(root: URL, token: String) -> Bool {
        lock.lock(); defer { lock.unlock() }
        guard self.token == token, root.isFileURL, let documentURL,
              documentURL.standardizedFileURL.path.hasPrefix(root.standardizedFileURL.path + "/") else { return false }
        let scope = root.startAccessingSecurityScopedResource()
        let descriptor = Self.openPinnedDirectory(root)
        guard descriptor >= 0 else { if scope { root.stopAccessingSecurityScopedResource() }; return false }
        releaseRoot()
        self.root = root
        rootDescriptor = descriptor
        rootScopeActive = scope
        return true
    }

    func isCurrent(_ token: String) -> Bool {
        lock.lock(); defer { lock.unlock() }
        return self.token == token
    }

    func read(token: String, relative: String) throws -> Image {
        lock.lock()
        guard self.token == token, let root, let documentURL, count < 64 else {
            lock.unlock(); throw Failure.denied
        }
        let pinned = Darwin.dup(rootDescriptor)
        guard pinned >= 0 else { lock.unlock(); throw Failure.denied }
        count += 1
        lock.unlock()
        var descriptor = pinned
        defer { Darwin.close(descriptor) }
        // Decode exactly once, reject remaining escapes and every parent segment.
        guard let decoded = relative.removingPercentEncoding, !decoded.contains("%"),
              !decoded.contains("\\"), !decoded.contains("\0"), !decoded.hasPrefix("/"),
              !decoded.contains(":"), !decoded.contains("?"), !decoded.contains("#") else { throw Failure.invalid }
        let parts = decoded.split(separator: "/").map(String.init)
        guard !parts.contains(".."), !parts.isEmpty else { throw Failure.invalid }
        let base = documentURL.deletingLastPathComponent().standardizedFileURL
        let prefix = root.standardizedFileURL.path + "/"
        guard base.path == root.standardizedFileURL.path || base.path.hasPrefix(prefix) else { throw Failure.denied }
        let subdirectory = base.path == root.standardizedFileURL.path ? "" : String(base.path.dropFirst(prefix.count))
        let components = (subdirectory.split(separator: "/").map(String.init) + parts).filter { $0 != "." }
        guard let last = components.last else { throw Failure.invalid }
        // The selected root descriptor is pinned while its security scope is
        // live. Renaming/replacing any ancestor can never redirect a later read.
        for component in components.dropLast() {
            let next = openat(descriptor, component, O_SEARCH | O_NOFOLLOW)
            guard next >= 0 else { throw Failure.denied }
            Darwin.close(descriptor)
            descriptor = next
        }
        let fd = openat(descriptor, last, O_RDONLY | O_NOFOLLOW | O_NONBLOCK)
        guard fd >= 0 else { throw Failure.denied }
        let handle = FileHandle(fileDescriptor: fd, closeOnDealloc: true)
        defer { try? handle.close() }
        var info = stat()
        guard fstat(fd, &info) == 0, (info.st_mode & S_IFMT) == S_IFREG else { throw Failure.invalid }
        guard info.st_size <= Self.maximumBytes else { throw Failure.limit }
        let data = try handle.read(upToCount: Self.maximumBytes + 1) ?? Data()
        guard data.count <= Self.maximumBytes else { throw Failure.limit }
        guard let source = CGImageSourceCreateWithData(data as CFData, [kCGImageSourceShouldCache: false] as CFDictionary),
              CGImageSourceGetCount(source) == 1,
              let type = CGImageSourceGetType(source) as String?,
              let mime = ["public.png": "image/png", "public.jpeg": "image/jpeg", "com.compuserve.gif": "image/gif", "org.webmproject.webp": "image/webp"][type],
              let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
              let width = properties[kCGImagePropertyPixelWidth] as? Int,
              let height = properties[kCGImagePropertyPixelHeight] as? Int,
              width > 0, height > 0, width <= 8192, height <= 8192,
              width <= Self.maximumPixels / height else { throw Failure.invalid }
        lock.lock(); defer { lock.unlock() }
        guard self.token == token else { throw Failure.stale }
        guard bytes <= 32 * 1024 * 1024 - data.count, pixels <= 32_000_000 - width * height else { throw Failure.limit }
        bytes += data.count; pixels += width * height
        return Image(data: data, mime: mime)
    }
}
