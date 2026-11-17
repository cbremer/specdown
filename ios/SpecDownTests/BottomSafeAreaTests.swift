import XCTest
import SwiftUI
import WebKit
@testable import Specdown

@MainActor
final class BottomSafeAreaTests: XCTestCase {
    func testBackgroundReachesBottomWhileDocumentActionsRemainSafe() async throws {
        let scene = try XCTUnwrap(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let window = UIWindow(windowScene: scene)
        window.frame = scene.coordinateSpace.bounds
        window.overrideUserInterfaceStyle = .light
        window.rootViewController = UIHostingController(rootView: ContentView())
        window.makeKeyAndVisible()
        defer { window.isHidden = true }
        func findWeb(_ view: UIView) -> WKWebView? {
            if let web = view as? WKWebView { return web }
            return view.subviews.lazy.compactMap(findWeb).first
        }
        var measuredWeb: WKWebView?
        for _ in 0..<200 {
            if let web = findWeb(window), (try? await web.evaluateJavaScript("typeof window.loadFileContent")) as? String == "function" { measuredWeb = web; break }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        let web = try XCTUnwrap(measuredWeb)
        try await Task.sleep(nanoseconds: 500_000_000)
        let frame = web.convert(web.bounds, to: window)
        XCTAssertEqual(frame.maxY, window.bounds.maxY, accuracy: 1, "The web background must cover the native bottom band")
        XCTAssertGreaterThanOrEqual(frame.minY, window.safeAreaInsets.top - 1, "Keep the top system area protected")
        print("BOTTOM_SAFE_NATIVE window=\(window.bounds) safe=\(window.safeAreaInsets) web=\(frame) local=\(web.safeAreaInsets)")
        let safeBottom = window.bounds.maxY - window.safeAreaInsets.bottom - frame.minY
        for appearance in [UIUserInterfaceStyle.light, .dark] {
            window.overrideUserInterfaceStyle = appearance
            try await Task.sleep(nanoseconds: 300_000_000)
            let homeBottom = try await web.evaluateJavaScript("Math.max(...Array.from(document.querySelectorAll('#drop-zone button')).map(e=>e.getBoundingClientRect()).filter(r=>r.height>0).map(r=>r.bottom))") as! Double
            XCTAssertLessThanOrEqual(homeBottom, Double(safeBottom) + 1)
            let image = UIGraphicsImageRenderer(bounds: window.bounds).image { _ in window.drawHierarchy(in: window.bounds, afterScreenUpdates: true) }
            let attachment = XCTAttachment(image: image)
            attachment.name = appearance == .light ? "safe-bottom-home-light" : "safe-bottom-home-dark"
            attachment.lifetime = .keepAlways
            add(attachment)
        }
        for appearance in [UIUserInterfaceStyle.light, .dark] {
            window.overrideUserInterfaceStyle = appearance
            _ = try await web.evaluateJavaScript("window.loadFileContent('# Safe bottom\\n\\n' + Array(100).fill('Synthetic paragraph.').join('\\n\\n') + '\\n\\nBOTTOM-SENTINEL-104', 'safe-bottom-fixture.md')")
            for _ in 0..<200 {
                if (try? await web.evaluateJavaScript("document.getElementById('markdown-content').textContent.includes('BOTTOM-SENTINEL-104')")) as? Bool == true { break }
                try await Task.sleep(nanoseconds: 100_000_000)
            }
            _ = try await web.evaluateJavaScript("var c=document.getElementById('markdown-content'); c.scrollTop=c.scrollHeight; true")
            try await Task.sleep(nanoseconds: 300_000_000)
            let result = try await web.evaluateJavaScript("""
            (() => {let content=document.getElementById('markdown-content'),last=content.lastElementChild.getBoundingClientRect(),bar=document.getElementById('ios-action-bar'),r=bar.getBoundingClientRect(),buttons=Array.from(document.querySelectorAll('.ios-action-button, .content-header-actions button')).map(e=>e.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0).map(r=>r.bottom);return {scale:visualViewport.scale,height:innerHeight,buttonBottom:Math.max(0,...buttons),lastBottom:last.bottom,barTop:r.height>0?r.top:innerHeight-parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--native-safe-bottom')||'0'),bg:getComputedStyle(content).backgroundColor,nativeBottom:getComputedStyle(document.documentElement).getPropertyValue('--native-safe-bottom')};})()
            """) as! [String:Any]
            print("BOTTOM_SAFE_DOM", appearance.rawValue, result)
            XCTAssertEqual((result["scale"] as? NSNumber)?.doubleValue, 1)
            XCTAssertLessThanOrEqual(try XCTUnwrap((result["buttonBottom"] as? NSNumber)?.doubleValue), Double(safeBottom) + 1)
            XCTAssertLessThanOrEqual(try XCTUnwrap((result["lastBottom"] as? NSNumber)?.doubleValue), try XCTUnwrap((result["barTop"] as? NSNumber)?.doubleValue))
            if (try await web.evaluateJavaScript("document.getElementById('ios-more-button').getBoundingClientRect().height > 0")) as? Bool == true {
                _ = try await web.evaluateJavaScript("document.getElementById('ios-more-button').click()")
                let sheetBottom = try await web.evaluateJavaScript("document.querySelector('#ios-action-sheet .ios-sheet').getBoundingClientRect().bottom") as! Double
                XCTAssertLessThanOrEqual(sheetBottom, Double(safeBottom) + 1)
                _ = try await web.evaluateJavaScript("document.getElementById('ios-action-sheet-close').click()")
            }
        }
    }
}
