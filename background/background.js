// Background Service Worker for WebDeBloater
// Handles: storage sync, DNR rules, remote selector updates, messaging

import { StorageManager } from "../utils/storage.js";
import { BrowserPolyfill } from "../utils/browser-polyfill.js";

const STORAGE_KEYS = {
  ENABLED: "enabled",
  WHITELIST: "whitelist",
  STATS: "stats",
  SELECTORS_VERSION: "selectorsVersion",
  CUSTOM_SELECTORS: "customSelectors",
  LAST_UPDATE_CHECK: "lastUpdateCheck"
};

const DEFAULT_SETTINGS = {
  [STORAGE_KEYS.ENABLED]: true,
  [STORAGE_KEYS.WHITELIST]: [],
  [STORAGE_KEYS.STATS]: { totalRemoved: 0, sessionRemoved: 0 },
  [STORAGE_KEYS.SELECTORS_VERSION]: 0,
  [STORAGE_KEYS.CUSTOM_SELECTORS]: [],
  [STORAGE_KEYS.LAST_UPDATE_CHECK]: 0
};

const SELECTORS_REMOTE_URL = "https://raw.githubusercontent.com/daniele/web-de-bloater/main/selectors.json";
const UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

class BackgroundManager {
  constructor() {
    this.storage = new StorageManager();
    this.browser = BrowserPolyfill.getInstance();
    this.init();
  }

  async init() {
    await this.storage.init(DEFAULT_SETTINGS);
    this.setupMessageHandlers();
    this.setupEventListeners();
    await this.maybeUpdateSelectors();
    this.startPeriodicUpdateCheck();
  }

