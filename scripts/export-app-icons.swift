// macOS: swift scripts/export-app-icons.swift [repository root]
// Derive every alternate asset from its full-resolution source, never a prior export.
import AppKit

let root = URL(fileURLWithPath: CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : FileManager.default.currentDirectoryPath)
let space = CGColorSpace(name: CGColorSpace.sRGB)!
let variants = ["flat", "glass", "ceramic", "metallic", "layered", "minimal"]

func context(_ width: Int, _ height: Int) -> CGContext {
    CGContext(data: nil, width: width, height: height, bitsPerComponent: 8,
              bytesPerRow: width * 4, space: space,
              bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
}

func bounds(_ pixels: UnsafeMutablePointer<UInt8>, _ width: Int, _ height: Int) -> CGRect {
    var left = width, bottom = height, right = -1, top = -1
    for y in 0..<height { for x in 0..<width where pixels[(y * width + x) * 4 + 3] >= 128 {
        left = min(left, x); right = max(right, x)
        bottom = min(bottom, y); top = max(top, y)
    } }
    precondition(right >= left, "Source has no opaque artwork")
    return CGRect(x: left, y: bottom, width: right - left + 1, height: top - bottom + 1)
}

func save(_ image: CGImage, _ relativePath: String, opaque: Bool = false) throws {
    let bitmap: NSBitmapImageRep
    if opaque {
        // Explicit RGB representation: AppIcon catalogs must have no alpha channel.
        let rgba = NSBitmapImageRep(cgImage: image)
        bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: image.width,
            pixelsHigh: image.height, bitsPerSample: 8, samplesPerPixel: 3,
            hasAlpha: false, isPlanar: false, colorSpaceName: .deviceRGB,
            bytesPerRow: 0, bitsPerPixel: 0)!
        for y in 0..<image.height { for x in 0..<image.width {
            bitmap.setColor(rgba.colorAt(x: x, y: y)!, atX: x, y: y)
        } }
    } else { bitmap = NSBitmapImageRep(cgImage: image) }
    // Preserve the explicit sRGB pixel values and embed their profile in every PNG.
    let tagged = bitmap.retagging(with: .sRGB)!
    try tagged.representation(using: .png, properties: [:])!.write(to: root.appendingPathComponent(relativePath))
}

for variant in variants {
    let source = NSBitmapImageRep(data: try Data(contentsOf: root.appendingPathComponent("build/app-icon-sources/\(variant).png")))!.cgImage!
    let width = source.width, height = source.height
    let working = context(width, height)
    working.draw(source, in: CGRect(x: 0, y: 0, width: width, height: height))
    let pixels = working.data!.assumingMemoryBound(to: UInt8.self)
    let originalBounds = bounds(pixels, width, height)
    // A one-source-pixel inset removes extraction matte. A small tent filter
    // restores antialiasing without blurring the face, texture, or internal edges.
    // Premultiplied RGB is adjusted with alpha to avoid colored/white fringes.
    var inset = [UInt8](repeating: 0, count: width * height)
    for y in 1..<(height - 1) { for x in 1..<(width - 1) {
        var alpha: UInt8 = 255
        for dy in -1...1 { for dx in -1...1 {
            alpha = min(alpha, pixels[((y + dy) * width + x + dx) * 4 + 3])
        } }
        inset[y * width + x] = alpha < 16 ? 0 : alpha
    } }
    let weights = [1, 2, 1]
    for y in 0..<height { for x in 0..<width {
        let index = (y * width + x) * 4
        let oldAlpha = Int(pixels[index + 3])
        var sum = 0
        if x > 0 && y > 0 && x < width - 1 && y < height - 1 && originalBounds.insetBy(dx: -2, dy: -2).contains(CGPoint(x: x, y: y)) {
            for dy in -1...1 { for dx in -1...1 {
                sum += Int(inset[(y + dy) * width + x + dx]) * weights[dy + 1] * weights[dx + 1]
            } }
        }
        let alpha = min(oldAlpha, sum / 16)
        for channel in 0..<3 {
            pixels[index + channel] = oldAlpha == 0 ? 0 : UInt8(Int(pixels[index + channel]) * alpha / oldAlpha)
        }
        pixels[index + 3] = UInt8(alpha)
    } }
    let visible = bounds(pixels, width, height)
    let scale = 824.0 / max(visible.width, visible.height)
    // Pixel rows are top-down; the drawing context uses bottom-up coordinates.
    let placement = CGRect(x: 512 - visible.midX * scale, y: 512 - (Double(height) - visible.midY) * scale,
                           width: Double(width) * scale, height: Double(height) * scale)
    let cleaned = working.makeImage()!
    let desktop = context(1024, 1024)
    desktop.interpolationQuality = .high
    desktop.draw(cleaned, in: placement)
    try save(desktop.makeImage()!, "desktop/icons/\(variant).png")
    let ios = context(1024, 1024)
    ios.setFillColor(CGColor(colorSpace: space, components: [11.0 / 255, 17.0 / 255, 29.0 / 255, 1])!)
    ios.fill(CGRect(x: 0, y: 0, width: 1024, height: 1024))
    ios.draw(desktop.makeImage()!, in: CGRect(x: 0, y: 0, width: 1024, height: 1024))
    try save(ios.makeImage()!, "ios/SpecDown/Assets.xcassets/AppIcon-\(variant).appiconset/AppIcon-1024.png", opaque: true)
    try Data(contentsOf: root.appendingPathComponent("ios/SpecDown/Assets.xcassets/AppIcon-\(variant).appiconset/AppIcon-1024.png"))
        .write(to: root.appendingPathComponent("ios/SpecDown/Assets.xcassets/IconPreview-\(variant).imageset/icon.png"), options: .atomic)
    print("\(variant): source \(width)×\(height), visible \(visible), scale \(scale)")
}
