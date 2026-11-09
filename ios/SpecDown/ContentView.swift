import SwiftUI
import WebKit

struct ContentView: View {
    @StateObject private var bridge = WebBridge()
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    private var usesExpandedShell: Bool {
        horizontalSizeClass == .regular
    }

    var body: some View {
        Group {
            if #available(iOS 17.0, *) {
                // Keep one split view and detail identity while the scene folds,
                // rotates or changes size. Native columns also avoid Duo's bars.
                AdaptiveViewerShell(bridge: bridge, sidebar: sidebar)
            } else if usesExpandedShell {
                NavigationSplitView {
                    sidebar
                } detail: {
                    viewerSurface
                        .navigationTitle(bridge.hasLoadedDocument ? bridge.currentDocumentName : "SpecDown")
                        .navigationBarTitleDisplayMode(.inline)
                }
                .navigationSplitViewStyle(.balanced)
            } else {
                viewerSurface
            }
        }
            .sheet(isPresented: $bridge.showsAppIconPicker) { AppIconPicker() }
            .onAppear {
                bridge.applyTheme(colorScheme)
            }
            .onChange(of: colorScheme) { newScheme in
                bridge.applyTheme(newScheme)
            }
            // Markdown files opened from outside the app — Files "Open in place",
            // the share sheet, or "Open With… SpecDown" — arrive here.
            .onOpenURL { url in
                bridge.openDocument(at: url)
            }
    }

    private var viewerSurface: some View {
        // Readable and interactive content respects all four native safe edges.
        // Only backgrounds may extend behind a persistent vertical system bar.
        GeometryReader { geometry in
            WebView(bridge: bridge, layoutMode: usesExpandedShell && geometry.size.width > 768 ? "pad" : "phone")
        }
    }

    private var sidebar: some View {
        List {
            Section("Open") {
                NativeURLButton(bridge: bridge)
                Button {
                    bridge.openDocumentPickerFromSidebar()
                } label: {
                    Label("Open File", systemImage: "doc.badge.plus")
                }
            }

            Section("Appearance") {
                Button { bridge.showsAppIconPicker = true } label: {
                    Label("App Icon", systemImage: "app.badge")
                }
            }

            Section("Samples") {
                Button {
                    bridge.openBundledSampleFromSidebar(named: "sample.md")
                } label: {
                    Label("Open Sample", systemImage: "doc.text")
                }

                Button {
                    bridge.openBundledSampleFromSidebar(named: "diagram-showcase.md")
                } label: {
                    Label("Open Diagram Showcase", systemImage: "chart.xyaxis.line")
                }
            }

            Section("Recent Files") {
                ForEach(bridge.recentFiles) { entry in
                    Button { bridge.reopenRecent(entry) } label: {
                        VStack(alignment: .leading) {
                            Text(entry.name)
                            Text(entry.location).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
                if bridge.recentFiles.isEmpty { Text("Open a file to remember it here.").foregroundStyle(.secondary) }
            }
        }
        .listStyle(.sidebar)
        .navigationTitle("SpecDown")
    }
}

/// A real source control keeps the popover attached to its sidebar command.
private struct NativeURLButton: UIViewRepresentable {
    let bridge: WebBridge
    func makeUIView(context: Context) -> UIButton {
        var configuration = UIButton.Configuration.plain()
        configuration.title = "Open from URL…"
        configuration.image = UIImage(systemName: "link")
        configuration.imagePadding = 8
        configuration.contentInsets = .zero
        let button = UIButton(configuration: configuration)
        button.contentHorizontalAlignment = .leading
        button.titleLabel?.adjustsFontForContentSizeCategory = true
        button.addAction(UIAction { [weak bridge, weak button] _ in
            guard let button else { return }
            bridge?.presentURLInput(from: button)
        }, for: .touchUpInside)
        return button
    }
    func updateUIView(_ button: UIButton, context: Context) {}
}

@MainActor
final class NativeURLInputState: ObservableObject {
    @Published var url = ""
    @Published var error = ""
    @Published var loading = false
    var onSubmit: () -> Void = {}
    var onCancel: () -> Void = {}
}

struct NativeURLInputForm: View {
    @ObservedObject var model: NativeURLInputState
    @FocusState private var urlFocused: Bool

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("https://example.com/document.md", text: $model.url)
                        .accessibilityLabel("URL")
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .submitLabel(.go)
                        .focused($urlFocused)
                        .disabled(model.loading)
                        .onSubmit { model.onSubmit() }
                    if !model.error.isEmpty {
                        Text(model.error).foregroundStyle(.red)
                            .accessibilityIdentifier("url-entry-error")
                    }
                } header: { Text("URL") } footer: {
                    Text("Open an HTTPS Markdown file or browse a public GitHub repository, branch or folder.")
                }
                if model.loading {
                    ProgressView("Opening…")
                }
            }
            .navigationTitle("Open from URL")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { model.onCancel() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Open") { model.onSubmit() }
                        .disabled(model.loading || model.url.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
        .onAppear { urlFocused = true }
    }
}

/// Owns one native form and one renderer request. Dismissal invalidates both.
@MainActor
final class NativeURLInputController: UIHostingController<NativeURLInputForm>, UIPopoverPresentationControllerDelegate {
    let model: NativeURLInputState
    private weak var webView: WKWebView?
    private var requestID: String?
    var onClose: () -> Void = {}
    private var closed = false

    init(webView: WKWebView) {
        let model = NativeURLInputState()
        self.model = model
        self.webView = webView
        super.init(rootView: NativeURLInputForm(model: model))
        preferredContentSize = CGSize(width: 420, height: 340)
        model.onSubmit = { [weak self] in self?.submit() }
        model.onCancel = { [weak self] in self?.cancel() }
    }
    @MainActor required dynamic init?(coder aDecoder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func submit() {
        guard !closed, !model.loading, let webView else { return }
        let url = model.url.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !url.isEmpty else { return }
        let id = UUID().uuidString
        requestID = id
        model.error = ""
        model.loading = true
        Task { [weak self, weak webView] in
            guard let webView, self?.closed == false, self?.requestID == id else { return }
            do {
                let value = try await webView.callAsyncJavaScript(
                    "return await window.specdownSubmitURL(url, id)", arguments: ["url": url, "id": id], in: nil, contentWorld: .page)
                guard let self, !self.closed, self.requestID == id else { return }
                let result = value as? [String: Any]
                let status = result?["status"] as? String
                self.model.loading = false
                if status == "document" || status == "repository" {
                    self.closed = true
                    self.requestID = nil
                    self.dismiss(animated: true) { [weak self, weak webView] in
                        self?.onClose()
                        webView?.evaluateJavaScript("window.specdownFinishURL('\(id)')")
                    }
                } else {
                    self.model.error = status == "stale" ? "The document changed. Open the URL again to continue." : (result?["message"] as? String ?? "Could not open this URL. Please try again.")
                    UIAccessibility.post(notification: .announcement, argument: self.model.error)
                }
            } catch {
                guard let self, !self.closed, self.requestID == id else { return }
                self.model.loading = false
                self.model.error = "Could not open this URL. Please try again."
            }
        }
    }

    func cancel(dismissForm: Bool = true) {
        guard !closed else { return }
        closed = true
        if let id = requestID {
            webView?.evaluateJavaScript("window.specdownCancelURL('\(id)')")
        }
        requestID = nil
        model.loading = false
        onClose()
        if dismissForm { dismiss(animated: true) }
    }
    func presentationControllerDidDismiss(_ presentationController: UIPresentationController) { cancel(dismissForm: false) }
    func popoverPresentationControllerDidDismissPopover(_ popoverPresentationController: UIPopoverPresentationController) { cancel(dismissForm: false) }
    func adaptivePresentationStyle(for controller: UIPresentationController, traitCollection: UITraitCollection) -> UIModalPresentationStyle {
        traitCollection.horizontalSizeClass == .compact ? .pageSheet : .none
    }
}

// The compact-column preference was added in iOS 17. iOS 16 retains its
// existing shell above; both paths retain their renderer in the scene bridge.
@available(iOS 17.0, *)
private struct AdaptiveViewerShell<Sidebar: View>: View {
    @ObservedObject var bridge: WebBridge
    let sidebar: Sidebar
    @State private var compactColumn: NavigationSplitViewColumn = .detail

    var body: some View {
        NavigationSplitView(preferredCompactColumn: $compactColumn) {
            sidebar
        } detail: {
            AdaptiveViewerDetail(bridge: bridge)
        }
        .navigationSplitViewStyle(.balanced)
        .onChange(of: bridge.viewerPresentationRequest) { _ in
            // Sidebar buttons are not navigation links. A chosen file or error
            // must bring the viewer back even when the columns have collapsed.
            compactColumn = .detail
        }
    }
}

private struct AdaptiveViewerDetail: View {
    @ObservedObject var bridge: WebBridge
    // This environment belongs to the detail column, not the split-view parent.
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var body: some View {
        GeometryReader { geometry in
            // Match the shared viewer's 768px responsive breakpoint. A regular
            // split-view scene can still offer a narrow detail column; that
            // column needs the compact Contents/Raw/More controls.
            WebView(bridge: bridge, layoutMode: horizontalSizeClass == .regular && geometry.size.width > 768 ? "pad" : "phone")
        }
            .navigationTitle(bridge.hasLoadedDocument ? bridge.currentDocumentName : "SpecDown")
            .navigationBarTitleDisplayMode(.inline)
            // Native navigation remains available beside a regular-width
            // sidebar; renderer actions depend on the actual detail width.
            .toolbar(horizontalSizeClass == .regular ? .visible : .hidden, for: .navigationBar)
    }
}
