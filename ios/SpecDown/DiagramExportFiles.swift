import Foundation
import ImageIO

/// Bounded, single-flight staging. Imported paths never control output names.
final class DiagramExportFiles {
    enum Failure: Error { case busy, invalid, limit }
    let root: URL
    private(set) var activeURL: URL?
    init(root: URL = FileManager.default.temporaryDirectory.appendingPathComponent("specdown-diagram-\(UUID())")) { self.root = root }
    deinit { clean() }

    /// Called once at process startup, before any scene can start an export.
    static func cleanAbandoned(in directory: URL = FileManager.default.temporaryDirectory) {
        guard let children = try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil) else { return }
        for child in children where child.lastPathComponent.hasPrefix("specdown-diagram-") {
            try? FileManager.default.removeItem(at: child)
        }
    }

    func stage(format: String, payload: String) throws -> URL {
        guard activeURL == nil else { throw Failure.busy }
        let data: Data
        switch format {
        case "svg":
            guard payload.utf8.count <= 2 * 1024 * 1024 else { throw Failure.limit }
            data = Data(payload.utf8)
            let validator = DiagramSVGValidator()
            let parser = XMLParser(data: data)
            parser.shouldResolveExternalEntities = false
            parser.shouldProcessNamespaces = true
            parser.delegate = validator
            guard !payload.localizedCaseInsensitiveContains("<!DOCTYPE"),
                  !payload.localizedCaseInsensitiveContains("<!ENTITY"),
                  parser.parse(), validator.valid, validator.sawSVG else { throw Failure.invalid }
        case "png":
            guard payload.utf8.count <= 12 * 1024 * 1024,
                  let decoded = Data(base64Encoded: payload), decoded.count <= 8 * 1024 * 1024,
                  let image = CGImageSourceCreateWithData(decoded as CFData, [kCGImageSourceShouldCache: false] as CFDictionary),
                  CGImageSourceGetType(image) as String? == "public.png", CGImageSourceGetCount(image) == 1,
                  let props = CGImageSourceCopyPropertiesAtIndex(image, 0, nil) as? [CFString: Any],
                  let width = props[kCGImagePropertyPixelWidth] as? Int,
                  let height = props[kCGImagePropertyPixelHeight] as? Int,
                  width > 0, height > 0, width <= 8192, height <= 8192, width <= 16_000_000 / height else { throw Failure.invalid }
            data = decoded
        default: throw Failure.invalid
        }
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let url = root.appendingPathComponent("Diagram-\(UUID()).\(format)")
        try data.write(to: url, options: .atomic)
        activeURL = url
        return url
    }

    func clean() {
        try? FileManager.default.removeItem(at: root)
        activeURL = nil
    }
}

