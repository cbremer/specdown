import SwiftUI
import WebKit

struct WebView: UIViewRepresentable {
    let bridge: WebBridge

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.defaultWebpagePreferences.allowsContentJavaScript = true

        // Register JS → Swift message handler via a weak proxy to avoid retain cycle
        let handler = WeakMessageHandler(bridge)
        config.userContentController.add(handler, name: "specdown")

        // Inject iOS detection flag before page load
        let iosScript = WKUserScript(
            source: """
                window.iosNative = true;
                window.specdownIOS = {
                    requestFileOpen: function() {
                        window.webkit.messageHandlers.specdown.postMessage({ action: 'openFilePicker' });
                    }
                };
            """,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        config.userContentController.addUserScript(iosScript)

        // Inject touch target CSS after DOM is ready
        let touchScript = WKUserScript(
            source: """
                var s = document.createElement('style');
                s.textContent = '.btn { min-height: 44px; min-width: 44px; }';
                document.head.appendChild(s);
            """,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true
        )
        config.userContentController.addUserScript(touchScript)

        // Serve the bundled web app over a custom URL scheme instead of file://.
        // WKWebView refuses to execute ES-module <script type="module"> loaded
        // from file:// (null-origin CORS rule for modules), which left the app
        // unstyled with no JS. A custom scheme gives the page a real, same-origin
        // context where the Vite module bundle loads normally.
        let schemeHandler = BundleSchemeHandler()
        config.setURLSchemeHandler(schemeHandler, forURLScheme: BundleSchemeHandler.scheme)

        let webView = WKWebView(frame: .zero, configuration: config)
        // Use .scrollableAxes to expose safe area insets to CSS env() variables without
        // automatic content inset adjustments. This allows CSS to handle Dynamic Island
        // and notch areas via env(safe-area-inset-*) while preventing double-insets.
        webView.scrollView.contentInsetAdjustmentBehavior = .scrollableAxes
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        bridge.webView = webView

        // Load the bundled Vite build over the custom scheme (see above).
        if BundleSchemeHandler.bundledIndexExists, let url = BundleSchemeHandler.indexURL {
            bridge.pageWillLoad()
            webView.load(URLRequest(url: url))
        } else {
            // Fallback: show an error page if assets are missing from the bundle
            loadErrorPage(
                in: webView,
                title: "Missing bundled assets",
                message: "dist/ assets were not found in the app bundle."
            )
        }

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(bridge: bridge)
    }

    // MARK: - Coordinator

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        let bridge: WebBridge

        init(bridge: WebBridge) {
            self.bridge = bridge
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }

            if shouldOpenExternallyInPlace(navigationAction, url: url) {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }

            decisionHandler(.allow)
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            bridge.pageDidLoad()
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: Error
        ) {
            handleNavigationFailure(in: webView, error: error)
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            handleNavigationFailure(in: webView, error: error)
        }

        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            print("[WebView] Web content process terminated; reloading bundled viewer")
            reloadBundledViewer(in: webView)
        }

        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            if let url = navigationAction.request.url, shouldOpenInNewWindow(navigationAction, url: url) {
                UIApplication.shared.open(url)
            }
            return nil
        }

        private func shouldOpenExternallyInPlace(_ navigationAction: WKNavigationAction, url: URL) -> Bool {
            navigationAction.navigationType == .linkActivated
                && navigationAction.targetFrame?.isMainFrame == true
                && !url.isFileURL
                && isAllowedScheme(url)
        }

        private func shouldOpenInNewWindow(_ navigationAction: WKNavigationAction, url: URL) -> Bool {
            navigationAction.targetFrame == nil && !url.isFileURL && isAllowedScheme(url)
        }

        private func isAllowedScheme(_ url: URL) -> Bool {
            let scheme = url.scheme?.lowercased() ?? ""
            return scheme == "https" || scheme == "http" || scheme == "mailto"
        }

        private func handleNavigationFailure(in webView: WKWebView, error: Error) {
            let nsError = error as NSError
            if nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled {
                return
            }

            print("[WebView] Navigation failed: \(error)")
            loadErrorPage(
                in: webView,
                title: "Unable to load viewer",
                message: "Specdown couldn't load its bundled viewer content. Please relaunch the app or reinstall it if this keeps happening."
            )
        }

        private func reloadBundledViewer(in webView: WKWebView) {
            guard BundleSchemeHandler.bundledIndexExists, let url = BundleSchemeHandler.indexURL else {
                loadErrorPage(
                    in: webView,
                    title: "Missing bundled assets",
                    message: "dist/ assets were not found in the app bundle."
                )
                return
            }

            bridge.pageWillLoad()
            webView.load(URLRequest(url: url))
        }
    }
}

