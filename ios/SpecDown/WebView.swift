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

        let webView = WKWebView(frame: .zero, configuration: config)
        // Use .scrollableAxes to expose safe area insets to CSS env() variables without
        // automatic content inset adjustments. This allows CSS to handle Dynamic Island
        // and notch areas via env(safe-area-inset-*) while preventing double-insets.
        webView.scrollView.contentInsetAdjustmentBehavior = .scrollableAxes
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        bridge.webView = webView

        // Load the bundled web app; allowingReadAccessTo covers all assets in markdown-viewer/
        if let url = Bundle.main.url(
            forResource: "index",
            withExtension: "html",
            subdirectory: "markdown-viewer"
        ) {
            bridge.pageWillLoad()
            webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        } else {
            // Fallback: show an error page if assets are missing from the bundle
            loadErrorPage(
                in: webView,
                title: "Missing bundled assets",
                message: "markdown-viewer/ assets were not found in the app bundle."
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
            guard let url = Bundle.main.url(
                forResource: "index",
                withExtension: "html",
                subdirectory: "markdown-viewer"
            ) else {
                loadErrorPage(
                    in: webView,
                    title: "Missing bundled assets",
                    message: "markdown-viewer/ assets were not found in the app bundle."
                )
                return
            }

            bridge.pageWillLoad()
            webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
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
