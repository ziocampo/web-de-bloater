# WebDeBloater

A browser extension to selectively block web bloaters like "Open in app" banners.

## Features

- 🚫 Blocks "Open in app", "Download app", "Get the app" banners
- 🌐 Works on Chrome, Edge, Brave, Firefox (Desktop + Android)
- ⚡ Manifest V3 - modern, secure, performant
- 🎯 Smart detection: curated CSS selectors + heuristic text matching
- 🔄 Auto-updating selector database from GitHub
- ✅ Per-domain whitelist
- 📊 Statistics tracking
- 🌍 Italian & English localization
- 🛡️ Privacy-first: no data collection, all local

## Installation

### Chrome / Edge / Brave (Desktop)
1. Download latest `web-de-bloater-vX.Y.Z-chrome.zip` from [Releases](https://github.com/daniele/web-de-bloater/releases)
2. Unzip to a folder
3. Open `chrome://extensions/` (or `edge://extensions/`)
4. Enable "Developer mode"
5. Click "Load unpacked" → select the unzipped folder

### Firefox (Desktop)
1. Download latest `web-de-bloater-vX.Y.Z-firefox.xpi` from [Releases](https://github.com/daniele/web-de-bloater/releases)
2. Open `about:addons` → gear icon → "Install Add-on From File"
3. Select the `.xpi` file

### Firefox Android (Only mobile with full support)
1. Install [Firefox Nightly](https://play.google.com/store/apps/details?id=org.mozilla.fenix)
2. Open `about:config`
3. Search `extensions.webextensions.restrictedDomains` → set to empty string
3. Install from [Firefox Add-ons](https://addons.mozilla.org/) or load via USB debugging

## Development

### Prerequisites
- Node.js 18+
- npm

### Setup
```bash
git clone https://github.com/daniele/web-de-bloater.git
cd web-de-bloater
npm install
```

### Commands
```bash
# Development with live reload
npm run dev

# Build for all browsers
npm run build

# Build specific browser
npm run build:chrome
npm run build:firefox
npm run build:edge

# Package release artifacts
npm run package

# Generate placeholder icons
npm run icons
```

### Project Structure
```
├── manifest.json              # MV3 manifest
├── background/background.js   # Service worker
├── content/
│   ├── content-script.js      # Banner detection/removal
│   └── selectors.json         # Curated selectors (versioned)
├── utils/
│   ├── browser-polyfill.js    # Unified browser API
│   └── storage.js             # Storage wrapper
├── popup/                     # Toolbar popup
├── options/                   # Full options page
├── styles/                    # Shared CSS
├── rules/dnr-rules.json       # Network request rules
├── _locales/                  # i18n (it, en)
├── icons/                     # Extension icons
└── scripts/                   # Build tooling
```

## How It Works

### Detection Methods
1. **Curated Selectors** (primary): Versioned CSS selectors for known sites (Reddit, Twitter/X, Instagram, TikTok, LinkedIn, etc.)
2. **Heuristic Text Matching**: Finds banner-like elements containing "Apri nell'app", "Open in app", "Scarica l'app", etc.
3. **Meta Tag Blocking**: Removes `apple-itunes-app` and `google-play-app` meta tags that trigger native smart banners

### Selector Updates
- Background service worker checks GitHub every 24h
- Compares version number in `selectors.json`
- If newer: downloads, caches, broadcasts to all content scripts
- Manual update available in popup/options

### Whitelist
- Per-domain disable via popup or options
- Stored in `storage.sync` (syncs across devices on Chrome/Firefox)

## Contributing

### Adding Selectors
1. Edit `content/selectors.json`
2. Increment `version`
3. Add selectors for the new site
4. Test locally
5. Submit PR

### Adding Locales
1. Copy `_locales/en/messages.json` to `_locales/<code>/messages.json`
2. Translate all values
3. Submit PR

### Reporting Issues
- Use [GitHub Issues](https://github.com/daniele/web-de-bloater/issues)
- Include: browser, version, URL where banner appears, screenshot

## Privacy

WebDeBloater:
- ✅ Does NOT collect any personal data
- ✅ Does NOT track browsing history
- ✅ Does NOT send data to any server (except optional selector updates from GitHub)
- ✅ All settings stored locally on your device
- ✅ Open source - audit the code yourself

## License

MIT License - see [LICENSE](LICENSE)

## Credits

- Inspired by uBlock Origin's element picker
- Selector database community-contributed
- Icons from [Heroicons](https://heroicons.com/) (MIT)