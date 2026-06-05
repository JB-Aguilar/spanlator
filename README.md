# SpanLator

Translate game language files (JSON, XML, TXT, PO, CSV, TSV, YAML) using Google Translate (free, no API key) with a custom glossary and translation memory.

## Features

- **Batch translate** entire game files in one click
- **Google Translate** via public endpoint — no API key, no registration, no cost
- **Glossary** — define custom term pairs that override machine translation (applied after Google Translate)
- **Translation Memory** — exact-match reuse from previous translations (per-game and global)
- **Manual editing** — click any segment to adjust the translation
- **Background processing** — upload returns instantly, translation runs in the background with progress polling
- **Preview** — see original vs translated side-by-side before export
- **Export** preserves original file format (JSON structure, XML tags/attributes, PO msgid/msgstr pairs, CSV/TSV columns, YAML keys)
- **Dark/Light theme** — persisted to localStorage
- **Bilingual UI** — English and Spanish

## Supported Formats

| Format | Parsing | Export |
|--------|---------|--------|
| JSON | Walks nested objects and arrays via key paths | Reconstructs original structure |
| XML | Text content + translatable attributes (text, title, label, etc.) | Preserves tags and attributes |
| TXT | Line by line | Line by line |
| PO | msgid → msgstr pairs | Preserves headers, matches msgstr to msgid |
| CSV | First column (source), second column (context) | Flat line output |
| TSV | First column (source), second column (context) | Flat line output |
| YAML | key: value pairs (quoted and unquoted) | Flat line output |

## Installation

Download the latest installer from [Releases](https://github.com/anomalyco/spanlator/releases) and run it. No additional setup required.

## Development

```bash
git clone https://github.com/anomalyco/spanlator.git
cd spanlator

# Install dependencies (frontend installs automatically via postinstall)
npm install

# Build frontend
npm run build:frontend

# Run without packaging
npx electron .

# Or for hot-reload development:
# Terminal 1:
cd frontend && npx vite --port 5173

# Terminal 2 (Windows PowerShell):
$env:VITE_DEV_SERVER_URL="http://localhost:5173"
npx electron .
```

### Build installer

```bash
npm run build:frontend
npx electron-builder --win --x64
```

Note: `winCodeSign` contains macOS symlinks that fail to extract on Windows. If the build fails at that step, use the workaround:

```bash
# Extract the already-built package and create NSIS from it
npx electron-builder --win --x64 --prepackaged "dist\win-unpacked"
```

## Architecture

```
spanlator/
├── backend/         Express API (runs in Electron's main process)
│   ├── database.js  SQLite schema, WAL mode
│   ├── fileParser.js Parse JSON/XML/TXT/PO/CSV/TSV/YAML
│   ├── outputBuilder.js Reconstruct files from translated segments
│   ├── translator.googletranslate + glossary + TM
│   └── routes.js    REST endpoints
├── frontend/        React 19 + Tailwind v4 + Vite
│   └── src/
│       ├── components/ UploadView, EditorView, GlossaryView, SettingsView, Sidebar
│       ├── api.js   HTTP client to backend
│       └── i18n.js  English / Spanish
├── electron/        Electron shell, IPC, native dialogs
└── resources/       App icon
```

## Glossary Import/Export Format

The glossary can be imported/exported as a JSON file with the following structure:

```json
[
  { "source": "Health Potion", "target": "Poción de Salud" },
  { "source": "Mana",         "target": "Maná" },
  { "source": "Quest",        "target": "Misión" }
]
```

An array of objects, each with `source` (term in the original language) and `target` (forced translation). Terms are applied after Google Translate using word-boundary matching.

## Technology

- **Backend**: Node.js, Express 5, better-sqlite3, google-translate-api-x
- **Frontend**: React 19, Tailwind CSS v4, Lucide icons, Vite
- **Desktop**: Electron 34, electron-builder (NSIS installer)

## License

MIT
