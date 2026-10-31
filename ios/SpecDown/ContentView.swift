import SwiftUI

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
                Button {
                    bridge.openDocumentPickerFromSidebar()
                } label: {
                    Label("Open Markdown File", systemImage: "doc.badge.plus")
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

            // "Recent" returns in 1.1, once picked files can be reopened via
            // security-scoped bookmarks (it listed names that couldn't be tapped).
        }
        .listStyle(.sidebar)
        .navigationTitle("SpecDown")
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
