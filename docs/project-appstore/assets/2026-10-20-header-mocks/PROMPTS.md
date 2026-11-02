# Generation prompts

Created October 20, 2026 using the built-in imagegen tool. These are concept mockups, not final upload exports.

## Identity reference

Both designs used the current local primary iOS icon: `ios/SpecDown/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png`. The reading-companion concept also used an earlier generated paper illustration as a material reference.

## 01: Brand halo

```text
Use case: identity-preserve / ads-marketing.
Create an original wide App Store header artwork for SpecDown, using reference image 1 as the authoritative brand identity. This is a new brand campaign composition; preserve the emblem precisely.
Brand invariants from image 1: the thin circular cyan/teal-to-muted-coral gradient ring with a subtle inward point at its bottom, the two thick cyan upward-curving closed-eye arches, and the small amber diamond with a lighter circular center above the eyes. Same proportions, colors and friendly expression. Do not add a mouth, limbs, eyes or other mascot features. Remove the surrounding app-icon rounded-square tile; let the ring-and-face mark sit directly against the full-bleed midnight navy background.
Concept: "The SpecDown halo." A restrained, sophisticated brand illustration. Exact recognizable central emblem, exceptionally crisp graphic shapes with subtle satin depth. Behind it, two enormous very faint soft curved arcs echo the cyan-to-coral ring and drift gently toward opposite outer edges, creating a wide brand environment. Beautiful near-black navy #0b111d, subtle cyan illumination on left and muted warm coral on right, amber only in the diamond. Absolutely no documents or extra foreground objects in this version. Not flashy, not neon, not a game logo.
Composition: 21:9 horizontal, target 3840x1646. The complete central emblem must fit inside x=43%-57% of canvas and y=34%-66%; place its center at x=50%,y=50%. This compact emblem is important because Apple crops the wide canvas heavily on phones. Background arcs may extend beyond crop areas. No square tile or app icon frame.
No words, no app name, no letters, no prices, no URLs, no Apple branding, no guides, no watermark. Entire artwork opaque PNG.
```

## 02: Reading companion

```text
Use case: compositing / ads-marketing.
Create a new wide App Store header concept for SpecDown called "Your reading companion." Reference image 1 is the authoritative SpecDown brand emblem. Reference image 2 is a supporting reference for paper materials and the Markdown/diagram subject, not a layout to copy.
Keep the SpecDown logo unmistakable and faithful: cyan-to-muted-coral ring with small inward notch at bottom, two curved cyan closed eyes, and gold diamond with pale circular center above. No mouth, limbs or added features. The ring-and-face mark should have no rounded square tile behind it; place it directly in the scene.
Compose a beautifully considered little still life: the exact SpecDown ring emblem on the left, paired closely with ONE angled ivory document on the right, with clean abstract navy text rules and a small clearly connected cyan flow diagram engraved in its lower half. This expresses the brand's role as a calm Markdown reading and diagram companion. Both elements share a single plane, restrained satin surfaces, realistic paper and gentle shadow, no loose extra decorations. Cyan and faint coral rim light echo the ring. Sophisticated editorial craftsmanship, a calm deep navy #0b111d environment, not generic corporate clipart.
21:9 landscape composition, intended 3840x1646. All essential artwork including complete ring and document must fit inside the center rectangle x=36%-64%, y=34%-66%, centered at x=50%, y=50%. Leave ample seamless navy negative space on each side and lower fifth. Scale the central group compactly, because Apple crops headers on phones.
No readable words, no brand wordmark, no letters or numerals, no fake app interface, no device, no button, no Apple badge, no watermark, no border, no guides. Fully opaque image.
```

## Supporting paper illustration prompt

```text
Use case: ads-marketing.
Asset type: original App Store product-page header concept for SpecDown, a lightweight Markdown document reader with interactive Mermaid diagrams.
Create one exceptionally polished 21:9 landscape artwork, intended export size 3840 x 1646 pixels, full bleed and fully opaque.
Concept A, "Calm reading": tactile editorial still life of three elegantly layered ivory document sheets hovering a little above a deep midnight-navy surface (#0b111d). The foremost paper is nearly face-on with a slight graceful bend, recognizable as a beautifully structured document using only clean abstract embossed typographic rules: a dark navy heading bar, several short charcoal body rules with generous leading, and a few tiny cyan highlight rules. One restrained amber-gold diamond bookmark rests near its upper corner, subtly recalling SpecDown's icon. Small cyan and muted coral edge-light accents, luxurious paper texture and soft directional studio shadows, precise geometry, quiet confident craftsmanship, beautiful depth. Make this feel like reading becomes clear and effortless.
Composition: a single compact sculptural group exactly centered horizontally, slightly above vertical center. Keep ALL important document artwork within the middle 30% of canvas width and middle 55% of canvas height. The far left and right are ample beautifully shaded navy negative space for responsive cropping. Lower fifth remains unobtrusive navy for the store's own UI. Clean organic sophistication, no clutter.
No words, no readable text, no letters or numerals, no app title, no logo, no screenshot, no fake interface, no device frame, no buttons, no people, no price, no URLs, no Apple badge, no watermark, no border, no transparent pixels. Deliver only the artwork, no mock phone or presentation board.
```

The tool returned preview-sized PNGs despite the requested export target. The returned compositions also exceed the requested safe-area bounds; do not treat prompt constraints as validated output. Final production needs a smaller central group, exact output dimensions and Apple's Device Preview.

