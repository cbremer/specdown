import WebKit
import SwiftUI
import UniformTypeIdentifiers

/// Manages all communication between the WKWebView (JavaScript) and the native Swift layer.
///
/// JS → Swift: JS calls `window.webkit.messageHandlers.specdown.postMessage({ action, data })`
/// Swift → JS: Swift calls `webView.evaluateJavaScript("window.setTheme('dark')")`
@MainActor
final class WebBridge: NSObject, ObservableObject, WKScriptMessageHandler {
    private static let bundledSamplesSubdirectory = "dist/samples"
    private static let defaultPrintJobName = "SpecDown Document"

    private struct PendingFile {
        let name: String
        let content: String
    }

    // The scene owns one renderer even if SwiftUI rebuilds a split-view column.
    // Script handlers hold only a weak proxy back to this bridge.
    var webView: WKWebView?
    // A collapsed split view can detach the retained renderer while its
    // sidebar still needs to present the document picker in the same window.
    weak var presentationWindow: UIWindow?

    @Published private(set) var currentDocumentName = "SpecDown Document"
    @Published private(set) var recentFiles: [String]
    @Published private(set) var hasLoadedDocument = false
    @Published var showsAppIconPicker = false
    @Published private(set) var viewerPresentationRequest: UInt = 0

    private var pageLoaded = false
    private var readinessGeneration = 0
    private var pendingTheme: String?
    private var pendingLayoutMode: String?
    private var appliedLayoutMode: String?
    private var pendingFile: PendingFile?
    private var pendingError: String?

    private let defaults = UserDefaults.standard
    private enum Keys {
        static let preferences = "specdown.preferences"
        static let recentFiles = "specdown.recentFiles"
    }

    override init() {
        recentFiles = UserDefaults.standard.stringArray(forKey: Keys.recentFiles) ?? []
        super.init()
    }

    // MARK: - JS → Swift

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        // Trust boundary: only the bundled viewer's main frame may drive native
        // actions (print, preferences, file picker, samples, app icon).
        guard message.frameInfo.isMainFrame,
              message.frameInfo.securityOrigin.protocol == BundleSchemeHandler.scheme,
              message.frameInfo.securityOrigin.host == BundleSchemeHandler.host
        else {
            print("[Bridge] Ignoring message from untrusted frame")
            return
        }

        guard
            let body = message.body as? [String: Any],
            let action = body["action"] as? String
        else {
            print("[Bridge] Unexpected message format: \(message.body)")
            return
        }

        let data = body["data"] as? [String: Any]

