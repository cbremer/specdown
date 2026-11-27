import SwiftUI

@main
struct SpecDownApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .commands { ReaderMenuCommands() }
    }
}

private struct ReaderMenuCommands: Commands {
    @FocusedObject private var bridge: WebBridge?

    var body: some Commands {
        CommandGroup(after: .toolbar) {
            Button(bridge?.readerMenuHasSelection == true ? "Read Selection" : "Read from Here") {
                bridge?.performReaderAction("read")
            }
            .keyboardShortcut("r", modifiers: [.option, .command])
            .disabled(bridge?.readerMenuAvailable != true)
            Button("Explain…") { bridge?.performReaderAction("explain") }
                .keyboardShortcut("e", modifiers: [.option, .command])
                .disabled(bridge?.readerMenuAvailable != true)
        }
    }
}
