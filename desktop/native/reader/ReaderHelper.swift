import Foundation

/// The main process owns this pipe for one viewer page. Neither command-line
/// arguments nor files carry the reader's document, questions or answers.
@main
struct ReaderHelper {
    @MainActor
    static func main() async {
        let services = AppleReaderServices(
            speechEvent: { send(["event": $0]) },
            explainResult: { id, result in send(["requestId": id, "result": result]) }
        )
        do {
            for try await line in FileHandle.standardInput.bytes.lines {
                guard let command = try JSONSerialization.jsonObject(with: Data(line.utf8)) as? [String: Any],
                      let action = command["action"] as? String,
                      let data = command["data"] as? [String: Any] else { break }
                if action == "speech" {
                    services.speech(data)
                } else {
                    services.explain(action: action, data: data)
                }
            }
        } catch {
            // EOF, a broken pipe or an invalid packet ends this page's session.
        }
        services.reset()
    }

    static func send(_ payload: [String: Any]) {
        guard var bytes = try? JSONSerialization.data(withJSONObject: payload) else { return }
        bytes.append(0x0a)
        try? FileHandle.standardOutput.write(contentsOf: bytes)
    }
}
