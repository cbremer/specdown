# SpecDown: A Markdown Viewer

A lightweight, browser-based markdown viewer with enhanced diagram navigation capabilities. Perfect for viewing documentation with complex Mermaid diagrams that need zooming, panning, and detailed exploration.

### Features

#### 📄 Markdown Rendering
- Full GitHub Flavored Markdown (GFM) support
- Syntax highlighting for code blocks
- Tables, lists, blockquotes, and more
- Clean, readable typography

#### 🎨 Mermaid Diagram Enhancement
- **Interactive Controls**: Zoom in/out, pan, reset, and fullscreen for every diagram
- **Mouse Wheel Zoom**: Scroll to zoom in and out
- **Pan & Drag**: Click and drag diagrams to navigate
- **Reset View**: Double-click or use reset button to return to original view
- **Fullscreen Mode**: Expand diagrams to fill the screen for detailed exploration
- **Dark/Light Theme**: Automatic theme switching for diagrams

#### 🎯 User Experience
- **Drag & Drop**: Simply drag markdown files onto the page
- **File Browser**: Click to browse and select files
- **Theme Toggle**: Switch between light and dark themes
- **Responsive Design**: Works on desktop and mobile devices
- **Fast & Lightweight**: No build step, runs directly in browser

### Usage

#### Quick Start

1. **Open the App**
   ```bash
   # Option 1: Open directly in browser
   open markdown-viewer/index.html
   
   # Option 2: Use a local server (recommended)
   cd markdown-viewer
   python3 -m http.server 8000
   # Then navigate to http://localhost:8000
   ```

2. **Load a Markdown File**
   - Drag and drop a `.md` or `.markdown` file onto the page
   - Or click "Browse Files" to select a file

3. **Interact with Diagrams**
   - Use the control buttons in the top-right corner of each diagram:
     - **+** : Zoom in
     - **-** : Zoom out
     - **⟲** : Reset view
     - **⛶** : Fullscreen mode
   - Scroll mouse wheel over diagram to zoom
   - Click and drag to pan around large diagrams
   - Double-click to reset to original view
   - Press ESC to exit fullscreen mode

#### Keyboard Shortcuts

- `ESC` - Exit fullscreen mode
- Mouse Wheel - Zoom in/out when over a diagram
- Double Click - Reset diagram to original view

### Browser Compatibility

#### Supported Browsers
- ✅ Chrome 90+ (recommended)
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

All modern browsers with ES6+ support and FileReader API.

### File Structure

```
specdown/
├── README.md                    # This file
├── SPEC.md                      # Full product spec
├── markdown-viewer/             # Web app (shared with desktop)
│   ├── index.html               # Main application page
│   ├── styles.css               # Application styles and theming
│   ├── app.js                   # Core application logic
│   ├── logo.svg                 # SpecDown logo (light theme)
│   ├── logo-dark.svg            # SpecDown logo (dark theme)
│   ├── favicon.svg              # Browser tab icon
│   └── vendor/                  # Vendored libraries
├── desktop/                     # Electron shell
│   ├── main.js                  # Main process
│   └── preload.js               # IPC bridge stub
├── tests/                       # Jest test suite
└── package.json
```

### Technology Stack

#### Core Libraries (CDN)
- **Marked.js** (v11.1.1) - Markdown parsing
- **Mermaid.js** (v10.6.1) - Diagram rendering
- **Panzoom** (v4.5.1) - Interactive pan/zoom functionality
- **Highlight.js** (v11.9.0) - Code syntax highlighting

#### Why CDN?
- Zero build step required
- Instant setup - just open `index.html`
- Always up-to-date libraries
- Fast loading from CDN caching

### Example Files

Try the viewer with any `.md` file containing Mermaid diagrams to explore the interactive features.

### Features in Detail

#### Diagram Interaction

Each Mermaid diagram is automatically enhanced with:

1. **Control Panel**
   - Positioned in top-right corner
   - Always accessible (not affected by zoom/pan)
   - Consistent across all diagrams

2. **Zoom Functionality**
   - Button zoom: 0.2x increments
   - Mouse wheel: Smooth, continuous zoom
   - Range: 0.5x to 5x (10x in fullscreen)

3. **Pan Functionality**
   - Click and drag anywhere on diagram
   - Cursor changes to indicate drag state
   - Smooth GPU-accelerated movement

4. **Fullscreen Mode**
   - Darkened backdrop for focus
   - Diagram centered and maximized
   - Controls remain accessible
   - Extended zoom range (up to 10x)
   - Click outside or press ESC to exit

#### Theme Support