        switch action {
        case "showAppIconPicker":
            showsAppIconPicker = true

        case "openFilePicker":
            presentDocumentPicker()

        case "openBundledSample":
            if let name = data?["name"] as? String {
                loadBundledSample(named: name)
            } else {
                print("[Bridge] Missing bundled sample name")
            }

        case "savePreferences":
            if let prefs = data {
                defaults.set(prefs, forKey: Keys.preferences)
            }

        case "printDocument":
            let html = data?["html"] as? String
            let title = data?["title"] as? String
            presentPrintController(markupText: html, title: title)

        case "fileLoaded":
            if let name = data?["name"] as? String {
                trackRecentFile(name: name)
            }

        default:
            print("[Bridge] Unknown action: \(action)")
        }
    }

    // MARK: - Swift → JS

    /// A navigation can finish before WebKit has evaluated the module graph.
    /// Keep cold-start files, errors and appearance changes queued until the
    /// actual renderer bridge exists; navigation completion alone is not ready.
    func pageDidLoad() {
        readinessGeneration += 1
        waitForRendererBridge(generation: readinessGeneration, attempt: 0)
    }

    private func waitForRendererBridge(generation: Int, attempt: Int) {
        guard generation == readinessGeneration, !pageLoaded, let webView else { return }
        let check = """
            ['setTheme', 'setIOSLayoutMode', 'loadFileContent', 'specdownShowError']
              .every(function (name) { return typeof window[name] === 'function'; })
            """
        webView.evaluateJavaScript(check) { [weak self] result, _ in
            guard let self, generation == self.readinessGeneration, !self.pageLoaded else { return }
            if result as? Bool == true {
                self.rendererBridgeDidLoad()
            } else if attempt < 199 {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { [weak self] in
                    self?.waitForRendererBridge(generation: generation, attempt: attempt + 1)
                }
            } else {
                // Preserve the queued data; a later reload can recover it.
                print("[Bridge] Renderer bridge was not ready after navigation")
            }
        }
    }

    private func rendererBridgeDidLoad() {
        pageLoaded = true
        if let theme = pendingTheme {
            pendingTheme = nil
            applyTheme(theme)
        }
        if let layoutMode = pendingLayoutMode {
            pendingLayoutMode = nil
            applyLayoutMode(layoutMode)
        }
        if let file = pendingFile {
            pendingFile = nil
            loadFile(name: file.name, content: file.content)
        }
        if let error = pendingError {
            pendingError = nil
            showError(error)
        }
    }

    func pageWillLoad() {
        pageLoaded = false
        // A WebKit process reload need not trigger a SwiftUI update. Restore
        // the last delivered mode unless a newer layout is already queued.
        pendingLayoutMode = pendingLayoutMode ?? appliedLayoutMode
        appliedLayoutMode = nil
        readinessGeneration += 1
    }

    func applyTheme(_ colorScheme: ColorScheme) {
        applyTheme(colorScheme == .dark ? "dark" : "light")
    }

    func applyTheme(_ theme: String) {
        guard pageLoaded else {
            pendingTheme = theme
            return
        }
        evaluateJavaScript(function: "window.setTheme", arguments: [theme], context: "setTheme")
    }

    func applyLayoutMode(_ layoutMode: String) {
        guard pageLoaded else {
            pendingLayoutMode = layoutMode
            return
        }
        guard appliedLayoutMode != layoutMode else { return }
        appliedLayoutMode = layoutMode
        evaluateJavaScript(function: "window.setIOSLayoutMode", arguments: [layoutMode], context: "setIOSLayoutMode")
    }

    /// Show an error toast in the web layer (e.g. an unreadable file).
    func showError(_ message: String) {
        viewerPresentationRequest &+= 1
        guard pageLoaded else {
            pendingError = message
            return
        }
        evaluateJavaScript(function: "window.specdownShowError", arguments: [message], context: "showError")
    }

    /// Deliver a file's content to the web layer.
    func loadFile(name: String, content: String) {
        viewerPresentationRequest &+= 1
        currentDocumentName = name
        hasLoadedDocument = true
        guard pageLoaded else {
            pendingFile = PendingFile(name: name, content: content)
            return
        }
        evaluateJavaScript(function: "window.loadFileContent", arguments: [content, name], context: "loadFileContent")
        trackRecentFile(name: name)
    }

    func openDocumentPickerFromSidebar() {
        presentDocumentPicker()
    }

    /// Read a markdown file URL (security-scoped) and hand its content to the
    /// web layer. Shared by the document picker and by external opens — Files
    /// "Open in place", the share sheet, and "Open With… SpecDown" — routed here
    /// via SwiftUI's `.onOpenURL`.
    func openDocument(at url: URL) {
        let granted = url.startAccessingSecurityScopedResource()
        defer {
            if granted {
                url.stopAccessingSecurityScopedResource()
            }
        }

        do {
            let data = try SpecDownSecurityPolicy.readDocument(at: url)
            guard let content = String(data: data, encoding: .utf8) else {
                print("[Bridge] Unsupported file encoding for \(url.lastPathComponent)")
                showError("\(url.lastPathComponent) couldn't be opened. SpecDown reads UTF-8 text files, such as Markdown (.md).")
                return
            }
            loadFile(name: url.lastPathComponent, content: content)
        } catch SpecDownSecurityPolicy.FileError.tooLarge {
            showError("\(url.lastPathComponent) is too large. SpecDown opens files up to 8 MiB.")
        } catch {
            print("[Bridge] Failed to read file: \(error)")
            showError("\(url.lastPathComponent) couldn't be opened. Check that the file is available and try again.")
        }
    }

    func openBundledSampleFromSidebar(named fileName: String) {
        loadBundledSample(named: fileName)
    }

    private func evaluateJavaScript(function: String, arguments: [Any], context: String) {
        guard let webView else {
            print("[Bridge] Missing WKWebView for \(context)")
            return
        }

        do {
            let serializedArguments = try arguments
                .map(serializeJavaScriptArgument)
                .joined(separator: ", ")
            webView.evaluateJavaScript("\(function)(\(serializedArguments))") { _, error in
                if let error = error {
                    print("[Bridge] \(context) error: \(error)")
                }
            }
        } catch {
            print("[Bridge] Failed to serialize JS arguments for \(context): \(error)")
        }
    }

    private func serializeJavaScriptArgument(_ value: Any) throws -> String {
        let json = try JSONSerialization.data(withJSONObject: [value], options: [])
        guard let encoded = String(data: json, encoding: .utf8) else {
            throw NSError(domain: "WebBridge", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "Unable to encode JavaScript argument as UTF-8."
            ])
        }
        return String(encoded.dropFirst().dropLast())
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

    private func loadBundledSample(named fileName: String) {
        guard let url = bundledSampleURL(named: fileName) else {
            print("[Bridge] Bundled sample not found: \(fileName)")
            return
        }

        do {
            let data = try SpecDownSecurityPolicy.readDocument(at: url)
            guard let content = String(data: data, encoding: .utf8) else {
                print("[Bridge] Unsupported bundled sample encoding for \(fileName)")
                return
            }
            loadFile(name: fileName, content: content)
        } catch {
            print("[Bridge] Failed to read bundled sample \(fileName): \(error)")
        }
    }

    private func presentPrintController(markupText: String?, title: String?) {
        guard let presenter = topViewController() else {
            print("[Bridge] Could not find presenter for print controller")
            return
        }

        let printInfo = UIPrintInfo(dictionary: nil)
        printInfo.outputType = .general
        printInfo.jobName = (title?.isEmpty == false ? title : nil) ?? currentDocumentName

        let controller = UIPrintInteractionController.shared
        controller.printInfo = printInfo
        controller.showsNumberOfCopies = true
        if let markupText, !markupText.isEmpty {
            let formatter = UIMarkupTextPrintFormatter(markupText: markupText)
            formatter.perPageContentInsets = UIEdgeInsets(top: 24, left: 24, bottom: 28, right: 24)
            controller.printFormatter = formatter
        } else if let webView {
            let formatter = webView.viewPrintFormatter()
            formatter.perPageContentInsets = UIEdgeInsets(top: 24, left: 24, bottom: 28, right: 24)
            controller.printFormatter = formatter
        } else {
            print("[Bridge] Missing printable content for printDocument")
            return
        }
        // Present from the top view controller's view so the print sheet anchors
        // correctly on iPad (where `present(animated:)` alone is a no-op — it needs
        // an anchor for the popover). On iPhone the anchor is ignored and it shows
        // full-screen as before. This also uses `presenter`, which was otherwise
        // unused.
        let anchorView = presenter.view ?? webView ?? UIView()
        let anchorRect = CGRect(x: anchorView.bounds.midX, y: anchorView.bounds.midY, width: 0, height: 0)
        controller.present(from: anchorRect, in: anchorView, animated: true) { _, completed, error in
            if let error {
                print("[Bridge] Print controller error: \(error)")
                return
            }
            if !completed {
                print("[Bridge] Print controller cancelled")
            }
        }
    }

    private func bundledSampleURL(named fileName: String) -> URL? {
        let path = (fileName as NSString).deletingPathExtension
        let ext = (fileName as NSString).pathExtension
        guard !path.isEmpty, !ext.isEmpty else {
            return nil
        }
        return Bundle.main.url(
            forResource: path,
            withExtension: ext,
            subdirectory: Self.bundledSamplesSubdirectory
        )
    }

    private func topViewController() -> UIViewController? {
        // A picker or print sheet belongs to this renderer's window, including
        // after its scene moves between a folding phone's displays.
        var top = (webView?.window ?? presentationWindow)?.rootViewController
        while let presented = top?.presentedViewController {
            top = presented
        }
        return top
    }

    private func trackRecentFile(name: String) {
        var recent = defaults.stringArray(forKey: Keys.recentFiles) ?? []
        recent.removeAll { $0 == name }
        recent.insert(name, at: 0)
        let trimmedRecent = Array(recent.prefix(10))
        defaults.set(trimmedRecent, forKey: Keys.recentFiles)
        recentFiles = trimmedRecent
    }
}

extension WebBridge: UIDocumentPickerDelegate {
    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let url = urls.first else { return }
        openDocument(at: url)
    }
}
