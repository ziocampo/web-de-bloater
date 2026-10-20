// Content Script - Core logic for detecting and removing "Open in app" banners
// Runs in all frames at document_idle

import { BrowserPolyfill } from "../utils/browser-polyfill.js";

const SELECTORS_KEY = "remoteSelectors";
const CUSTOM_SELECTORS_KEY = "customSelectors";

class BannerBlocker {
  constructor() {
    this.browser = BrowserPolyfill.getInstance();
    this.selectors = new Set();
    this.customSelectors = new Set();
    this.observer = null;
    this.removedCount = 0;
    this.processedElements = new WeakSet();
    this.init();
  }

  async init() {
    // Load selectors from storage
    await this.loadSelectors();

    // Listen for selector updates from background
    this.browser.runtime.onMessage.addListener((message) => {
      if (message.type === "SELECTORS_UPDATED") {
        this.updateSelectors(message.selectors);
      } else if (message.type === "SETTINGS_CHANGED") {
        this.handleSettingsChange(message.changes);
      }
    });

    // Initial scan
    this.scanAndRemove();

    // Setup MutationObserver for dynamic content
    this.setupObserver();

    // Listen for settings changes
    this.browser.storage.onChanged.addListener((changes) => {
      if (changes.customSelectors) {
        this.customSelectors = new Set(changes.customSelectors.newValue || []);
        this.scanAndRemove();
      }
    });
  }

  async loadSelectors() {
    try {
      // Try to load from web-accessible resource first (bundled)
      const response = await fetch(this.browser.getURL("content/selectors.json"));
      if (response.ok) {
        const data = await response.json();
        this.selectors = new Set(data.selectors || []);
      }
    } catch {
      // Fallback to built-in defaults
      this.selectors = new Set(this.getDefaultSelectors());
    }

    // Load remote selectors from background storage
    try {
      const data = await this.browser.getStorage([SELECTORS_KEY, CUSTOM_SELECTORS_KEY]);
      if (data[SELECTORS_KEY]) {
        for (const sel of data[SELECTORS_KEY]) {
          this.selectors.add(sel);
        }
      }
      if (data[CUSTOM_SELECTORS_KEY]) {
        this.customSelectors = new Set(data[CUSTOM_SELECTORS_KEY]);
      }
    } catch {
      // Ignore storage errors
    }
  }

  getDefaultSelectors() {
    return [
      // Generic "Open in app" banner patterns
      '[class*="app-banner"]',
      '[class*="app-promo"]',
      '[class*="app-promotion"]',
      '[class*="smart-banner"]',
      '[class*="app-install-banner"]',
      '[class*="open-in-app"]',
      '[class*="mobile-app-banner"]',
      '[id*="app-banner"]',
      '[id*="smart-banner"]',
      '[data-testid*="app-banner"]',
      '[data-testid*="smart-banner"]',

      // Common text-based patterns (will be filtered by heuristic)
      'banner:has-text("Apri nell\'app")',
      'banner:has-text("Open in app")',
      'banner:has-text("Apri con l\'app")',
      'banner:has-text("Open with app")',
      'banner:has-text("Scarica l\'app")',
      'banner:has-text("Download app")',
      'banner:has-text("Get the app")',
      'banner:has-text("Ottieni l\'app")',
      'banner:has-text("Continua con l\'app")',
      'banner:has-text("Continue in app")',

      // Meta tags that trigger native banners
      'meta[name="apple-itunes-app"]',
      'meta[name="google-play-app"]',
      'meta[name="app-store-id"]',

      // Specific known sites
      '[class*="reddit-app-banner"]',
      '[class*="twitter-app-banner"]',
      '[class*="instagram-app-banner"]',
      '[class*="tiktok-app-banner"]',
      '[class*="linkedin-app-banner"]',
      '[class*="pinterest-app-banner"]',
      '[class*="medium-app-banner"]',
      '[class*="quora-app-banner"]',
      '[class*="stackoverflow-app-banner"]',
      '[class*="github-app-banner"]',

      // Cookie/consent banners that often contain app promotions
      '[class*="cookie-banner"] [class*="app"]',
      '[class*="consent-banner"] [class*="app"]',
    ];
  }

  updateSelectors(newSelectors) {
    this.selectors = new Set(newSelectors);
    this.scanAndRemove();
  }

