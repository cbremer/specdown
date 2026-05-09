import WebKit
import SwiftUI
import UniformTypeIdentifiers

/// Manages all communication between the WKWebView (JavaScript) and the native Swift layer.
///
/// JS → Swift: JS calls `window.webkit.messageHandlers.specdown.postMessage({ action, data })`
/// Swift → JS: Swift calls `webView.evaluateJavaScript("window.setTheme('dark')")`
class WebBridge: NSObject, ObservableObject, WKScriptMessageHandler {

    weak var webView: WKWebView?

    private var pageLoaded = false
    private var pendingTheme: String?

    private let defaults = UserDefaults.standard
    private enum Keys {
        static let preferences = "specdown.preferences"
        static let recentFiles = "specdown.recentFiles"
    }

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
            presentDocumentPicker()

        case "savePreferences":
            if let prefs = data {
                defaults.set(prefs, forKey: Keys.preferences)
            }

        case "fileLoaded":
            if let name = data?["name"] as? String {
                trackRecentFile(name: name)
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
        webView?.evaluateJavaScript("window.setTheme('\\(theme)')") { _, error in
            if let error = error {
                print("[Bridge] setTheme('\\(theme)') error: \(error)")
            }
        }
    }

    /// Deliver a file's content to the web layer.
    func loadFile(name: String, content: String) {
        guard pageLoaded else {
            print("[Bridge] loadFile called before page loaded — dropping")
            return
        }
        let escaped = content
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "`", with: "\\`")
        webView?.evaluateJavaScript("window.loadFileContent(`\(escaped)`, '\(name)')") { _, error in
            if let error = error {
                print("[Bridge] loadFile error: \(error)")
            }
        }
    }

    // MARK: - Native integrations

    private func presentDocumentPicker() {
        let types: [UTType] = [.plainText, .utf8PlainText, .sourceCode, .json, .xml]
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: types)
        picker.delegate = self
        picker.allowsMultipleSelection = false

        guard let presenter = topViewController() else {
            print("[Bridge] Could not find presenter for document picker")
            return
        }
        presenter.present(picker, animated: true)
    }

    private func topViewController() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
        let keyWindow = scenes
            .flatMap { $0.windows }
            .first { $0.isKeyWindow }
        var top = keyWindow?.rootViewController
        while let presented = top?.presentedViewController {
            top = presented
        }
        return top
    }

    private func trackRecentFile(name: String) {
        var recent = defaults.stringArray(forKey: Keys.recentFiles) ?? []
        recent.removeAll { $0 == name }
        recent.insert(name, at: 0)
        defaults.set(Array(recent.prefix(10)), forKey: Keys.recentFiles)
    }
}

extension WebBridge: UIDocumentPickerDelegate {
    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let url = urls.first else { return }
        let granted = url.startAccessingSecurityScopedResource()
        defer {
            if granted {
                url.stopAccessingSecurityScopedResource()
            }
        }

        do {
            let content = try String(contentsOf: url, encoding: .utf8)
            loadFile(name: url.lastPathComponent, content: content)
        } catch {
            print("[Bridge] Failed to read file: \(error)")
        }
    }
}