  setupMessageHandlers() {
    this.browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender).then(sendResponse).catch(console.error);
      return true; // async response
    });
  }

  setupEventListeners() {
    // Tab updates - reset session stats on new navigation
    this.browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === "complete" && tab.url?.startsWith("http")) {
        this.resetSessionStats();
      }
    });

    // Extension install/update
    this.browser.runtime.onInstalled.addListener((details) => {
      if (details.reason === "install") {
        this.browser.tabs.create({ url: this.browser.runtime.getURL("options/options.html") });
      }
    });
  }

  async handleMessage(message, sender) {
    switch (message.type) {
      case "GET_SETTINGS":
        return this.getSettings();
      case "TOGGLE_ENABLED":
        return this.toggleEnabled();
      case "TOGGLE_WHITELIST":
        return this.toggleWhitelist(message.domain);
      case "GET_STATS":
        return this.getStats();
      case "INCREMENT_STATS":
        return this.incrementStats(message.count || 1);
      case "ADD_CUSTOM_SELECTOR":
        return this.addCustomSelector(message.selector);
      case "REMOVE_CUSTOM_SELECTOR":
        return this.removeCustomSelector(message.selector);
      case "FORCE_UPDATE_SELECTORS":
        return this.updateSelectors(true);
      default:
        return { error: "Unknown message type" };
    }
  }

  async getSettings() {
    const data = await this.storage.get([
      STORAGE_KEYS.ENABLED,
      STORAGE_KEYS.WHITELIST,
      STORAGE_KEYS.CUSTOM_SELECTORS
    ]);
    return {
      enabled: data[STORAGE_KEYS.ENABLED],
      whitelist: data[STORAGE_KEYS.WHITELIST],
      customSelectors: data[STORAGE_KEYS.CUSTOM_SELECTORS]
    };
  }

  async toggleEnabled() {
    const data = await this.storage.get(STORAGE_KEYS.ENABLED);
    const newValue = !data[STORAGE_KEYS.ENABLED];
    await this.storage.set({ [STORAGE_KEYS.ENABLED]: newValue });
    this.broadcastSettingsChange({ enabled: newValue });
    return { enabled: newValue };
  }

  async toggleWhitelist(domain) {
    const data = await this.storage.get(STORAGE_KEYS.WHITELIST);
    const whitelist = data[STORAGE_KEYS.WHITELIST] || [];
    const index = whitelist.indexOf(domain);

    if (index >= 0) {
      whitelist.splice(index, 1);
    } else {
      whitelist.push(domain);
    }

    await this.storage.set({ [STORAGE_KEYS.WHITELIST]: whitelist });
    this.broadcastSettingsChange({ whitelist });
    return { whitelist };
  }

  async getStats() {
    const data = await this.storage.get(STORAGE_KEYS.STATS);
    return data[STORAGE_KEYS.STATS] || { totalRemoved: 0, sessionRemoved: 0 };
  }

  async incrementStats(count) {
    const data = await this.storage.get(STORAGE_KEYS.STATS);
    const stats = data[STORAGE_KEYS.STATS] || { totalRemoved: 0, sessionRemoved: 0 };
    stats.totalRemoved += count;
    stats.sessionRemoved += count;
    await this.storage.set({ [STORAGE_KEYS.STATS]: stats });
    this.broadcastSettingsChange({ stats });
    return stats;
  }

  async resetSessionStats() {
    const data = await this.storage.get(STORAGE_KEYS.STATS);
    const stats = data[STORAGE_KEYS.STATS] || { totalRemoved: 0, sessionRemoved: 0 };
    stats.sessionRemoved = 0;
    await this.storage.set({ [STORAGE_KEYS.STATS]: stats });
  }

  async addCustomSelector(selector) {
    const data = await this.storage.get(STORAGE_KEYS.CUSTOM_SELECTORS);
    const selectors = data[STORAGE_KEYS.CUSTOM_SELECTORS] || [];
    if (!selectors.includes(selector)) {
      selectors.push(selector);
      await this.storage.set({ [STORAGE_KEYS.CUSTOM_SELECTORS]: selectors });
      this.broadcastSettingsChange({ customSelectors: selectors });
    }
    return { customSelectors: selectors };
  }

  async removeCustomSelector(selector) {
    const data = await this.storage.get(STORAGE_KEYS.CUSTOM_SELECTORS);
    const selectors = (data[STORAGE_KEYS.CUSTOM_SELECTORS] || []).filter(s => s !== selector);
    await this.storage.set({ [STORAGE_KEYS.CUSTOM_SELECTORS]: selectors });
    this.broadcastSettingsChange({ customSelectors: selectors });
    return { customSelectors: selectors };
  }

  broadcastSettingsChange(changes) {
    this.browser.runtime.sendMessage({ type: "SETTINGS_CHANGED", changes }).catch(() => {});
  }

  async maybeUpdateSelectors() {
    const data = await this.storage.get(STORAGE_KEYS.LAST_UPDATE_CHECK);
    const lastCheck = data[STORAGE_KEYS.LAST_UPDATE_CHECK] || 0;
    const now = Date.now();

    if (now - lastCheck >= UPDATE_INTERVAL_MS) {
      await this.updateSelectors(false);
    }
  }

  async updateSelectors(force = false) {
    try {
      const response = await fetch(SELECTORS_REMOTE_URL, { cache: "no-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const remoteSelectors = await response.json();
      const data = await this.storage.get(STORAGE_KEYS.SELECTORS_VERSION);
      const localVersion = data[STORAGE_KEYS.SELECTORS_VERSION] || 0;

      if (force || remoteSelectors.version > localVersion) {
        // Store in local storage for content script access
        await this.storage.set({
          [STORAGE_KEYS.SELECTORS_VERSION]: remoteSelectors.version,
          "remoteSelectors": remoteSelectors.selectors
        });

        // Notify content scripts
        this.browser.runtime.sendMessage({
          type: "SELECTORS_UPDATED",
          selectors: remoteSelectors.selectors,
          version: remoteSelectors.version
        }).catch(() => {});
      }

      await this.storage.set({ [STORAGE_KEYS.LAST_UPDATE_CHECK]: Date.now() });
      return { success: true, version: remoteSelectors.version };
    } catch (error) {
      console.error("Failed to update selectors:", error);
      return { success: false, error: error.message };
    }
  }

  startPeriodicUpdateCheck() {
    setInterval(() => this.maybeUpdateSelectors(), UPDATE_INTERVAL_MS);
  }
}

// Initialize
new BackgroundManager();