private final class DiagramSVGValidator: NSObject, XMLParserDelegate {
    var valid = true
    var sawSVG = false
    private var depth = 0
    private var foreignDepths: [Int] = []
    private var styleDepth: Int?
    private var style = ""
    private static let svgElements = Set("svg g defs desc title style path rect circle ellipse line polyline polygon text tspan textpath marker filter fegaussianblur feoffset femerge femergenode fecolormatrix fecomposite feblend feflood fedropshadow fecomponenttransfer fefunca fefuncb fefuncg fefuncr feconvolvematrix fediffuselighting fedisplacementmap fedistantlight femorphology fepointlight fespecularlighting fespotlight fetile feturbulence lineargradient radialgradient stop pattern clippath mask symbol use foreignobject switch a".split(separator: " ").map(String.init))
    private static let htmlElements = Set(["div", "span", "p", "br", "strong", "em", "b", "i", "small", "sub", "sup"])
    private static let svgAttributes = Set("name space transform-origin id class style width height viewbox preserveaspectratio role x y z x1 x2 y1 y2 cx cy r rx ry dx dy d points transform opacity fill fill-opacity fill-rule stroke stroke-width stroke-opacity stroke-linecap stroke-linejoin stroke-miterlimit stroke-dasharray stroke-dashoffset clip-path clip-rule filter mask cursor marker-start marker-mid marker-end refx refy markerwidth markerheight markerunits orient font-family font-size font-weight font-style font-variant text-anchor textlength lengthadjust dominant-baseline alignment-baseline direction unicode-bidi visibility display overflow version href gradientunits gradienttransform spreadmethod fx fy fr offset stop-color stop-opacity patternunits patterncontentunits patterntransform stddeviation mode in in2 result operator k1 k2 k3 k4 values type color-interpolation-filters flood-color flood-opacity lighting-color surfacescale diffuseconstant specularconstant specularexponent limitingconeangle pointsatx pointsaty pointsatz azimuth elevation kernelmatrix order divisor bias targetx targety edgemode kernelunitlength preservealpha basefrequency numoctaves seed stitchtiles scale xchannelselector ychannelselector slope intercept amplitude exponent tablevalues".split(separator: " ").map(String.init))
    private static let htmlAttributes = Set(["id", "class", "style", "dir", "lang", "title"])
    private static let cssFunctions = Set("drop-shadow blur brightness contrast grayscale hue-rotate invert opacity saturate sepia url rgb rgba hsl hsla hwb lab lch oklab oklch color color-mix calc var min max clamp translate translatex translatey translatez translate3d scale scalex scaley scalez scale3d rotate rotatex rotatey rotatez rotate3d matrix matrix3d skew skewx skewy perspective cubic-bezier steps linear not is where has nth-child nth-last-child nth-of-type nth-last-of-type".split(separator: " ").map(String.init))
    private static let comments = try! NSRegularExpression(pattern: #"/\*[\s\S]*?\*/"#)
    private static let functions = try! NSRegularExpression(pattern: #"([a-zA-Z_-][a-zA-Z0-9_-]*)\s*\("#)
    private static let urls = try! NSRegularExpression(pattern: #"url\(([^)]*)\)"#, options: .caseInsensitive)
    private static let atRules = try! NSRegularExpression(pattern: #"@([a-zA-Z-]+)"#)

    private func cssAllowed(_ input: String) -> Bool {
        guard !input.contains("\\") else { return false }
        let text = Self.comments.stringByReplacingMatches(in: input, range: NSRange(input.startIndex..., in: input), withTemplate: "")
        let range = NSRange(text.startIndex..., in: text)
        for match in Self.functions.matches(in: text, range: range) {
            guard let name = Range(match.range(at: 1), in: text), Self.cssFunctions.contains(text[name].lowercased()) else { return false }
        }
        for match in Self.atRules.matches(in: text, range: range) {
            guard let name = Range(match.range(at: 1), in: text), ["keyframes", "-webkit-keyframes", "media", "supports"].contains(text[name].lowercased()) else { return false }
        }
        return Self.urls.matches(in: text, range: range).allSatisfy { match in
            guard let valueRange = Range(match.range(at: 1), in: text) else { return false }
            return text[valueRange].trimmingCharacters(in: CharacterSet(charactersIn: " \t\r\n'\"")).hasPrefix("#")
        }
    }
    func parser(_ parser: XMLParser, didStartElement elementName: String, namespaceURI: String?, qualifiedName: String?, attributes: [String: String]) {
        depth += 1
        let element = elementName.lowercased()
        let svg = namespaceURI == "http://www.w3.org/2000/svg"
        let html = namespaceURI == "http://www.w3.org/1999/xhtml" && !foreignDepths.isEmpty
        if depth == 1 { sawSVG = svg && element == "svg" }
        if !(svg && Self.svgElements.contains(element)) && !(html && Self.htmlElements.contains(element)) { valid = false }
        for (key, value) in attributes {
            // Attribute keys can retain arbitrary namespace prefixes even with
            // namespace processing enabled. Local href rules apply to all aliases.
            let attribute = key.lowercased().split(separator: ":").last.map(String.init) ?? ""
            let metadata = !key.contains(":") && (attribute.hasPrefix("aria-") || attribute.hasPrefix("data-"))
            let allowed = metadata || (svg ? Self.svgAttributes : Self.htmlAttributes).contains(attribute)
            if !allowed || attribute.hasPrefix("on") || (attribute == "href" && !value.hasPrefix("#")) { valid = false }
            if ["style", "transform-origin", "fill", "stroke", "filter", "clip-path", "mask", "cursor", "marker-start", "marker-mid", "marker-end"].contains(attribute) && !cssAllowed(value) { valid = false }
        }
        if svg && element == "foreignobject" { foreignDepths.append(depth) }
        if element == "style" { styleDepth = depth; style = "" }
        if !valid { parser.abortParsing() }
    }
    func parser(_ parser: XMLParser, foundCharacters string: String) { if styleDepth != nil { style += string } }
    func parser(_ parser: XMLParser, foundCDATA CDATABlock: Data) { if styleDepth != nil { style += String(decoding: CDATABlock, as: UTF8.self) } }
    func parser(_ parser: XMLParser, foundProcessingInstructionWithTarget target: String, data: String?) { valid = false; parser.abortParsing() }
    func parser(_ parser: XMLParser, didEndElement elementName: String, namespaceURI: String?, qualifiedName: String?) {
        if styleDepth == depth { if !cssAllowed(style) { valid = false }; styleDepth = nil }
        if foreignDepths.last == depth { foreignDepths.removeLast() }
        depth -= 1
    }
}
