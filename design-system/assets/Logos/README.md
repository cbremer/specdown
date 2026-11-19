# Logos

Source files live in the app. Don't copy them here.

- `markdown-viewer/logo.svg`: the full lockup (520×140). It has a shield mark in a `brand-teal`→`brand-coral` halo, a `brand-gold`→`brand-orange` core, `brand-cyan` eyes, and the wordmark ("Spec" in `brand-ink`, "Down" in the gradient). Use it in the web header at 40px tall on `bg-primary` light.
- `markdown-viewer/favicon.svg` (also `markdown-viewer/public/icons/icon.svg`): the mark on its `brand-tile` rounded square (256×256, rx 44). This is the favicon and PWA icon.
- The wordmark is live text set in Inter at 800 weight, falling back to system-ui, so it renders in whatever face is installed.
- `markdown-viewer/logo-dark.svg`: the dark-header variant. It's identical except "Spec" is white (`#FFFFFF`, 17.4:1 on `bg-primary` dark). Keep the two files in step when the lockup changes.
