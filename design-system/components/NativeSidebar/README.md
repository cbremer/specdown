# NativeSidebar

iPad/iPhone sidebar: the SwiftUI `NavigationSplitView` column beside the viewer.

**Source:** `ios/SpecDown/ContentView.swift`. A static rendition with Apple system colours. It's native UI and isn't styled with SpecDown tokens.

- `List` with `.listStyle(.sidebar)`, titled "SpecDown". Sections: Open, Appearance, Samples, Recent Files.
- Rows are `Label`s with SF Symbols (`link`, `doc.badge.plus`, `app.badge`, `doc.text`, `chart.xyaxis.line`) in the system tint.
- Recent rows: name, with the location in `.caption` `.secondary` below. Empty state: "Open a file to remember it here."
- Picking a row brings the detail (viewer) column back even when collapsed.