  handleSettingsChange(changes) {
    if (changes.enabled !== undefined && !changes.enabled.newValue) {
      // Extension disabled - restore any hidden elements
      this.restoreAll();
    } else if (changes.enabled !== undefined && changes.enabled.newValue) {
      // Extension enabled - scan again
      this.scanAndRemove();
    }
  }

  setupObserver() {
    this.observer = new MutationObserver((mutations) => {
      let shouldScan = false;
      for (const mutation of mutations) {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              shouldScan = true;
              break;
            }
          }
        }
        if (shouldScan) break;
      }
      if (shouldScan) {
        // Debounce
        clearTimeout(this.scanTimeout);
        this.scanTimeout = setTimeout(() => this.scanAndRemove(), 100);
      }
    });

    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  scanAndRemove() {
    if (!document.documentElement) return;

    const allSelectors = [...this.selectors, ...this.customSelectors];
    let removed = 0;

    for (const selector of allSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          if (this.shouldRemove(el)) {
            this.removeElement(el);
            removed++;
          }
        }
      } catch (e) {
        // Invalid selector, skip
        console.debug("WebDeBloater: Invalid selector", selector, e);
      }
    }

    // Heuristic-based detection for elements not caught by selectors
    removed += this.heuristicScan();

    if (removed > 0) {
      this.removedCount += removed;
      this.reportStats(removed);
    }
  }

  shouldRemove(element) {
    if (this.processedElements.has(element)) return false;
    if (!element.offsetParent && element.style.display !== "none") return false; // Already hidden

    // Check if element or ancestors are in whitelist
    let current = element;
    while (current) {
      if (current.dataset?.webdeBloaterWhitelist === "true") return false;
      current = current.parentElement;
    }

    this.processedElements.add(element);
    return true;
  }

  removeElement(element) {
    // Store original display for potential restore
    element.dataset.webdeBloaterOriginalDisplay = element.style.display || "";
    element.dataset.webdeBloaterRemoved = "true";
    element.style.display = "none";
    element.setAttribute("aria-hidden", "true");
  }

  heuristicScan() {
    let removed = 0;

    // Find elements with app-promotion related text
    const textPatterns = [
      /apri nell['']app/i,
      /open in app/i,
      /apri con l['']app/i,
      /open with app/i,
      /scarica l['']app/i,
      /download (the )?app/i,
      /get the app/i,
      /ottieni l['']app/i,
      /continua con l['']app/i,
      /continue in app/i,
      /usa l['']app/i,
      /use the app/i
    ];

    // Look for banner-like containers
    const candidates = document.querySelectorAll(
      'banner, [role="banner"], [class*="banner"], [class*="promo"], [class*="toast"], [class*="snackbar"], [id*="banner"], [id*="promo"]'
    );

    for (const el of candidates) {
      if (this.processedElements.has(el)) continue;

      const text = el.innerText || el.textContent || "";
      if (textPatterns.some(pattern => pattern.test(text))) {
        // Additional check: must have a button/link that looks like "Open" or "Download"
        const hasActionButton = el.querySelector('button, a, [role="button"]')?.textContent?.match(/(apri|open|scarica|download|get|ottieni|installa|install)/i);
        if (hasActionButton || text.length < 200) { // Short banner-like text
          this.removeElement(el);
          removed++;
        }
      }
    }

    // Check for meta tags that trigger native smart banners
    const metaTags = document.querySelectorAll('meta[name="apple-itunes-app"], meta[name="google-play-app"]');
    for (const meta of metaTags) {
      if (!this.processedElements.has(meta)) {
        meta.dataset.webdeBloaterRemoved = "true";
        this.processedElements.add(meta);
        removed++;
      }
    }

    return removed;
  }

  restoreAll() {
    const removed = document.querySelectorAll('[data-webde-bloater-removed="true"]');
    for (const el of removed) {
      const originalDisplay = el.dataset.webdeBloaterOriginalDisplay;
      el.style.display = originalDisplay || "";
      el.removeAttribute("aria-hidden");
      el.removeAttribute("data-webde-bloater-removed");
      el.removeAttribute("data-webde-bloater-original-display");
    }
    this.processedElements = new WeakSet();
  }

  async reportStats(count) {
    try {
      await this.browser.sendMessage({ type: "INCREMENT_STATS", count });
    } catch {
      // Background might not be ready
    }
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
    clearTimeout(this.scanTimeout);
  }
}

// Initialize
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => new BannerBlocker());
} else {
  new BannerBlocker();
}