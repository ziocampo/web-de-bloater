// Options Page Script - Full settings management

import { BrowserPolyfill } from "../utils/browser-polyfill.js";

const browser = BrowserPolyfill.getInstance();

const STORAGE_KEYS = {
  ENABLED: "enabled",
  AUTO_UPDATE: "autoUpdate",
  SHOW_BADGE: "showBadge",
  WHITELIST: "whitelist",
  CUSTOM_SELECTORS: "customSelectors",
  STATS: "stats",
  SELECTORS_VERSION: "selectorsVersion",
  DEBUG_MODE: "debugMode",
  DOMAINS_VISITED: "domainsVisited"
};

const DEFAULTS = {
  [STORAGE_KEYS.ENABLED]: true,
  [STORAGE_KEYS.AUTO_UPDATE]: true,
  [STORAGE_KEYS.SHOW_BADGE]: true,
  [STORAGE_KEYS.WHITELIST]: [],
  [STORAGE_KEYS.CUSTOM_SELECTORS]: [],
  [STORAGE_KEYS.STATS]: { totalRemoved: 0, sessionRemoved: 0 },
  [STORAGE_KEYS.SELECTORS_VERSION]: 0,
  [STORAGE_KEYS.DEBUG_MODE]: false,
  [STORAGE_KEYS.DOMAINS_VISITED]: []
};

class OptionsManager {
  constructor() {
    this.storage = new Map();
    this.currentTab = "general";
    this.init();
  }

  async init() {
    await this.loadI18n();
    await this.loadAllSettings();
    this.setupEventListeners();
    this.renderAll();
    this.showTab("general");
  }

  async loadI18n() {
    const elements = document.querySelectorAll("[data-i18n]");
    for (const el of elements) {
      const key = el.dataset.i18n;
      el.textContent = browser.i18n.getMessage(key) || key;
    }
    const placeholders = document.querySelectorAll("[data-i18n_placeholder]");
    for (const el of placeholders) {
      const key = el.dataset.i18n_placeholder;
      el.placeholder = browser.i18n.getMessage(key) || "";
    }
  }

  async loadAllSettings() {
    const keys = Object.values(STORAGE_KEYS);
    const stored = await browser.getStorage(keys);
    for (const key of keys) {
      this.storage.set(key, stored[key] !== undefined ? stored[key] : DEFAULTS[key]);
    }
  }

  get(key) {
    return this.storage.get(key);
  }

  async set(key, value) {
    this.storage.set(key, value);
    await browser.setStorage({ [key]: value });
  }

  setupEventListeners() {
    // Tab navigation
    document.querySelectorAll(".nav-tab").forEach(tab => {
      tab.addEventListener("click", () => this.showTab(tab.dataset.tab));
    });

    // General settings
    document.getElementById("opt-enabled").addEventListener("change", (e) => {
      this.set(STORAGE_KEYS.ENABLED, e.target.checked);
      this.broadcastChange({ enabled: e.target.checked });
    });

    document.getElementById("opt-auto-update").addEventListener("change", (e) => {
      this.set(STORAGE_KEYS.AUTO_UPDATE, e.target.checked);
    });

    document.getElementById("opt-show-badge").addEventListener("change", (e) => {
      this.set(STORAGE_KEYS.SHOW_BADGE, e.target.checked);
      this.broadcastChange({ showBadge: e.target.checked });
    });

    document.getElementById("opt-reset-stats").addEventListener("click", () => {
      this.resetStats();
    });

    // Custom selectors
    document.getElementById("opt-add-selector").addEventListener("click", () => {
      this.addCustomSelector();
    });
    document.getElementById("opt-selector-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.addCustomSelector();
    });

    document.getElementById("opt-force-update").addEventListener("click", () => {
      this.forceUpdateSelectors();
    });

