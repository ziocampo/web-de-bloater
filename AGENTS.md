# AGENTS.md - WebDeBloater Development Guide

This document provides guidance for AI agents working on the WebDeBloater browser extension.

## Project Overview

**WebDeBloater** is a Manifest V3 browser extension that blocks "Open in app" banners and similar web bloat across Chrome, Edge, Brave, Firefox (Desktop + Android).

### Key Features
- Content-script based DOM removal (not network blocking)
- Heuristic detection + curated CSS selectors
- Auto-updating selector database from GitHub
- Per-domain whitelist
- Multi-browser support (MV3)
- Italian/English localization

## Architecture

```
web-de-bloater/
├── manifest.json              # MV3 manifest
├── background/
│   └── background.js          # Service worker (storage, DNR, updates)
├── content/
│   ├── content-script.js      # Main banner detection/removal logic
│   └── selectors.json         # Curated CSS selectors (versioned)
├── utils/
│   ├── browser-polyfill.js    # Unified chrome/browser API
│   └── storage.js             # Storage wrapper
├── popup/
│   ├── popup.html/js/css      # Toolbar popup UI
├── options/
│   ├── options.html/js/css    # Full options page
├── styles/                    # Shared CSS
├── rules/
│   └── dnr-rules.json         # Declarative Net Request rules
├── _locales/
│   ├── it/messages.json       # Italian translations
│   └── en/messages.json       # English translations
├── icons/                     # Extension icons (16,32,48,128)
└── scripts/                   # Build tooling
```

## Core Concepts

### 1. Banner Detection Strategy
- **Primary**: CSS selectors from `selectors.json` (curated, versioned)
- **Secondary**: Heuristic text matching ("Apri nell'app", "Open in app", etc.)
- **Tertiary**: Meta tag blocking (apple-itunes-app, google-play-app)

### 2. Selector Update Flow
```
Background SW (24h timer) → Fetch GitHub selectors.json
  → Compare version → If newer: store in storage.local
  → Broadcast "SELECTORS_UPDATED" to all content scripts
  → Content scripts re-scan with new selectors
```

### 3. Storage Schema
```javascript
{
  enabled: boolean,              // Global toggle
  whitelist: string[],           // Domains where blocking is disabled
  customSelectors: string[],     // User-added CSS selectors
  stats: { totalRemoved, sessionRemoved },
  selectorsVersion: number,      // Remote selectors version
  remoteSelectors: string[],     // Cached remote selectors
  autoUpdate: boolean,           // Auto-update enabled
  showBadge: boolean,            // Show badge on icon
  debugMode: boolean,            // Verbose logging
  domainsVisited: string[]       // For stats
}
```

### 4. Messaging Protocol
| Message Type | Direction | Payload |
|--------------|-----------|---------|
| `GET_SETTINGS` | Popup/Options → Background | - |
| `TOGGLE_ENABLED` | Popup/Options → Background | - |
| `TOGGLE_WHITELIST` | Popup → Background | `{ domain }` |
| `GET_STATS` | Popup/Options → Background | - |
| `INCREMENT_STATS` | Content → Background | `{ count }` |
| `ADD_CUSTOM_SELECTOR` | Options → Background | `{ selector }` |
| `REMOVE_CUSTOM_SELECTOR` | Options → Background | `{ selector }` |
| `FORCE_UPDATE_SELECTORS` | Popup/Options → Background | - |
| `SELECTORS_UPDATED` | Background → Content | `{ selectors, version }` |
| `SETTINGS_CHANGED` | Background → All | `{ changes }` |

## Development Workflow

### Prerequisites
- Node.js 18+
- npm packages: `esbuild`, `archiver`, `web-ext`

### Commands
```bash
# Install dependencies
npm install

# Development (watch mode)
npm run dev

# Build all targets
npm run build

# Build specific target
npm run build:chrome
npm run build:firefox
npm run build:edge

# Package for release
npm run package

# Generate placeholder icons
npm run icons
```

### Testing

#### Chrome/Edge/Brave Desktop
1. `npm run build:chrome`
2. Open `chrome://extensions/`
3. Enable "Developer mode"
4. "Load unpacked" → select `dist/chrome/`

