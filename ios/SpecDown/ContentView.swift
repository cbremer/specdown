import SwiftUI

struct ContentView: View {
    @StateObject private var bridge = WebBridge()
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        WebView(bridge: bridge)
            .ignoresSafeArea()
            .onChange(of: colorScheme) { newScheme in
                bridge.applyTheme(newScheme)
            }
    }
}
