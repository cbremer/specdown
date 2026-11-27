import Vision
import PDFKit
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
        let request: DocumentLoadAcceptance.Request
        let recent: RecentDocuments.Entry?
        let sourceURL: URL?
    }

    // The scene owns one renderer even if SwiftUI rebuilds a split-view column.
    // Script handlers hold only a weak proxy back to this bridge.
    var webView: WKWebView?
    // A collapsed split view can detach the retained renderer while its
    // sidebar still needs to present the document picker in the same window.
    weak var presentationWindow: UIWindow?

    @Published private(set) var currentDocumentName = "SpecDown Document"
    @Published private(set) var recentFiles: [RecentDocuments.Entry]
    @Published private(set) var hasLoadedDocument = false
    @Published var showsAppIconPicker = false
    @Published private(set) var viewerPresentationRequest: UInt = 0

    private var pageLoaded = false
    private var readinessGeneration = 0
    private var pendingTheme: String?
    private var pendingLayoutMode: String?
    private var appliedLayoutMode: String?
    private let documentDeliveries = DocumentDeliveryQueue()
    private var pendingFile: PendingFile?
    private var pendingError: String?
    private let diagramExports = NativeDiagramExport()
    private lazy var reader = AppleReaderServices(
        speechEvent: { [weak self] event in
            self?.evaluateJavaScript(function: "window.specdownSpeechEvent", arguments: [event], context: "readerSpeech")
        },
        explainResult: { [weak self] id, result in
            self?.evaluateJavaScript(function: "window.specdownExplainResult", arguments: [id, result], context: "askExplain")
        })
    private(set) var urlInputController: NativeURLInputController?
    private weak var pendingURLInputSource: UIView?
    private var pendingURLInputRect: CGRect?
    let documentResources = DocumentResources()
    private struct MarkdownExport {
        let requestID: String
        let temporaryURL: URL
        let content: String
    }
    private var markdownExports: [ObjectIdentifier: MarkdownExport] = [:]
    private var markdownExportPicker: UIDocumentPickerViewController?
    private var activeMarkdownSaves = Set<String>()
    private var sourceURLs: [String: URL] = [:]
    private var currentViewID = ""
    private var documentViewTransitions = NativeDocumentViewTransitions()
    private var viewerHasStarted = false
    private var openSourceIDs = Set<String>()
    private let imageFolderPickers = NSMapTable<UIDocumentPickerViewController, NSString>(keyOptions: .weakMemory, valueOptions: .strongMemory)
    private weak var activeImageFolderPicker: UIDocumentPickerViewController?
    private var documentLoadAcceptance = DocumentLoadAcceptance()

    private let recentDocuments: RecentDocuments
    private struct ProviderRead {
        let request: DocumentLoadAcceptance.Request
        let permit: DocumentReadPermit
    }
    private var activeProviderReads: [UUID: ProviderRead] = [:]
    private let fileQueue = DispatchQueue(label: "specdown.provider-reads", qos: .userInitiated, attributes: .concurrent)
    private let defaults: UserDefaults
    private enum Keys {
        static let preferences = "specdown.preferences"
        static let recentFiles = "specdown.recentFiles"
    }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        recentDocuments = RecentDocuments(defaults: defaults)
        recentFiles = recentDocuments.entries
        super.init()
        diagramExports.onError = { [weak self] message in self?.showError(message) }
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
        case "readerSpeech":
            if let command = body["command"] as? [String: Any] { reader.speech(command) }
        case "explainAvailable", "askExplain", "cancelExplain":
            if let data { reader.explain(action: action, data: data) }
        case "openURLInput":
            guard let webView, let data,
                  let x = data["x"] as? Double, let y = data["y"] as? Double,
                  let width = data["width"] as? Double, let height = data["height"] as? Double,
                  let viewport = data["viewportWidth"] as? Double,
                  [x, y, width, height, viewport].allSatisfy({ $0.isFinite }),
                  viewport > 0, width > 0, height > 0 else { return }
            let scale = webView.bounds.width / viewport
            let rect = CGRect(x: x * scale, y: y * scale, width: width * scale, height: height * scale).intersection(webView.bounds)
            guard !rect.isNull, !rect.isEmpty else { return }
            presentURLInput(from: webView, sourceRect: rect)

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

        case "documentViewChanged":
            guard let id = data?["id"] as? String, let token = data?["token"] as? String else { return }
            let previousToken = documentViewTransitions.token
            let transition = documentViewTransitions.observe(token: token, deliveryID: data?["deliveryID"] as? String,
                initialWelcome: id == "empty" && token == "0-0")
            if transition == .alreadyAcknowledged { return }
            if transition == .manual {
                documentLoadAcceptance.invalidateRequests()
                for operation in activeProviderReads.values { operation.permit.cancel() }
            }
            diagramExports.invalidate(unless: token)
            if previousToken != token {
                reader.reset()
                invalidateImageFolderPicker()
            }
            let ids = (data?["openIDs"] as? [String] ?? []).prefix(10).filter { $0.utf8.count <= 128 }
            openSourceIDs = Set(ids)
            pruneSourceURLs()
            currentViewID = id
            // A same-ID recent may have moved. Never seed a new native view
            // from its old registry URL before the coordinated read is acknowledged.
            documentResources.activate(token: token, documentURL: transition == .native ? nil : sourceURLs[id])
        case "exportDiagram":
            guard let token = data?["token"] as? String, token == documentViewTransitions.token, !token.isEmpty,
                  let format = data?["format"] as? String, let payload = data?["payload"] as? String,
                  let requestID = data?["requestID"] as? String, requestID.count <= 80,
                  let presenter = topViewController() else { return }
            diagramExports.begin(format: format, payload: payload, token: token, requestID: requestID, presenter: presenter)
        case "authorizeImageFolder":
            if let token = data?["token"] as? String { authorizeImageFolder(token: token) }
        case "saveMarkdown":
            if let data { saveMarkdown(data) }
        case "showRecentFiles":
            presentRecentFiles()

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
            ['setTheme', 'setIOSLayoutMode', 'loadFileContent', 'specdownLoadNativeDocument', 'specdownShowError']
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
            deliverFile(name: file.name, content: file.content, request: file.request, recent: file.recent, sourceURL: file.sourceURL)
        }
        if let error = pendingError {
            pendingError = nil
            showError(error)
        }
        if let source = pendingURLInputSource {
            let rect = pendingURLInputRect
            pendingURLInputSource = nil
            pendingURLInputRect = nil
            presentURLInput(from: source, sourceRect: rect)
        }
    }

    func pageWillLoad() {
        reader.reset()
        urlInputController?.cancel()
        pageLoaded = false
        diagramExports.invalidate(unless: "")
        invalidateImageFolderPicker()
        documentViewTransitions.reset()
        if viewerHasStarted { for operation in activeProviderReads.values { operation.permit.cancel() } }
        viewerHasStarted = true
        documentResources.activate(token: "", documentURL: nil)
        documentLoadAcceptance.beginPageLoad()
        if let pending = pendingFile {
            // An intentional cold-start open belongs to the new page. Retain
            // its content while invalidating callbacks from the previous page.
            pendingFile = PendingFile(name: pending.name, content: pending.content,
                request: documentLoadAcceptance.beginRequest(), recent: pending.recent, sourceURL: pending.sourceURL)
        }
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
        deliverFile(name: name, content: content, request: documentLoadAcceptance.beginRequest(), recent: nil)
    }

    private func deliverFile(name: String, content: String, request: DocumentLoadAcceptance.Request, recent: RecentDocuments.Entry?, sourceURL: URL? = nil) {
        guard documentLoadAcceptance.canDeliver(request) else { return }
        viewerPresentationRequest &+= 1
        guard pageLoaded else {
            pendingFile = PendingFile(name: name, content: content, request: request, recent: recent, sourceURL: sourceURL)
            return
        }
        let submitted = documentDeliveries.submit { [weak self] done in
            guard let self, self.documentLoadAcceptance.canDeliver(request) else { done(); return }
            let deliveryID = UUID().uuidString
            let sourceID = recent?.id ?? UUID().uuidString
            self.documentViewTransitions.beginDelivery(deliveryID)
            var nativeDocument = ["id": sourceID, "expectedToken": self.documentViewTransitions.token.isEmpty ? "0-0" : self.documentViewTransitions.token, "deliveryID": deliveryID]
            let format = (name as NSString).pathExtension.lowercased()
            if recent != nil, ["pdf", "docx"].contains(format) {
                nativeDocument["format"] = format
            }
            self.evaluateJavaScript(function: "window.specdownLoadNativeDocument", arguments: [content, name, nativeDocument], context: "loadFileContent") { [weak self] result, error in
                defer { done() }
                guard let self else { return }
                let outcome = result as? [String: Any]
                guard self.documentLoadAcceptance.accept(request, rendererAccepted: error == nil && outcome?["accepted"] as? Bool == true),
                      let token = outcome?["token"] as? String else {
                    self.documentViewTransitions.rejectDelivery(deliveryID)
                    return
                }
                if self.documentViewTransitions.token != token {
                    self.diagramExports.invalidate(unless: token)
                    self.invalidateImageFolderPicker()
                }
                self.documentViewTransitions.acknowledge(deliveryID, token: token)
                for operation in self.activeProviderReads.values where !self.documentLoadAcceptance.canDeliver(operation.request) {
                    operation.permit.cancel()
                }
                self.openSourceIDs = Set((outcome?["openIDs"] as? [String] ?? []).prefix(10).filter { $0.utf8.count <= 128 })
                self.currentViewID = sourceID
                self.documentResources.activate(token: token, documentURL: sourceURL)
                self.currentDocumentName = name
                self.hasLoadedDocument = true
                if let recent {
                    self.recentDocuments.record(recent)
                    self.recentFiles = self.recentDocuments.entries
                    if let sourceURL {
                        self.sourceURLs[recent.id] = sourceURL
                        self.pruneSourceURLs()
                        if self.currentViewID == recent.id { self.documentResources.activate(token: self.documentViewTransitions.token, documentURL: sourceURL) }
                    }
                }
            }
        }
        if !submitted { showError("Too many pending files. Wait for the current file to finish, then retry.") }
    }

    func openDocumentPickerFromSidebar() {
        presentDocumentPicker()
    }

    /// Read a markdown file URL (security-scoped) and hand its content to the
    /// web layer. Shared by the document picker and by external opens — Files
    /// "Open in place", the share sheet, and "Open With… SpecDown" — routed here
    /// via SwiftUI's `.onOpenURL`.
    func openDocument(at url: URL, recentID: String? = nil) {
        readDocument(at: url, request: documentLoadAcceptance.beginRequest(), recentID: recentID)
    }

    func reopenRecent(_ entry: RecentDocuments.Entry) {
        readDocument(at: nil, request: documentLoadAcceptance.beginRequest(), recentID: entry.id)
    }

    /// Bookmark resolution and coordinated reading share one bounded worker slot
    /// and deadline. A blocked provider retains its slot until the worker exits.
    private func readDocument(at suppliedURL: URL?, request: DocumentLoadAcceptance.Request, recentID: String?) {
        guard documentLoadAcceptance.canDeliver(request) else { return }
        guard activeProviderReads.count < 4 else { showError("Several files are still waiting for their providers. Try again after they finish."); return }
        let operationID = UUID()
        let permit = DocumentReadPermit()
        activeProviderReads[operationID] = ProviderRead(request: request, permit: permit)
        let previous = recentID.flatMap { id in recentFiles.first { $0.id == id } }
        let filename = suppliedURL?.lastPathComponent ?? previous?.name ?? ""
        let timeout: TimeInterval = filename.lowercased().hasSuffix(".pdf") ? 120 : 15
        DispatchQueue.main.asyncAfter(deadline: .now() + timeout) { [weak self] in
            guard let self, self.activeProviderReads[operationID] != nil else { return }
            if self.documentLoadAcceptance.canDeliver(request) {
                if let previous { self.recentFailed(previous, request: request) }
                else { self.showError("This provider is taking too long. Download the file in Files, then choose it again.") }
            }
            permit.cancel()
            self.documentLoadAcceptance.cancel(request)
        }
        fileQueue.async { [weak self] in
            defer { Task { @MainActor [weak self] in _ = self?.activeProviderReads.removeValue(forKey: operationID) } }
            do {
                guard !permit.isCancelled else { throw CancellationError() }
                let url: URL
                if let suppliedURL { url = suppliedURL }
                else if let previous {
                    var stale = false
                    url = try URL(resolvingBookmarkData: previous.bookmark, options: [.withoutUI], relativeTo: nil, bookmarkDataIsStale: &stale)
                } else { throw CocoaError(.fileReadNoPermission) }
                guard !permit.isCancelled else { throw CancellationError() }
                let granted = url.startAccessingSecurityScopedResource()
                defer { if granted { url.stopAccessingSecurityScopedResource() } }
                var readError: NSError?
                var result: Result<(String, Data, URL), Error>?
                NSFileCoordinator().coordinate(readingItemAt: url, options: [], error: &readError) { coordinatedURL in
                    result = Result {
                        guard !permit.isCancelled else { throw CancellationError() }
                        let data = try SpecDownSecurityPolicy.readDocument(at: coordinatedURL)
                        let content: String
                        switch coordinatedURL.pathExtension.lowercased() {
                        case "pdf": content = try Self.extractPDFPages(data, permit: permit)
                        case "docx": content = data.base64EncodedString()
                        default:
                            guard let text = String(data: data, encoding: .utf8) else { throw CocoaError(.fileReadInapplicableStringEncoding) }
                            content = text
                        }
                        let bookmark = try coordinatedURL.bookmarkData(options: [], includingResourceValuesForKeys: nil, relativeTo: nil)
                        return (content, bookmark, coordinatedURL)
                    }
                }
                if let readError { throw readError }
                guard let result else { throw CocoaError(.fileReadUnknown) }
                let (content, bookmark, coordinatedURL) = try result.get()
                let entry = RecentDocuments.Entry(id: recentID ?? UUID().uuidString, name: coordinatedURL.lastPathComponent,
                    location: coordinatedURL.deletingLastPathComponent().path, bookmark: bookmark)
                Task { @MainActor [weak self] in
                    guard let self, self.documentLoadAcceptance.canDeliver(request) else { return }
                    self.deliverFile(name: entry.name, content: content, request: request, recent: entry, sourceURL: ["docx", "pdf"].contains(coordinatedURL.pathExtension.lowercased()) ? nil : coordinatedURL)
                }
            } catch {
                if error is CancellationError { return }
                Task { @MainActor [weak self] in
                    guard let self, self.documentLoadAcceptance.canDeliver(request) else { return }
                    if let pdfError = error as? PDFImportFailure { self.showError(pdfError.message) }
                    else if let previous { self.recentFailed(previous, request: request) }
                    else { self.showError("The file could not be opened. Choose an available file up to 8 MiB in Files, then try again.") }
                }
            }
        }
    }

    private struct PDFImportFailure: Error { let message: String }

    private struct ImportedPDFPage: Encodable {
        let text: String
        var recognized: String?
        var issue: String?
    }

    private nonisolated static func recognizePDFPage(_ page: PDFPage) throws -> String {
        guard let ref = page.pageRef else { throw PDFImportFailure(message: "Cannot render page.") }
        let box = ref.getBoxRect(.cropBox)
        let rotated = ref.rotationAngle % 180 != 0
        let w = rotated ? box.height : box.width
        let h = rotated ? box.width : box.height
        guard w.isFinite, h.isFinite, w > 0, h > 0 else { throw PDFImportFailure(message: "Invalid page size.") }
        let scale = min(3, 2200 / max(w, h))
        let width = max(1, Int(ceil(w * scale))), height = max(1, Int(ceil(h * scale)))
        guard let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8,
                                      bytesPerRow: 0, space: CGColorSpaceCreateDeviceGray(),
                                      bitmapInfo: CGImageAlphaInfo.none.rawValue) else {
            throw PDFImportFailure(message: "Cannot render page.")
        }
        let target = CGRect(x: 0, y: 0, width: width, height: height)
        context.setFillColor(gray: 1, alpha: 1)
        context.fill(target)
        context.concatenate(ref.getDrawingTransform(.cropBox, rect: target, rotate: 0, preserveAspectRatio: true))
        context.drawPDFPage(ref)
        guard let image = context.makeImage() else { throw PDFImportFailure(message: "Cannot render page.") }
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.recognitionLanguages = ["en-US"]
        try VNImageRequestHandler(cgImage: image).perform([request])
        return (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
    }

    private nonisolated static func extractPDFPages(_ data: Data, permit: DocumentReadPermit) throws -> String {
        guard let pdf = PDFDocument(data: data), pdf.pageCount > 0 else {
            throw PDFImportFailure(message: "Could not read this PDF.")
        }
        guard !pdf.isLocked, pdf.allowsCopying else {
            throw PDFImportFailure(message: "Choose an unlocked PDF that permits copying text.")
        }
        guard pdf.pageCount <= 500 else { throw PDFImportFailure(message: "Choose a PDF with 500 pages or fewer.") }
        var pages: [ImportedPDFPage] = []
        var attempts = 0
        let started = ProcessInfo.processInfo.systemUptime
        var bytes = 0
        for index in 0..<pdf.pageCount {
            guard !permit.isCancelled else { throw CancellationError() }
            guard let page = pdf.page(at: index) else { throw PDFImportFailure(message: "Could not read page \(index + 1).") }
            let text = page.string ?? ""
            let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
            var entry = ImportedPDFPage(text: text)
            if trimmed.unicodeScalars.filter(CharacterSet.alphanumerics.contains).count < 12 ||
                trimmed.range(of: #"^(?:Page\s+)?\d+(?:\s*(?:of|/)\s*\d+)?$"#, options: [.regularExpression, .caseInsensitive]) != nil {
                if attempts >= 24 || ProcessInfo.processInfo.systemUptime - started > 90 {
                    entry.issue = "OCR limit reached. Open this page in a smaller PDF."
                } else {
                    attempts += 1
                    do {
                        let recognized = try autoreleasepool { try recognizePDFPage(page) }
                        entry.recognized = recognized
                        if recognized.isEmpty { entry.issue = "OCR found no readable text." }
                    } catch { entry.issue = "Text recognition failed." }
                }
            }
            bytes += text.utf8.count + (entry.recognized?.utf8.count ?? 0)
            guard bytes <= SpecDownSecurityPolicy.maximumDocumentBytes else {
                throw PDFImportFailure(message: "Extracted PDF text exceeds 8 MiB.")
            }
            pages.append(entry)
        }
        return String(decoding: try JSONEncoder().encode(pages), as: UTF8.self)
    }

    private func pruneSourceURLs() {
        let retained = openSourceIDs.union(recentFiles.map(\.id))
        sourceURLs = sourceURLs.filter { retained.contains($0.key) }
    }

    func authorizeImageFolder(token: String) {
        guard token == documentViewTransitions.token, sourceURLs[currentViewID] != nil, activeImageFolderPicker == nil,
              let presenter = topViewController() else { return }
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.folder])
        picker.delegate = self
        picker.allowsMultipleSelection = false
        imageFolderPickers.setObject(token as NSString, forKey: picker)
        activeImageFolderPicker = picker
        presenter.present(picker, animated: true)
    }

    private func invalidateImageFolderPicker() {
        let picker = activeImageFolderPicker
        activeImageFolderPicker = nil
        picker?.dismiss(animated: true)
    }

    private func recentFailed(_ entry: RecentDocuments.Entry, request: DocumentLoadAcceptance.Request) {
        guard documentLoadAcceptance.canDeliver(request), let presenter = topViewController() else { return }
        let alert = UIAlertController(title: "File unavailable", message: "\(entry.name) may have moved, lost permission, or be offline. Download it in Files and retry, or locate the file. Your current document is unchanged.", preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Retry", style: .default) { [weak self] _ in self?.reopenRecent(entry) })
        alert.addAction(UIAlertAction(title: "Locate…", style: .default) { [weak self] _ in self?.presentDocumentPicker() })
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        presenter.present(alert, animated: true)
    }

    private func presentRecentFiles() {
        guard let presenter = topViewController() else { return }
        let sheet = UIAlertController(title: "Recent Files", message: recentFiles.isEmpty ? "Open a file from Files to remember it here." : "Choose a previously accepted file.", preferredStyle: .actionSheet)
        for entry in recentFiles {
            sheet.addAction(UIAlertAction(title: "\(entry.name) — \(entry.location)", style: .default) { [weak self] _ in self?.reopenRecent(entry) })
        }
        sheet.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        sheet.popoverPresentationController?.sourceView = presenter.view
        sheet.popoverPresentationController?.sourceRect = CGRect(x: presenter.view.bounds.midX, y: presenter.view.bounds.midY, width: 1, height: 1)
        presenter.present(sheet, animated: true)
    }

    func openBundledSampleFromSidebar(named fileName: String) {
        loadBundledSample(named: fileName)
    }

    private func evaluateJavaScript(
        function: String, arguments: [Any], context: String,
        completion: ((Any?, Error?) -> Void)? = nil
    ) {
        guard let webView else {
            print("[Bridge] Missing WKWebView for \(context)")
            return
        }

        do {
            let serializedArguments = try arguments
                .map(serializeJavaScriptArgument)
                .joined(separator: ", ")
            webView.evaluateJavaScript("\(function)(\(serializedArguments))") { result, error in
                if let error = error {
                    print("[Bridge] \(context) error: \(error)")
                }
                completion?(result, error)
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

    // Save replies describe local provider completion, never remote synchronization.
    private func markdownSaveReply(_ requestID: String, _ result: [String: Any]) {
        activeMarkdownSaves.remove(requestID)
        evaluateJavaScript(function: "window.specdownSourceSaveResult", arguments: [requestID, result], context: "saveMarkdown")
    }

    private func saveMarkdown(_ request: [String: Any]) {
        guard let requestID = request["requestID"] as? String, requestID.count <= 80,
              let content = request["content"] as? String, content.utf8.count <= 8 * 1024 * 1024,
              let expected = request["expected"] as? String, expected.utf8.count <= 8 * 1024 * 1024,
              !activeMarkdownSaves.contains(requestID) else { return }
        activeMarkdownSaves.insert(requestID)
        let sourceID = request["sourceID"] as? String ?? ""
        let copy = request["copy"] as? Bool ?? false
        guard !copy, let url = sourceURLs[sourceID], !["docx", "pdf"].contains(url.pathExtension.lowercased()), openSourceIDs.contains(sourceID) else {
            exportMarkdown(requestID: requestID, content: content, filename: request["filename"] as? String ?? "Document.md")
            return
        }
        fileQueue.async { [weak self] in
            var response: [String: Any] = ["status": "error", "message": "Provider save failed. Draft retained. Retry or Save As."]
            let granted = url.startAccessingSecurityScopedResource()
            defer { if granted { url.stopAccessingSecurityScopedResource() } }
            var coordinationError: NSError?
            NSFileCoordinator().coordinate(writingItemAt: url, options: .forReplacing, error: &coordinationError) { coordinatedURL in
                do {
                    let bytes = try SpecDownSecurityPolicy.readDocument(at: coordinatedURL)
                    guard let current = String(data: bytes, encoding: .utf8) else { throw CocoaError(.fileReadInapplicableStringEncoding) }
                    if current != expected { response = ["status": "conflict", "content": current]; return }
                    try Data(content.utf8).write(to: coordinatedURL, options: .atomic)
                    response = ["status": "saved"]
                } catch { /* Keep error response and the renderer draft. */ }
            }
            if coordinationError != nil { response = ["status": "error", "message": "The file provider could not complete the local save. Draft retained. Retry or Save As."] }
            let result = response
            Task { @MainActor [weak self] in self?.markdownSaveReply(requestID, result) }
        }
    }

    private func exportMarkdown(requestID: String, content: String, filename: String) {
        guard markdownExportPicker == nil, let presenter = topViewController() else {
            markdownSaveReply(requestID, ["status": "error", "message": "Finish the current destination chooser, then retry. Draft retained."])
            return
        }
        do {
            let folder = FileManager.default.temporaryDirectory.appendingPathComponent("specdown-markdown-" + UUID().uuidString, isDirectory: true)
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            let base = (filename as NSString).lastPathComponent
            let name = base.lowercased().hasSuffix(".md") || base.lowercased().hasSuffix(".markdown") ? base : base + ".md"
            let url = folder.appendingPathComponent(name.isEmpty ? "Document.md" : name)
            try Data(content.utf8).write(to: url, options: .atomic)
            let picker = UIDocumentPickerViewController(forExporting: [url], asCopy: true)
            picker.delegate = self
            markdownExports[ObjectIdentifier(picker)] = MarkdownExport(requestID: requestID, temporaryURL: url, content: content)
            markdownExportPicker = picker
            presenter.present(picker, animated: true)
        } catch { markdownSaveReply(requestID, ["status": "error", "message": "Could not prepare the Markdown copy. Draft retained."]) }
    }

    private func finishMarkdownExport(_ controller: UIDocumentPickerViewController, destination: URL?) -> Bool {
        guard let export = markdownExports.removeValue(forKey: ObjectIdentifier(controller)) else { return false }
        markdownExportPicker = nil
        defer { try? FileManager.default.removeItem(at: export.temporaryURL.deletingLastPathComponent()) }
        guard let destination else { markdownSaveReply(export.requestID, ["status": "canceled"]); return true }
        // The export picker completion confirms provider acceptance. Reusable
        // source access is a separate capability and may not be returned.
        var result: [String: Any] = ["status": "saved", "copied": true, "filename": destination.lastPathComponent]
        let granted = destination.startAccessingSecurityScopedResource()
        defer { if granted { destination.stopAccessingSecurityScopedResource() } }
        if let bookmark = try? destination.bookmarkData(options: [], includingResourceValuesForKeys: nil, relativeTo: nil) {
            let id = UUID().uuidString
            sourceURLs[id] = destination
            let entry = RecentDocuments.Entry(id: id, name: destination.lastPathComponent, location: destination.deletingLastPathComponent().path, bookmark: bookmark)
            recentDocuments.record(entry); recentFiles = recentDocuments.entries
            result["sourceMeta"] = ["nativeDocument": ["id": id]]
        }
        markdownSaveReply(export.requestID, result)
        return true
    }

    // MARK: - Native integrations

    private func presentDocumentPicker() {
        var types: [UTType] = [.plainText, .utf8PlainText, .sourceCode, .json, .xml, .pdf]
        if let word = UTType(filenameExtension: "docx") { types.append(word) }
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

    func presentURLInput(from source: UIView, sourceRect: CGRect? = nil) {
        guard urlInputController == nil, source.window != nil else { return }
        // The welcome button becomes interactive before didFinish/readiness
        // polling completes. Preserve that first tap just like a cold file open.
        guard pageLoaded else {
            pendingURLInputSource = source
            pendingURLInputRect = sourceRect
            return
        }
        guard let webView, let presenter = topViewController(),
              !presenter.isBeingDismissed, !(presenter is UIAlertController),
              !(presenter is UIDocumentPickerViewController) else { return }
        let controller = NativeURLInputController(webView: webView)
        urlInputController = controller
        controller.onClose = { [weak self] in self?.urlInputController = nil }
        if source.traitCollection.horizontalSizeClass == .regular {
            controller.modalPresentationStyle = .popover
            controller.popoverPresentationController?.sourceView = source
            controller.popoverPresentationController?.sourceRect = sourceRect ?? source.bounds
            controller.popoverPresentationController?.delegate = controller
        } else {
            controller.modalPresentationStyle = .pageSheet
            controller.sheetPresentationController?.detents = [.medium(), .large()]
            controller.sheetPresentationController?.prefersGrabberVisible = true
        }
        controller.presentationController?.delegate = controller
        presenter.present(controller, animated: true)
    }


}

extension WebBridge: UIDocumentPickerDelegate {
    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        if finishMarkdownExport(controller, destination: urls.first) { return }
        guard let url = urls.first else { return }
        // Remember weak controller identity even after invalidation/cancellation:
        // stale folder callbacks must never fall through to normal file opening.
        if let storedToken = imageFolderPickers.object(forKey: controller) {
            let token = storedToken as String
            guard controller === activeImageFolderPicker else { return }
            activeImageFolderPicker = nil
            guard token == documentViewTransitions.token else { return }
            guard documentResources.grant(root: url, token: token) else {
                showError("Choose the folder containing this Markdown document to allow its relative images.")
                return
            }
            evaluateJavaScript(function: "window.specdownReloadImages", arguments: [token], context: "reloadImages")
            return
        }
        openDocument(at: url)
    }

    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        if finishMarkdownExport(controller, destination: nil) { return }
        if controller === activeImageFolderPicker { activeImageFolderPicker = nil }
    }
}