#### Firefox Desktop
1. `npm run build:firefox`
2. Open `about:debugging`
3. "This Firefox" → "Load Temporary Add-on" → select `dist/firefox/manifest.json`

#### Firefox Android (only mobile with full extension support)
1. Install Firefox Nightly
2. `about:config` → `extensions.webextensions.restrictedDomains` → empty
3. Install from Firefox Add-ons or load temporary via USB debugging

#### Chrome Mobile / Kiwi / Brave Mobile
- Chrome Android: No extension support
- Kiwi Browser: Enable "Extensions" in settings → load `.crx` or unpacked
- Brave Android: No extension support

### Adding New Selectors

1. Edit `content/selectors.json`:
```json
{
  "version": 2,
  "selectors": [
    "existing selectors...",
    ".new-banner-class",
    "#new-banner-id"
  ]
}
```

2. Increment version number
3. Push to GitHub (selectors.json must be publicly accessible)
4. Background will auto-fetch within 24h, or force update via popup

### Adding New Locales

1. Copy `_locales/en/messages.json` to `_locales/<locale>/messages.json`
2. Translate all messages
3. Add locale to `manifest.json` if needed (MV3 auto-detects)

### Debugging

#### Content Script
```javascript
// In browser console on any page
// Enable debug mode in options, then:
localStorage.setItem("webde-bloater-debug", "true");
// Reload page - verbose logs will appear
```

#### Background Service Worker
- Chrome: `chrome://extensions/` → Service worker "Inspect views"
- Firefox: `about:debugging` → "Inspect" background page

#### Storage Inspection
```javascript
// In background console
browser.storage.local.get(null).then(console.log);
```

## Code Style Guidelines

### JavaScript
- ES Modules (`type: "module"` in package.json)
- Async/await over promises
- No external runtime dependencies (only build-time)
- ESLint config: standard + browser globals

### CSS
- Custom properties for theming (light/dark)
- Mobile-first responsive
- No CSS frameworks

### Manifest V3 Compliance
- Service worker (not persistent background)
- `declarativeNetRequest` for network rules
- `scripting` API for content script injection
- No `webRequest` blocking
- Host permissions declared explicitly

## Common Tasks

### Add a New Setting
1. Add key to `STORAGE_KEYS` in `background/background.js` and `options/options.js`
2. Add default to `DEFAULT_SETTINGS` / `DEFAULTS`
3. Add UI in `options/options.html` + `options/options.js`
4. Add i18n strings in `_locales/*/messages.json`
5. Handle in `background.js` message handler

### Modify Content Script Logic
1. Edit `content/content-script.js`
2. Rebuild: `npm run build`
3. Reload extension in browser

### Update DNR Rules
1. Edit `rules/dnr-rules.json`
2. Increment rule IDs if adding
3. Rebuild

## Release Checklist

- [ ] Version bump in `manifest.json` and `package.json`
- [ ] Update `CHANGELOG.md`
- [ ] Run `npm run package`
- [ ] Test all targets manually
- [ ] Create GitHub Release with artifacts from `build/`
- [ ] Submit to Chrome Web Store, Firefox AMO, Edge Add-ons

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Content script not injecting | Check `manifest.json` `content_scripts.matches`, `run_at` |
| Storage not persisting | Ensure `storage` permission in manifest |
| DNR rules not working | Check `declarative_net_request` permission, rule IDs unique |
| Firefox: "Corrupted extension" | Validate `manifest.json` JSON, check `browser_specific_settings.gecko.id` |
| Mobile: Not working | Only Firefox Android supports MV3 extensions fully |
| Selectors not updating | Check GitHub raw URL accessible, CORS headers |

## Security Considerations

- No `eval()`, `Function()`, or dynamic code execution
- All external fetches use `fetch()` with `cache: "no-cache"`
- User custom selectors sanitized via `CSS.escape()` when used
- No tracking, analytics, or external data collection
- Minimal permissions: `storage`, `scripting`, `activeTab`, `declarativeNetRequest`

## Performance Guidelines

- Content script runs at `document_idle`
- MutationObserver debounced (100ms)
- Selector matching uses `querySelectorAll` (native, fast)
- WeakSet for processed elements (no memory leaks)
- Background SW idle-until-needed

---

*Last updated: 2025*