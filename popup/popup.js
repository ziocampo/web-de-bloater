// Popup Script - Handles UI interactions for the extension popup

import { BrowserPolyfill } from "../utils/browser-polyfill.js";

const browser = BrowserPolyfill.getInstance();

class PopupManager {
  constructor() {
    this.currentDomain = "";
    this.init();
  }

  async init() {
    await this.loadI18n();
    this.setupEventListeners();
    await this.loadState();
    this.updateVersion();
  }

  async loadI18n() {
    const elements = document.querySelectorAll("[data-i18n]");
    for (const el of elements) {
      const key = el.dataset.i18n;
      el.textContent = browser.i18n.getMessage(key) || key;
    }
  }

  setupEventListeners() {
    document.getElementById("enabled-toggle").addEventListener("change", (e) => {
      this.toggleEnabled(e.target.checked);
    });

    document.getElementById("whitelist-toggle").addEventListener("change", (e) => {
      this.toggleWhitelist(e.target.checked);
    });

    document.getElementById("options-btn").addEventListener("click", () => {
      browser.runtime.openOptionsPage();
      window.close();
    });

    document.getElementById("update-btn").addEventListener("click", () => {
      this.forceUpdateSelectors();
    });

    // Listen for settings changes from background
    browser.runtime.onMessage.addListener((message) => {
      if (message.type === "SETTINGS_CHANGED") {
        this.applySettingsChanges(message.changes);
      }
    });
  }

  async loadState() {
    try {
      // Get current tab domain
      const tabs = await browser.queryTabs({ active: true, currentWindow: true });
      if (tabs[0]?.url) {
        this.currentDomain = new URL(tabs[0].url).hostname;
      }

      // Load settings from background
      const response = await browser.sendMessage({ type: "GET_SETTINGS" });
      if (response) {
        this.applySettings(response);
      }

      // Load stats
      const stats = await browser.sendMessage({ type: "GET_STATS" });
      if (stats) {
        this.updateStats(stats);
      }

      // Update whitelist toggle state
      this.updateWhitelistToggle();
    } catch (error) {
      console.error("Popup: Failed to load state", error);
    }
  }

  applySettings(settings) {
    const enabledToggle = document.getElementById("enabled-toggle");
    enabledToggle.checked = settings.enabled !== false;
    enabledToggle.nextElementSibling.nextElementSibling.textContent =
      browser.i18n.getMessage(settings.enabled !== false ? "popup_enabled" : "popup_disabled");
  }

  applySettingsChanges(changes) {
    if (changes.enabled !== undefined) {
      const enabledToggle = document.getElementById("enabled-toggle");
      enabledToggle.checked = changes.enabled.newValue;
      enabledToggle.nextElementSibling.nextElementSibling.textContent =
        browser.i18n.getMessage(changes.enabled.newValue ? "popup_enabled" : "popup_disabled");
    }
    if (changes.whitelist !== undefined) {
      this.updateWhitelistToggle();
    }
  }

  updateWhitelistToggle() {
    const whitelistToggle = document.getElementById("whitelist-toggle");
    const response = browser.sendMessage({ type: "GET_SETTINGS" }).then(settings => {
      if (settings?.whitelist?.includes(this.currentDomain)) {
        whitelistToggle.checked = true;
        whitelistToggle.nextElementSibling.nextElementSibling.textContent =
          browser.i18n.getMessage("popup_whitelist_on");
      } else {
        whitelistToggle.checked = false;
        whitelistToggle.nextElementSibling.nextElementSibling.textContent =
          browser.i18n.getMessage("popup_whitelist_off");
      }
    });
  }

  async toggleEnabled(enabled) {
    const response = await browser.sendMessage({ type: "TOGGLE_ENABLED" });
    if (response) {
      const toggle = document.getElementById("enabled-toggle");
      toggle.nextElementSibling.nextElementSibling.textContent =
        browser.i18n.getMessage(response.enabled ? "popup_enabled" : "popup_disabled");
    }
  }

  async toggleWhitelist(whitelisted) {
    if (!this.currentDomain) return;

    const response = await browser.sendMessage({
      type: "TOGGLE_WHITELIST",
      domain: this.currentDomain
    });

    if (response) {
      const toggle = document.getElementById("whitelist-toggle");
      toggle.nextElementSibling.nextElementSibling.textContent =
        browser.i18n.getMessage(response.whitelist.includes(this.currentDomain) ? "popup_whitelist_on" : "popup_whitelist_off");
    }
  }

  updateStats(stats) {
    document.getElementById("session-stats").textContent = stats.sessionRemoved || 0;
    document.getElementById("total-stats").textContent = stats.totalRemoved || 0;
  }

  async forceUpdateSelectors() {
    const btn = document.getElementById("update-btn");
    const originalText = btn.textContent;
    btn.textContent = browser.i18n.getMessage("popup_updating") || "Aggiornamento...";
    btn.disabled = true;

    try {
      const response = await browser.sendMessage({ type: "FORCE_UPDATE_SELECTORS" });
      if (response?.success) {
        btn.textContent = browser.i18n.getMessage("popup_updated") || "Aggiornato!";
        setTimeout(() => {
          btn.textContent = originalText;
          btn.disabled = false;
        }, 2000);
      } else {
        throw new Error(response?.error || "Unknown error");
      }
    } catch (error) {
      btn.textContent = browser.i18n.getMessage("popup_update_failed") || "Errore";
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 3000);
    }
  }

  updateVersion() {
    const manifest = browser.getManifest();
    document.getElementById("version").textContent = `v${manifest.version}`;
  }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => new PopupManager());