import SwiftUI
import WebKit

struct WebView: UIViewRepresentable {
    let bridge: WebBridge

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()

        // Register JS → Swift message handler via a weak proxy to avoid retain cycle
        let handler = WeakMessageHandler(bridge)
        config.userContentController.add(handler, name: "specdown")

        // Inject iOS detection flag before page load
        let iosScript = WKUserScript(
            source: "window.iosNative = true;",
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
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.navigationDelegate = context.coordinator
        bridge.webView = webView

        // Load the bundled web app; allowingReadAccessTo covers all assets in markdown-viewer/
        if let url = Bundle.main.url(
            forResource: "index",
            withExtension: "html",
            subdirectory: "markdown-viewer"
        ) {
            webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        } else {
            // Fallback: show an error page if assets are missing from the bundle
            webView.loadHTMLString(
                "<body style='font-family:sans-serif;padding:2rem'>"
                + "<h2>Error</h2><p>markdown-viewer/ assets not found in app bundle.</p></body>",
                baseURL: nil
            )
        }

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(bridge: bridge)
    }

    // MARK: - Coordinator

    class Coordinator: NSObject, WKNavigationDelegate {
        let bridge: WebBridge

        init(bridge: WebBridge) {
            self.bridge = bridge
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            bridge.pageDidLoad()
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            print("[WebView] Navigation failed: \(error)")
        }
    }
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
