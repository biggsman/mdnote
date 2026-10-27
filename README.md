# 글담 (Geuldam)

**English** | [한국어](README.ko.md)

A lightweight, Typora-style Markdown editor for Windows.
Built with [Tauri 2](https://tauri.app) + Vite (vanilla JS).
The editor is based on the source of [Vditor](https://github.com/Vanessa219/vditor) 3.11.3 (MIT), adapted for Geuldam in `src/vditor`.
The user interface is available in Korean and English.

## Features

- Instant-rendering (IR) editing where formatting appears as you type; `Ctrl+/` switches to raw Markdown source
- New document (opens in a new window, so several documents can be edited at once) / Open / Save / Save As
- Left sidebar shows the `.md` file tree of the folder containing the open file (click the folder name at the bottom to open another folder)
- **Unsaved (●)** indicator in the title bar and status bar; asks before discarding changes when opening another file or closing a window
- `.md` / `.markdown` file association — double-click in Explorer to open in Geuldam
- Print — prints only the document content in a clean light theme (can also save as PDF)
- Export — PDF, HTML (single file with images embedded), image (PNG), Word (.docx), RTF, plain text (.txt, Markdown symbols removed)
- Menu bar: File · Edit · Paragraph · Format · View · Theme · Help
- Sidebar tabs: Files (folder tree) / Outline (document headings, click to jump)
- Table toolbar — appears above a table when the cursor is inside it: resize, alignment, insert/move/delete rows and columns, copy table, delete table
- Theme: follow system / light / dark (applied to all windows)
- UI language: switch between Korean and English in View → Language (applied to all windows)
- Drag and drop files or folders onto the window to open them; drop images to insert them at that position
- Follows Windows dark mode automatically
- Editor assets are bundled, so it works **fully offline**

### Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl+N` | New document (new window) |
| `Ctrl+O` | Open file |
| `Ctrl+Shift+O` | Open folder (sidebar) |
| `Ctrl+S` | Save |
| `Ctrl+Shift+S` | Save As |
| `Ctrl+P` | Print |
| `Ctrl+/` | Toggle IR ↔ source mode |
| `Ctrl+\` | Show/hide sidebar |
| `F11` | Full screen |
| `Ctrl+1`–`Ctrl+6` / `Ctrl+0` | Heading 1–6 / paragraph |
| `Ctrl+T` | Insert table |
| `Ctrl+Enter` (in a table) | Insert row below |
| `Alt+↑`/`Alt+↓`, `Alt+←`/`Alt+→` (in a table) | Move row up/down, move column left/right |
| `Ctrl+Shift+K` / `Ctrl+Shift+M` | Code block / math block |
| `Ctrl+Shift+Q` | Quote |
| `Ctrl+Shift+[` / `Ctrl+Shift+]` | Numbered list / bulleted list |
| `Ctrl+B` / `Ctrl+I` / `Ctrl+U` | Bold / italic / underline |
| `Alt+Shift+5` | Strikethrough |
| ``Ctrl+Shift+` `` | Inline code |
| `Ctrl+K` / `Ctrl+Shift+I` | Link / image |

## Building on Windows

### 1. Install prerequisites (once)

1. **Microsoft C++ Build Tools**
   - Download and run the installer from <https://visualstudio.microsoft.com/visual-cpp-build-tools/>.
   - Select the **"Desktop development with C++"** workload.
2. **WebView2 Runtime**
   - Already included in up-to-date Windows 10 and Windows 11.
   - Otherwise install the "Evergreen Bootstrapper" from <https://developer.microsoft.com/microsoft-edge/webview2/>.
3. **Rust**
   - Download `rustup-init.exe` from <https://www.rust-lang.org/tools/install> and install with the defaults.
   - `rustc --version` in a new terminal should print a version.
4. **Node.js** (LTS, 20 or later)
   - Install the LTS version from <https://nodejs.org>.
   - `node -v` and `npm -v` in a new terminal should print versions.
5. **Git**
   - <https://git-scm.com/download/win>

> Open a **new** PowerShell (or terminal) window after installing so the PATH changes take effect.

Or install everything with `winget` (administrator PowerShell):

```powershell
winget install Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
winget install Rustlang.Rustup
winget install OpenJS.NodeJS.LTS
winget install Git.Git
```

### 2. Get the source and install dependencies

```powershell
git clone https://github.com/biggsman/mdnote.git
cd mdnote
npm install
```

### 3. Run in development mode

```powershell
npm run tauri dev
```

The first run takes a few minutes to compile the Rust crates; later runs start quickly.
Editing files under `src/` reloads the window automatically.

### Troubleshooting

- **`link.exe` not found** → "Desktop development with C++" in the C++ Build Tools is not installed. Check step 1.
- **`cargo`/`npm` not found** → open a new terminal or restart the PC.
- **The window is blank/white** → install (or repair) the WebView2 Runtime.
- **The editor does not appear** → check that the `public\vditor` folder exists. If not, run `npm run copy-vditor`.

## Project structure

```
mdnote/
├─ index.html              # Page skeleton (sidebar + editor + status bar)
├─ src/
│  ├─ main.js              # File operations, shortcuts, sidebar, outline, printing
│  ├─ menu.js              # Window menu bar
│  ├─ format.js            # Paragraph and format commands
│  ├─ export.js            # Export (PDF, HTML, image, Word, RTF, text)
│  ├─ table.js             # Table toolbar
│  ├─ i18n.js              # UI strings (Korean / English)
│  ├─ style.css
│  └─ vditor/              # Editor source (based on Vditor 3.11.3, modified for Geuldam)
├─ scripts/copy-vditor.mjs # Copies node_modules/vditor/dist → public/vditor/dist
├─ vite.config.js
└─ src-tauri/
   ├─ src/lib.rs           # Rust commands: file read/write, folder tree, startup file, menu, PDF export
   ├─ tauri.conf.json      # Window, bundles (nsis/msi), file association
   └─ capabilities/        # Permissions (dialog plugin, window title/close)
```

### Offline assets

By default Vditor loads the Lute parser, language packs, icons and theme CSS from a CDN (unpkg).
Right before `npm run dev` / `npm run build`, `scripts/copy-vditor.mjs` copies
`node_modules/vditor/dist` to `public/vditor/dist`, and the editor uses only these local assets via `cdn: "/vditor"`.
`public/vditor` is a build artifact and is not committed to Git.

### Checking on Linux

```bash
# Tauri build dependencies (Debian/Ubuntu)
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev libayatana-appindicator3-dev libssl-dev build-essential pkg-config

npm install
npm run build              # frontend build
(cd src-tauri && cargo check)
```

## License

The Vditor source in `src/vditor` is MIT licensed (see `src/vditor/LICENSE`).
