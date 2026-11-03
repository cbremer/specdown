import XCTest
import SwiftUI
import WebKit
@testable import Specdown

@MainActor
final class NativeDocumentTests: XCTestCase {
    private var retainedWindow: UIWindow?
    private var suite = ""
    private var fixture: URL!

    override func setUp() async throws {
        suite = "SpecDown.Synthetic.\(UUID())"
        fixture = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: fixture, withIntermediateDirectories: true)
    }
    override func tearDown() async throws {
        retainedWindow?.isHidden = true
        retainedWindow = nil
        UserDefaults.standard.removePersistentDomain(forName: suite)
        try? FileManager.default.removeItem(at: fixture)
    }
    private func host(_ bridge: WebBridge) async throws -> WKWebView {
        let controller = UIHostingController(rootView: WebView(bridge: bridge, layoutMode: "phone"))
        let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first!
        let window = UIWindow(windowScene: scene)
        window.frame = scene.coordinateSpace.bounds
        window.rootViewController = controller
        window.makeKeyAndVisible()
        retainedWindow = window
        try await wait("WebView attached") { bridge.webView?.window != nil }
        let web = bridge.webView!
        try await wait("JS bridge loaded") { (try? await web.evaluateJavaScript("typeof window.loadFileContent === 'function'")) as? Bool == true }
        return web
    }
    private func wait(_ label: String = "condition", _ condition: @escaping () async -> Bool) async throws {
        for _ in 0..<300 {
            if await condition() { return }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        XCTFail("Timed out waiting for native renderer: \(label)")
        throw NSError(domain: "NativeDocumentTests", code: 1)
    }

    func testColdOpenRecentRestartAndRealWKImageAuthority() async throws {
        let defaults = UserDefaults(suiteName: suite)!
        let bridge = WebBridge(defaults: defaults)
        let document = fixture.appendingPathComponent("README.md")
        try "# Synthetic\n\n![Space](./my%20diagram.png)".write(to: document, atomically: true, encoding: .utf8)
        let png = Data(base64Encoded: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")!
        try png.write(to: fixture.appendingPathComponent("my diagram.png"))
        bridge.openDocument(at: document)
        // Force a queued open before the first WebView/page exists.
        try await Task.sleep(nanoseconds: 300_000_000)
        let web = try await host(bridge)
        try await wait { bridge.recentFiles.count == 1 }
        XCTAssertEqual(bridge.currentDocumentName, "README.md")
        let src = try await web.evaluateJavaScript("document.querySelector('#markdown-content img').src") as! String
        XCTAssertTrue(src.hasPrefix("specdown-resource:"))
        let ungrantedWidth = try await web.evaluateJavaScript("document.querySelector('#markdown-content img').naturalWidth") as? Int
        XCTAssertEqual(ungrantedWidth, 0)
        let token = URL(string: src)!.host!
        XCTAssertTrue(bridge.documentResources.grant(root: fixture, token: token))
        _ = try await web.callAsyncJavaScript("window.specdownReloadImages(token)", arguments: ["token": token], in: nil, contentWorld: .page)
        try await wait { (try? await web.evaluateJavaScript("document.querySelector('#markdown-content img').naturalWidth")) as? Int == 1 }
        let restarted = WebBridge(defaults: defaults)
        XCTAssertEqual(restarted.recentFiles.count, 1)
        XCTAssertEqual(restarted.recentFiles[0].name, "README.md")
        restarted.reopenRecent(restarted.recentFiles[0])
        _ = try await host(restarted)
        try await wait { restarted.hasLoadedDocument }
        XCTAssertEqual(restarted.currentDocumentName, "README.md")
    }

    func testNativeExportChooserAndCancellationCleanRealFiles() async throws {
        let bridge = WebBridge(defaults: UserDefaults(suiteName: suite)!)
        let web = try await host(bridge)
        bridge.loadFile(name: "synthetic.md", content: "# Diagram\n\n```mermaid\ngraph TD\nA-->B\n```")
        try await wait("Mermaid SVG rendered") { (try? await web.evaluateJavaScript("!!document.querySelector('#markdown-content .diagram-wrapper svg')")) as? Bool == true }
        _ = try await web.evaluateJavaScript("document.querySelector('#markdown-content .diagram-expand').click()")
        _ = try await web.evaluateJavaScript("document.querySelector('#fullscreen-overlay .export-svg').click()")
        try await wait("native export chooser") { self.retainedWindow?.rootViewController?.presentedViewController is UIAlertController }
        let chooser = retainedWindow!.rootViewController!.presentedViewController as! UIAlertController
        XCTAssertEqual(chooser.title, "Export Diagram")
        XCTAssertTrue(chooser.actions.contains { $0.title == "Save to Files…" })
        XCTAssertTrue(chooser.actions.contains { $0.title == "Share…" })
        let temp = FileManager.default.temporaryDirectory
        let staged = try FileManager.default.contentsOfDirectory(at: temp, includingPropertiesForKeys: nil).filter { $0.lastPathComponent.hasPrefix("specdown-diagram-") }
        XCTAssertEqual(staged.count, 1)
        // A new accepted document invalidates the chooser and its staged file.
        bridge.loadFile(name: "next.md", content: "# Next synthetic document")
        try await wait { !FileManager.default.fileExists(atPath: staged[0].path) }
        XCTAssertEqual(bridge.currentDocumentName, "next.md")
    }
    func testFilesAndSharePresentationCancellationAndStaleCallbacks() async throws {
        let bridge = WebBridge(defaults: UserDefaults(suiteName: suite)!)
        _ = try await host(bridge)
        let presenter = retainedWindow!.rootViewController!
        let exporter = NativeDiagramExport()
        let svg = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 10 10\"><text>Synthetic</text></svg>"
        exporter.begin(format: "svg", payload: svg, token: "view-a", requestID: "first", presenter: presenter)
        let firstID = Mirror(reflecting: exporter).children.first { $0.label == "requestID" }!.value as! String
        exporter.choose(.files, lifecycleID: firstID)
        try await wait("Files export picker") { presenter.presentedViewController is UIDocumentPickerViewController }
        let oldPicker = presenter.presentedViewController as! UIDocumentPickerViewController
        exporter.documentPickerWasCancelled(oldPicker)
        oldPicker.dismiss(animated: false)
        try await wait { presenter.presentedViewController == nil }
        exporter.begin(format: "svg", payload: svg, token: "view-a", requestID: "second", presenter: presenter)
        let secondID = Mirror(reflecting: exporter).children.first { $0.label == "requestID" }!.value as! String
        exporter.choose(.files, lifecycleID: firstID) // stale chooser A action must not operate B
        XCTAssertTrue(presenter.presentedViewController is UIAlertController)
        exporter.choose(.share, lifecycleID: secondID)
        try await wait("native Share sheet") { presenter.presentedViewController is UIActivityViewController }
        let share = presenter.presentedViewController as! UIActivityViewController
        exporter.documentPickerWasCancelled(oldPicker) // must not clean the newer share
        let temp = FileManager.default.temporaryDirectory
        let staged = try FileManager.default.contentsOfDirectory(at: temp, includingPropertiesForKeys: nil).filter { $0.lastPathComponent.hasPrefix("specdown-diagram-") }
        XCTAssertEqual(staged.count, 1)
        share.completionWithItemsHandler?(nil, false, nil, nil)
        XCTAssertFalse(FileManager.default.fileExists(atPath: staged[0].path))
        share.dismiss(animated: false)
    }

    func testRealPNGExportStagesPNGBytes() async throws {
        let bridge = WebBridge(defaults: UserDefaults(suiteName: suite)!)
        let web = try await host(bridge)
        bridge.loadFile(name: "png.md", content: "# PNG\n\n```mermaid\ngraph TD\nA-->B\n```")
        try await wait("PNG diagram rendered") { (try? await web.evaluateJavaScript("!!document.querySelector('#markdown-content .diagram-wrapper svg')")) as? Bool == true }
        _ = try await web.evaluateJavaScript("document.querySelector('#markdown-content .diagram-expand').click(); document.querySelector('#fullscreen-overlay .export-png').click()")
        try await wait("PNG native chooser") { self.retainedWindow?.rootViewController?.presentedViewController is UIAlertController }
        let staged = try FileManager.default.contentsOfDirectory(at: FileManager.default.temporaryDirectory, includingPropertiesForKeys: nil).filter { $0.lastPathComponent.hasPrefix("specdown-diagram-") }
        XCTAssertEqual(staged.count, 1)
        let files = try FileManager.default.contentsOfDirectory(at: staged[0], includingPropertiesForKeys: nil)
        XCTAssertEqual(files[0].pathExtension, "png")
        let bytes = try Data(contentsOf: files[0])
        XCTAssertEqual(Array(bytes.prefix(8)), [137,80,78,71,13,10,26,10])
        bridge.loadFile(name: "next.md", content: "# Next")
        try await wait { !FileManager.default.fileExists(atPath: staged[0].path) }
    }

    func testStaleFolderPickerCannotConsumeNewViewAuthority() async throws {
        let bridge = WebBridge(defaults: UserDefaults(suiteName: suite)!)
        let web = try await host(bridge)
        let png = Data(base64Encoded: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")!
        try png.write(to: fixture.appendingPathComponent("image.png"))
        let a = fixture.appendingPathComponent("a.md")
        let b = fixture.appendingPathComponent("b.md")
        try "# A\n![Image](./image.png)".write(to: a, atomically: true, encoding: .utf8)
        try "# B\n![Image](./image.png)".write(to: b, atomically: true, encoding: .utf8)
        bridge.openDocument(at: a)
        try await wait { bridge.recentFiles.count == 1 }
        let sourceA = try await web.evaluateJavaScript("document.querySelector('#markdown-content img').src") as! String
        bridge.authorizeImageFolder(token: URL(string: sourceA)!.host!)
        let presenter = retainedWindow!.rootViewController!
        try await wait { presenter.presentedViewController is UIDocumentPickerViewController }
        let oldPicker = presenter.presentedViewController as! UIDocumentPickerViewController
        bridge.openDocument(at: b)
        try await wait { bridge.currentDocumentName == "b.md" && presenter.presentedViewController == nil }
        let sourceB = try await web.evaluateJavaScript("document.querySelector('#markdown-content img').src") as! String
        bridge.authorizeImageFolder(token: URL(string: sourceB)!.host!)
        try await wait { presenter.presentedViewController is UIDocumentPickerViewController }
        let newPicker = presenter.presentedViewController as! UIDocumentPickerViewController
        bridge.documentPicker(oldPicker, didPickDocumentsAt: [fixture])
        bridge.documentPickerWasCancelled(oldPicker)
        let denied = try await web.evaluateJavaScript("document.querySelector('#markdown-content img').naturalWidth") as? Int
        XCTAssertEqual(denied, 0)
        XCTAssertEqual(bridge.currentDocumentName, "b.md")
        bridge.documentPicker(newPicker, didPickDocumentsAt: [fixture])
        try await wait { (try? await web.evaluateJavaScript("document.querySelector('#markdown-content img').naturalWidth")) as? Int == 1 }
        newPicker.dismiss(animated: false)
    }

    func testNewerNativeReadMayFinishAfterOlderAcceptedRead() async throws {
        let bridge = WebBridge(defaults: UserDefaults(suiteName: suite)!)
        _ = try await host(bridge)
        let first = fixture.appendingPathComponent("first.md")
        let newer = fixture.appendingPathComponent("newer.md")
        try "# First accepted".write(to: first, atomically: true, encoding: .utf8)
        try "# Newer request".write(to: newer, atomically: true, encoding: .utf8)
        let writing = expectation(description: "hold newer provider read")
        let release = DispatchSemaphore(value: 0)
        DispatchQueue.global().async {
            NSFileCoordinator().coordinate(writingItemAt: newer, options: [], error: nil) { _ in
                writing.fulfill()
                release.wait()
            }
        }
        defer { release.signal() }
        await fulfillment(of: [writing], timeout: 5)
        bridge.openDocument(at: first)
        bridge.openDocument(at: newer)
        try await wait("older native request accepted before newer read") { bridge.currentDocumentName == "first.md" }
        release.signal()
        try await wait("newer native request remains eligible after older acceptance") { bridge.currentDocumentName == "newer.md" }
        XCTAssertEqual(bridge.recentFiles.map(\.name), ["newer.md", "first.md"])
    }

    func testMovedRecentUsesAcknowledgedImageBase() async throws {
        let bridge = WebBridge(defaults: UserDefaults(suiteName: suite)!)
        let web = try await host(bridge)
        let original = fixture.appendingPathComponent("original")
        let moved = fixture.appendingPathComponent("moved")
        try FileManager.default.createDirectory(at: original, withIntermediateDirectories: true)
        let document = original.appendingPathComponent("README.md")
        try "# Synthetic moved recent\n![Image](./image.png)".write(to: document, atomically: true, encoding: .utf8)
        let png = Data(base64Encoded: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")!
        try png.write(to: original.appendingPathComponent("image.png"))
        bridge.openDocument(at: document)
        try await wait { bridge.recentFiles.count == 1 }
        let entry = bridge.recentFiles[0]
        try FileManager.default.moveItem(at: original, to: moved)
        bridge.reopenRecent(entry)
        try await wait("moved recent accepted at its new location") { bridge.recentFiles[0].location == moved.path }
        let source = try await web.evaluateJavaScript("document.querySelector('#markdown-content img').src") as! String
        let token = URL(string: source)!.host!
        XCTAssertTrue(bridge.documentResources.grant(root: moved, token: token), "Moved recent retained its old image base")
        _ = try await web.callAsyncJavaScript("window.specdownReloadImages(token)", arguments: ["token": token], in: nil, contentWorld: .page)
        try await wait { (try? await web.evaluateJavaScript("document.querySelector('#markdown-content img').naturalWidth")) as? Int == 1 }
    }

}
