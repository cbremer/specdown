import UIKit
import UniformTypeIdentifiers

/// Owns every presented sheet and temporary file until a terminal callback.
@MainActor
final class NativeDiagramExport: NSObject, UIDocumentPickerDelegate {
    enum Destination { case files, share }
    private static var cleanedPreviousProcess = false
    private let files = DiagramExportFiles()
    private weak var presented: UIViewController?
    private weak var presenter: UIViewController?
    private var token: String?
    private var requestID: String?
    private var choosing = false
    var onError: ((String) -> Void)?

    override init() {
        super.init()
        if !Self.cleanedPreviousProcess {
            DiagramExportFiles.cleanAbandoned()
            Self.cleanedPreviousProcess = true
        }
    }

    func begin(format: String, payload: String, token: String, requestID: String, presenter: UIViewController) {
        guard self.token == nil, presenter.presentedViewController == nil else { onError?("Finish the current export before exporting another diagram."); return }
        do {
            _ = try files.stage(format: format, payload: payload)
            self.token = token
            let lifecycleID = UUID().uuidString
            self.requestID = lifecycleID
            self.presenter = presenter
            let chooser = UIAlertController(title: "Export Diagram", message: "Choose where to send the \(format.uppercased()) file.", preferredStyle: .actionSheet)
            chooser.addAction(UIAlertAction(title: "Save to Files…", style: .default) { [weak self] _ in self?.choose(.files, lifecycleID: lifecycleID) })
            chooser.addAction(UIAlertAction(title: "Share…", style: .default) { [weak self] _ in self?.choose(.share, lifecycleID: lifecycleID) })
            chooser.addAction(UIAlertAction(title: "Cancel", style: .cancel) { [weak self] _ in
                if self?.requestID == lifecycleID { self?.finish() }
            })
            anchor(chooser, in: presenter)
            presented = chooser
            presenter.present(chooser, animated: true)
        } catch { files.clean(); onError?("The diagram could not be exported. SVG is limited to 2 MiB; PNG to 8 MiB and 16 million pixels.") }
    }

    /// Transition only after the chooser has left the presentation hierarchy.
    /// This also covers UIKit invoking an action after automatic dismissal.
    func choose(_ destination: Destination, lifecycleID: String) {
        guard lifecycleID == requestID else { return }
        guard !choosing, let requestID, let url = files.activeURL, let presenter,
              let chooser = presented as? UIAlertController else { return }
        choosing = true
        let show = { [weak self, weak presenter] in
            guard let self, self.requestID == requestID, let presenter else { return }
            self.choosing = false
            switch destination {
            case .files:
                let picker = UIDocumentPickerViewController(forExporting: [url], asCopy: true)
                picker.delegate = self
                self.presented = picker
                presenter.present(picker, animated: true)
            case .share:
                let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
                self.anchor(sheet, in: presenter)
                sheet.completionWithItemsHandler = { [weak self] _, _, _, error in
                    guard self?.requestID == requestID else { return }
                    if error != nil { self?.onError?("The diagram could not be shared. Try Save to Files instead.") }
                    self?.finish()
                }
                self.presented = sheet
                presenter.present(sheet, animated: true)
            }
        }
        if chooser.presentingViewController != nil { chooser.dismiss(animated: true, completion: show) }
        else { show() }
    }

    func invalidate(unless current: String) {
        guard let token, token != current else { return }
        let controller = presented
        finish()
        controller?.dismiss(animated: true)
    }
    private func anchor(_ sheet: UIViewController, in presenter: UIViewController) {
        sheet.popoverPresentationController?.sourceView = presenter.view
        sheet.popoverPresentationController?.sourceRect = CGRect(x: presenter.view.bounds.midX, y: presenter.view.bounds.midY, width: 1, height: 1)
    }
    private func finish() { files.clean(); token = nil; requestID = nil; presented = nil; presenter = nil; choosing = false }
    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        guard controller === presented else { return }; finish()
    }
    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard controller === presented else { return }; finish()
    }
}
