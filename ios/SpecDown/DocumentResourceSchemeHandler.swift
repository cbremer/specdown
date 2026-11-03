import Foundation
import WebKit

/// Callback ownership is kept on the main queue; cancelled tasks never receive
/// callbacks, even when a slow cloud-provider read completes much later.
final class DocumentResourceSchemeHandler: NSObject, WKURLSchemeHandler {
    let resources: DocumentResources
    private var tasks = Set<ObjectIdentifier>()
    private let queue = DispatchQueue(label: "specdown.images", qos: .userInitiated)
    init(resources: DocumentResources) { self.resources = resources }

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        let id = ObjectIdentifier(task)
        tasks.insert(id)
        guard let url = task.request.url, url.scheme == "specdown-resource", let token = url.host,
              url.user == nil, url.password == nil, url.port == nil, url.query == nil, url.fragment == nil,
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            tasks.remove(id)
            task.didFailWithError(URLError(.badURL))
            return
        }
        let path = String(components.percentEncodedPath.dropFirst())
        queue.async { [weak self] in
            guard let self else { return }
            let result = Result { try self.resources.read(token: token, relative: path) }
            DispatchQueue.main.async { [weak self] in
                guard let self, self.tasks.remove(id) != nil else { return }
                guard self.resources.isCurrent(token) else { task.didFailWithError(URLError(.cancelled)); return }
                switch result {
                case .success(let image):
                    task.didReceive(URLResponse(url: url, mimeType: image.mime, expectedContentLength: image.data.count, textEncodingName: nil))
                    task.didReceive(image.data)
                    task.didFinish()
                case .failure:
                    task.didFailWithError(URLError(.noPermissionsToReadFile))
                }
            }
        }
    }
    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) { tasks.remove(ObjectIdentifier(task)) }
}