- **Light Theme**: Clean, bright interface for daylight use
- **Dark Theme**: Easy on the eyes for low-light environments
- **Automatic Diagram Theming**: Mermaid diagrams adapt to theme
- **Persistent Preference**: Theme choice saved in browser

#### File Handling

- **Accepted Formats**: `.md`, `.markdown`
- **Drag & Drop**: Anywhere on the drop zone
- **File Validation**: Checks file extension before loading
- **Error Handling**: Clear error messages for invalid files
- **Memory Management**: Cleans up resources when loading new files

### Troubleshooting

#### Diagrams Not Rendering

**Problem**: Mermaid diagrams show as code blocks instead of diagrams.

**Solution**: 
- Ensure code blocks are marked with `mermaid` language:
  ````markdown
  ```mermaid
  graph TD
    A --> B
  ```
  ````
- Check browser console for Mermaid syntax errors

#### File Won't Load

**Problem**: Drag and drop or file selection doesn't work.

**Solution**:
- Verify file has `.md` or `.markdown` extension
- Try opening in a local server instead of `file://` protocol
- Check browser console for errors

#### Zoom/Pan Not Working

**Problem**: Interactive controls don't respond.

**Solution**:
- Ensure JavaScript is enabled
- Check that diagram rendered successfully (no error messages)
- Try refreshing the page
- Verify browser compatibility

#### Theme Not Persisting

**Problem**: Theme resets to light on page reload.

**Solution**:
- Enable localStorage in browser settings
- Check that cookies/storage aren't being cleared
- Try incognito/private mode to test

### Performance Tips

#### Large Documents
- Documents with many diagrams load sequentially
- Scroll to diagram to trigger panzoom initialization (lazy loading)
- Consider splitting very large documents

#### Complex Diagrams
- Use fullscreen mode for detailed exploration
- Reset view if performance degrades
- Simplify diagram if rendering is slow

### Desktop App (macOS)

#### Download

Download the latest `.dmg` from [GitHub Releases](../../releases).

> **Note:** The app is unsigned. On first launch, right-click the app and select **Open** to bypass Gatekeeper. Alternatively, run `xattr -cr /Applications/Specdown\ Desktop.app` after installing.

#### Install

1. Open the downloaded `.dmg`
2. Drag **Specdown Desktop** to your Applications folder
3. Right-click > **Open** on first launch

### Development

#### Running the Desktop App from Source

**First-time setup:**
```bash
cd specdown               # navigate into the project directory
npm install               # install Electron and all dependencies
```

**Launch the app:**
```bash
npm run desktop           # opens the Specdown Desktop window
```

**Build the DMG locally (macOS only):**
```bash
npm run desktop:build     # produces a .dmg in dist/
```

Requires Node.js (v18+) installed on your machine.

#### Running Tests

```bash
npm test
```

Runs the full Jest test suite (unit + integration). All tests must pass before committing.

#### Modifying the App

1. **Styling**: Edit `markdown-viewer/styles.css` for visual changes
2. **Functionality**: Edit `markdown-viewer/app.js` for behavior changes
3. **Structure**: Edit `markdown-viewer/index.html` for layout changes
4. **Electron main process**: Edit `desktop/main.js`
5. **IPC bridge**: Edit `desktop/preload.js`

#### Adding Features

The codebase is organized into clear sections:

```javascript
// app.js structure
- Global State
- DOM Elements
- Initialization
- Theme Management
- Event Listeners
- Drag and Drop Handlers
- File Processing
- Markdown/Mermaid Configuration
- Rendering Logic
- Panzoom Initialization
- Fullscreen Management
- Cleanup Functions
```

#### Extending Markdown Support

To add more syntax highlighting languages:

```html
<!-- Add to index.html -->
<script src="https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/lib/languages/rust.min.js"></script>
```

### Contributing

This is a self-contained application. To improve:

1. Fork or copy the directory
2. Make your changes
3. Test in multiple browsers
4. Share improvements!

### License

This project uses open-source libraries:
- Marked.js - MIT License
- Mermaid.js - MIT License
- Panzoom - MIT License
- Highlight.js - BSD 3-Clause License

### Acknowledgments

Built for viewing documentation with complex system architecture diagrams.

### Version History

#### v0.0.43 (Current)
- Initial release
- Full markdown rendering
- Interactive mermaid diagrams
- Zoom, pan, reset, fullscreen
- Dark/light theme support
- Drag & drop file loading

### Support

For issues or questions:
1. Check the Troubleshooting section
2. Verify browser compatibility
3. Check browser console for error messages
4. Test with example files to isolate the issue

---

**Happy Diagram Viewing with SpecDown! 📊**