    // Whitelist
    document.getElementById("opt-add-whitelist").addEventListener("click", () => {
      this.addWhitelistDomain();
    });
    document.getElementById("opt-whitelist-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.addWhitelistDomain();
    });

    // Import/Export
    document.getElementById("opt-export").addEventListener("click", () => {
      this.exportConfig();
    });
    document.getElementById("opt-import-file").addEventListener("change", (e) => {
      this.importConfig(e.target.files[0]);
      e.target.value = "";
    });

    // Debug
    document.getElementById("opt-debug-mode").addEventListener("change", (e) => {
      this.set(STORAGE_KEYS.DEBUG_MODE, e.target.checked);
    });
    document.getElementById("opt-view-logs").addEventListener("click", () => {
      this.toggleLogs();
    });

    // Danger zone
    document.getElementById("opt-reset-all").addEventListener("click", () => {
      this.resetAll();
    });

    // Listen for external changes
    browser.storage.onChanged.addListener((changes) => {
      for (const [key, { newValue }] of Object.entries(changes)) {
        this.storage.set(key, newValue);
      }
      this.renderAll();
    });

    // Listen for background messages
    browser.runtime.onMessage.addListener((message) => {
      if (message.type === "SELECTORS_UPDATED") {
        this.renderSelectorsInfo();
      }
    });
  }

  showTab(tabName) {
    this.currentTab = tabName;

    document.querySelectorAll(".nav-tab").forEach(tab => {
      const active = tab.dataset.tab === tabName;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", active);
    });

    document.querySelectorAll(".tab-panel").forEach(panel => {
      panel.classList.toggle("active", panel.id === `tab-${tabName}`);
    });
  }

  renderAll() {
    this.renderGeneral();
    this.renderSelectors();
    this.renderWhitelist();
    this.renderAdvanced();
    this.renderAbout();
  }

  renderGeneral() {
    document.getElementById("opt-enabled").checked = this.get(STORAGE_KEYS.ENABLED);
    document.getElementById("opt-auto-update").checked = this.get(STORAGE_KEYS.AUTO_UPDATE);
    document.getElementById("opt-show-badge").checked = this.get(STORAGE_KEYS.SHOW_BADGE);

    const stats = this.get(STORAGE_KEYS.STATS) || { totalRemoved: 0, sessionRemoved: 0 };
    const domains = this.get(STORAGE_KEYS.DOMAINS_VISITED) || [];
    document.getElementById("opt-total-removed").textContent = stats.totalRemoved || 0;
    document.getElementById("opt-session-removed").textContent = stats.sessionRemoved || 0;
    document.getElementById("opt-domains-visited").textContent = domains.length;
  }

  renderSelectors() {
    const customSelectors = this.get(STORAGE_KEYS.CUSTOM_SELECTORS) || [];
    const list = document.getElementById("opt-selector-list");
    list.innerHTML = "";

    for (const selector of customSelectors) {
      const li = document.createElement("li");
      li.className = "selector-item";
      li.innerHTML = `
        <code>${this.escapeHtml(selector)}</code>
        <button class="btn-icon btn-danger" data-selector="${this.escapeHtml(selector)}" aria-label="${browser.i18n.getMessage("options_remove")}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      `;
      li.querySelector("button").addEventListener("click", () => this.removeCustomSelector(selector));
      list.appendChild(li);
    }

    this.renderSelectorsInfo();
  }

  async renderSelectorsInfo() {
    try {
      const response = await fetch(browser.getURL("content/selectors.json"));
      if (response.ok) {
        const data = await response.json();
        document.getElementById("opt-selectors-version").textContent = `v${data.version || 0}`;
        document.getElementById("opt-selectors-count").textContent = `${(data.selectors || []).length} selettori`;
        document.getElementById("opt-selectors-code").textContent = JSON.stringify(data.selectors, null, 2);
      }
    } catch {
      document.getElementById("opt-selectors-version").textContent = "v?";
      document.getElementById("opt-selectors-count").textContent = "? selettori";
    }
  }

  renderWhitelist() {
    const whitelist = this.get(STORAGE_KEYS.WHITELIST) || [];
    const list = document.getElementById("opt-whitelist-list");
    list.innerHTML = "";

    for (const domain of whitelist) {
      const li = document.createElement("li");
      li.className = "whitelist-item";
      li.innerHTML = `
        <span>${this.escapeHtml(domain)}</span>
        <button class="btn-icon btn-danger" data-domain="${this.escapeHtml(domain)}" aria-label="${browser.i18n.getMessage("options_remove")}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      `;
      li.querySelector("button").addEventListener("click", () => this.removeWhitelistDomain(domain));
      list.appendChild(li);
    }
  }

  renderAdvanced() {
    document.getElementById("opt-debug-mode").checked = this.get(STORAGE_KEYS.DEBUG_MODE);
    document.getElementById("opt-logs").classList.toggle("hidden", !this.get(STORAGE_KEYS.DEBUG_MODE));
  }

  renderAbout() {
    const manifest = browser.getManifest();
    document.getElementById("opt-version").textContent = manifest.version;
  }

  async addCustomSelector() {
    const input = document.getElementById("opt-selector-input");
    const selector = input.value.trim();
    if (!selector) return;

    const customSelectors = this.get(STORAGE_KEYS.CUSTOM_SELECTORS) || [];
    if (!customSelectors.includes(selector)) {
      customSelectors.push(selector);
      await this.set(STORAGE_KEYS.CUSTOM_SELECTORS, customSelectors);
      this.broadcastChange({ customSelectors });
      input.value = "";
      this.renderSelectors();
    }
  }

  async removeCustomSelector(selector) {
    const customSelectors = (this.get(STORAGE_KEYS.CUSTOM_SELECTORS) || []).filter(s => s !== selector);
    await this.set(STORAGE_KEYS.CUSTOM_SELECTORS, customSelectors);
    this.broadcastChange({ customSelectors });
    this.renderSelectors();
  }

  async addWhitelistDomain() {
    const input = document.getElementById("opt-whitelist-input");
    let domain = input.value.trim().toLowerCase();
    if (!domain) return;

    // Normalize domain
    domain = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];

    const whitelist = this.get(STORAGE_KEYS.WHITELIST) || [];
    if (!whitelist.includes(domain)) {
      whitelist.push(domain);
      await this.set(STORAGE_KEYS.WHITELIST, whitelist);
      this.broadcastChange({ whitelist });
      input.value = "";
      this.renderWhitelist();
    }
  }

  async removeWhitelistDomain(domain) {
    const whitelist = (this.get(STORAGE_KEYS.WHITELIST) || []).filter(d => d !== domain);
    await this.set(STORAGE_KEYS.WHITELIST, whitelist);
    this.broadcastChange({ whitelist });
    this.renderWhitelist();
  }

  async resetStats() {
    await this.set(STORAGE_KEYS.STATS, { totalRemoved: 0, sessionRemoved: 0 });
    this.renderGeneral();
  }

  async forceUpdateSelectors() {
    const btn = document.getElementById("opt-force-update");
    const originalText = btn.textContent;
    btn.textContent = browser.i18n.getMessage("options_updating") || "Aggiornamento...";
    btn.disabled = true;

    try {
      const response = await browser.sendMessage({ type: "FORCE_UPDATE_SELECTORS" });
      if (response?.success) {
        btn.textContent = browser.i18n.getMessage("options_updated") || "Aggiornato!";
        await this.renderSelectorsInfo();
      } else {
        throw new Error(response?.error || "Unknown error");
      }
    } catch (error) {
      btn.textContent = browser.i18n.getMessage("options_update_failed") || "Errore";
      console.error("Force update failed:", error);
    } finally {
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 2000);
    }
  }

  exportConfig() {
    const config = {};
    for (const [key, value] of this.storage.entries()) {
      config[key] = value;
    }
    config.exportedAt = new Date().toISOString();
    config.version = browser.getManifest().version;

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `web-de-bloater-config-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async importConfig(file) {
    if (!file) return;

    try {
      const text = await file.text();
      const config = JSON.parse(text);

      for (const [key, value] of Object.entries(config)) {
        if (Object.values(STORAGE_KEYS).includes(key)) {
          await this.set(key, value);
        }
      }

      this.renderAll();
      alert(browser.i18n.getMessage("options_import_success") || "Configurazione importata con successo!");
    } catch (error) {
      alert(browser.i18n.getMessage("options_import_error") || "Errore durante l'importazione: " + error.message);
    }
  }

  toggleLogs() {
    const logsContainer = document.getElementById("opt-logs");
    logsContainer.classList.toggle("hidden");

    if (!logsContainer.classList.contains("hidden")) {
      // In a real implementation, fetch logs from background
      logsContainer.innerHTML = "<pre>Debug logs would appear here...</pre>";
    }
  }

  async resetAll() {
    const confirmed = confirm(browser.i18n.getMessage("options_confirm_reset") || "Sei sicuro di voler resettare tutto?");
    if (!confirmed) return;

    for (const key of Object.values(STORAGE_KEYS)) {
      await browser.removeStorage(key);
    }
    this.storage.clear();
    for (const [key, value] of Object.entries(DEFAULTS)) {
      this.storage.set(key, value);
      await browser.setStorage({ [key]: value });
    }

    this.renderAll();
    alert(browser.i18n.getMessage("options_reset_done") || "Reset completato!");
  }

  broadcastChange(changes) {
    browser.runtime.sendMessage({ type: "SETTINGS_CHANGED", changes }).catch(() => {});
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

document.addEventListener("DOMContentLoaded", () => new OptionsManager());