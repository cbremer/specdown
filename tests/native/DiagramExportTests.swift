import Foundation

@main
struct DiagramExportTests {
    static func main() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let exports = DiagramExportFiles(root: root)
        let svg = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 20 10\"><text>synthetic</text></svg>"
        let url = try exports.stage(format: "svg", payload: svg)
        precondition(url.pathExtension == "svg")
        let exact = try String(contentsOf: url, encoding: .utf8)
        precondition(exact == svg)
        do { _ = try exports.stage(format: "svg", payload: svg); preconditionFailure("Concurrent export staged") } catch { }
        exports.clean()
        precondition(!FileManager.default.fileExists(atPath: url.path))
        for bad in ["<svg><script>alert(1)</script></svg>", "<svg><image href=\"file:///secret\"/></svg>", "<!DOCTYPE svg [<!ENTITY a SYSTEM 'file:///secret'>]><svg>&a;</svg>", "<svg onload=\"x()\"/>", "<svg><style>@import 'https://example.test/x';</style></svg>", "<svg xmlns=\"http://www.w3.org/2000/svg\"><foreignObject><img xmlns=\"http://www.w3.org/1999/xhtml\" srcset=\"https://example.test/a.png 1x\"/></foreignObject></svg>", "<svg xmlns=\"http://www.w3.org/2000/svg\"><style>.x{background-image:image-set('https://example.test/a.png' 1x)}</style></svg>", "<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:x=\"http://www.w3.org/1999/xlink\"><use x:href=\"https://example.test/a.svg#x\"/></svg>", "<?xml-stylesheet href=\"https://example.test/a.css\"?><svg xmlns=\"http://www.w3.org/2000/svg\"/>", "not svg"] {
            do { _ = try exports.stage(format: "svg", payload: bad); preconditionFailure("Unsafe SVG staged") } catch { }
        }
        do { _ = try exports.stage(format: "svg", payload: String(repeating: "x", count: 2 * 1024 * 1024 + 1)); preconditionFailure("Oversized SVG staged") } catch { }
        let png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
        let pngURL = try exports.stage(format: "png", payload: png)
        let exactPNG = try Data(contentsOf: pngURL)
        precondition(exactPNG == Data(base64Encoded: png), "PNG bytes changed during export")
        exports.clean()
        let markerSVG = "<svg xmlns=\"http://www.w3.org/2000/svg\"><style>.edge { marker-end: url('#arrow'); filter:drop-shadow(1px 2px 2px rgba(185,185,185,1)); }</style><path style=\"fill:url(#paint)\"/></svg>"
        _ = try exports.stage(format: "svg", payload: markerSVG)
        exports.clean()
        // Safe constructs emitted by the bundled sequence/Gantt/git/journey
        // diagrams must survive the resource-free policy.
        for validSVG in [
            "<svg xmlns=\"http://www.w3.org/2000/svg\"><rect name=\"API\"/></svg>",
            "<svg xmlns=\"http://www.w3.org/2000/svg\"><text transform-origin=\"83px 60px\">Task</text></svg>",
            "<svg xmlns=\"http://www.w3.org/2000/svg\"><text xml:space=\"preserve\">Branch label</text></svg>",
            "<svg xmlns=\"http://www.w3.org/2000/svg\"><switch><foreignObject><div xmlns=\"http://www.w3.org/1999/xhtml\">Journey label</div></foreignObject><text>Label</text></switch></svg>",
        ] {
            _ = try exports.stage(format: "svg", payload: validSVG)
            exports.clean()
        }
        do { _ = try exports.stage(format: "png", payload: "not png"); preconditionFailure("Invalid PNG staged") } catch { }
        print("Diagram exports: exact bytes, concurrent exclusion, cleanup, unsafe XML and payload limits passed")
    }
}