private func loadErrorPage(in webView: WKWebView, title: String, message: String) {
    let html = """
        <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 2rem; line-height: 1.5;">
            <h2>\(htmlEscaped(title))</h2>
            <p>\(htmlEscaped(message))</p>
        </body>
        """
    webView.loadHTMLString(html, baseURL: nil)
}

private func htmlEscaped(_ text: String) -> String {
    text
        .replacingOccurrences(of: "&", with: "&amp;")
        .replacingOccurrences(of: "<", with: "&lt;")
        .replacingOccurrences(of: ">", with: "&gt;")
        .replacingOccurrences(of: "\"", with: "&quot;")
        .replacingOccurrences(of: "'", with: "&#39;")
}

// MARK: - WeakMessageHandler

/// Prevents the retain cycle that would occur if WebBridge were added directly
/// to WKUserContentController (which holds a strong reference to its handlers).
private class WeakMessageHandler: NSObject, WKScriptMessageHandler {
    weak var delegate: WKScriptMessageHandler?

    init(_ delegate: WKScriptMessageHandler) {
        self.delegate = delegate
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        delegate?.userContentController(userContentController, didReceive: message)
    }
}

// MARK: - BundleSchemeHandler

/// Serves the bundled Vite build (dist/) over a custom URL scheme so the page
/// has a real same-origin context. WKWebView will not execute ES-module scripts
/// loaded from file://, so the app must not be served via loadFileURL.
final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "specdown"
    static let host = "app"

    /// The dist/ directory inside the app bundle.
    static let rootURL: URL? = Bundle.main
        .url(forResource: "index", withExtension: "html", subdirectory: "dist")?
        .deletingLastPathComponent()

    static var bundledIndexExists: Bool { rootURL != nil }

    /// The entry URL to load, e.g. specdown://app/index.html
    static var indexURL: URL? { URL(string: "\(scheme)://\(host)/index.html") }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url, let root = Self.rootURL else {
            urlSchemeTask.didFailWithError(URLError(.fileDoesNotExist))
            return
        }

        // Map the request path to a file under dist/. "/" → index.html.
        var relativePath = url.path
        if relativePath.hasPrefix("/") { relativePath.removeFirst() }
        if relativePath.isEmpty { relativePath = "index.html" }

        let rootStd = root.standardizedFileURL
        let fileURL = rootStd.appendingPathComponent(relativePath).standardizedFileURL

        // Guard against path traversal outside the bundled dist/ directory.
        guard fileURL.path.hasPrefix(rootStd.path),
              let data = try? Data(contentsOf: fileURL) else {
            urlSchemeTask.didFailWithError(URLError(.fileDoesNotExist))
            return
        }

        let response = HTTPURLResponse(
            url: url,
            statusCode: 200,
            httpVersion: "HTTP/1.1",
            headerFields: [
                "Content-Type": Self.mimeType(forExtension: fileURL.pathExtension),
                "Content-Length": String(data.count),
                "Access-Control-Allow-Origin": "*",
            ]
        )!

        urlSchemeTask.didReceive(response)
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}

    private static func mimeType(forExtension ext: String) -> String {
        switch ext.lowercased() {
        case "html": return "text/html; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "js", "mjs": return "text/javascript; charset=utf-8"
        case "json": return "application/json; charset=utf-8"
        case "svg": return "image/svg+xml"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "md", "markdown": return "text/markdown; charset=utf-8"
        case "woff2": return "font/woff2"
        case "woff": return "font/woff"
        case "ttf": return "font/ttf"
        default: return "application/octet-stream"
        }
    }
}
