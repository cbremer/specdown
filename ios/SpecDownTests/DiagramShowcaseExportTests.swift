import XCTest
import SwiftUI
import WebKit
@testable import Specdown

@MainActor
final class DiagramShowcaseExportTests: XCTestCase {
    func testEveryBundledDiagramStagesNativeSVG() async throws {
        let suite = "SpecDown.Showcase.Synthetic.\(UUID())"
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }
        let bridge = WebBridge(defaults: defaults)
        let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first!
        let window = UIWindow(windowScene: scene)
        window.frame = scene.coordinateSpace.bounds
        window.rootViewController = UIHostingController(rootView: WebView(bridge: bridge, layoutMode: UIDevice.current.userInterfaceIdiom == .pad ? "pad" : "phone"))
        window.makeKeyAndVisible()
        defer { window.isHidden = true }
        for _ in 0..<300 {
            if let web = bridge.webView, (try? await web.evaluateJavaScript("typeof window.loadFileContent === 'function'")) as? Bool == true { break }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        let web = try XCTUnwrap(bridge.webView)
        bridge.openBundledSampleFromSidebar(named: "diagram-showcase.md")
        var count = 0
        for _ in 0..<1200 {
            count = (try? await web.evaluateJavaScript("document.querySelectorAll('#markdown-content .diagram-wrapper svg').length")) as? Int ?? 0
            if count == 10 { break }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        XCTAssertEqual(count, 10, "Expected all ten bundled Mermaid types to render")
        let diagrams = try await web.evaluateJavaScript("Array.from(document.querySelectorAll('#markdown-content .diagram-wrapper svg')).map(svg=>({svg:new XMLSerializer().serializeToString(svg),source:svg.getAttribute('data-mermaid-source')||''}))") as! [[String:String]]
        var failures = 0
        for (index, diagram) in diagrams.enumerated() {
            let svg = diagram["svg"]!
            let name = diagram["source"]!.split(separator: "\n").first.map(String.init) ?? "unknown"
            let files = DiagramExportFiles()
            do {
                _ = try files.stage(format: "svg", payload: svg)
                print("SHOWCASE_NATIVE_SVG", index + 1, name, "PASS")
            } catch {
                failures += 1
                print("SHOWCASE_NATIVE_SVG", index + 1, name, "FAIL", error)
            }
            files.clean()
            let attachment = XCTAttachment(data: Data(svg.utf8), uniformTypeIdentifier: "public.svg-image")
            attachment.name = "showcase-\(index + 1)-\(name)"
            attachment.lifetime = .keepAlways
            add(attachment)
        }
        XCTAssertEqual(failures, 0, "Bundled SVG export policy rejected rendered diagrams")
    }
}
