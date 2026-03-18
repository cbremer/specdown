import WebKit
import SwiftUI

/// Manages all communication between the WKWebView (JavaScript) and the native Swift layer.
///
/// JS → Swift: JS calls `window.webkit.messageHandlers.specdown.postMessage({ action, data })`
/// Swift → JS: Swift calls `webView.evaluateJavaScript("window.setTheme('dark')")`
class WebBridge: NSObject, ObservableObject, WKScriptMessageHandler {

    weak var webView: WKWebView?

    private var pageLoaded = false
    private var pendingTheme: String?

    // MARK: - JS → Swift

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard
            let body = message.body as? [String: Any],
            let action = body["action"] as? String
        else {
            print("[Bridge] Unexpected message format: \(message.body)")
            return
        }

        let data = body["data"] as? [String: Any]

        switch action {
        case "openFilePicker":
            // Session 2: will present UIDocumentPickerViewController
            print("[Bridge] openFilePicker — not yet implemented (Session 2)")

        case "savePreferences":
            if let prefs = data {
                print("[Bridge] savePreferences: \(prefs)")
                // Session 3: persist via UserDefaults
            }

        case "fileLoaded":
            if let name = data?["name"] as? String {
                print("[Bridge] fileLoaded: \(name)")
                // Session 3: add to recent files list
            }

        default:
            print("[Bridge] Unknown action: \(action)")
        }
    }

    // MARK: - Swift → JS

    /// Called by WKNavigationDelegate once the page has finished loading.
    /// Flushes any theme that was requested before the page was ready.
    func pageDidLoad() {
        pageLoaded = true
        if let theme = pendingTheme {
            pendingTheme = nil
            applyTheme(theme)
        }
    }

    func applyTheme(_ colorScheme: ColorScheme) {
        applyTheme(colorScheme == .dark ? "dark" : "light")
    }

    func applyTheme(_ theme: String) {
        guard pageLoaded else {
            pendingTheme = theme
            return
        }
        // window.setTheme is defined in app.js and sets the theme + re-renders Mermaid
        webView?.evaluateJavaScript("window.setTheme('\(theme)')") { _, error in
            if let error = error {
                print("[Bridge] setTheme('\(theme)') error: \(error)")
            }
        }
    }

    /// Deliver a file's content to the web layer (used from Session 2 onward).
    func loadFile(name: String, content: String) {
        guard pageLoaded else {
            print("[Bridge] loadFile called before page loaded — dropping")
            return
        }
        // Escape content for JS string literal injection
        let escaped = content
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "`", with: "\\`")
        webView?.evaluateJavaScript("window.loadFileContent(`\(escaped)`, '\(name)')") { _, error in
            if let error = error {
                print("[Bridge] loadFile error: \(error)")
            }
        }
    }
}
