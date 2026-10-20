// Storage Manager - Unified wrapper for chrome.storage / browser.storage
// Handles both local and sync storage with fallback

import { BrowserPolyfill } from "./browser-polyfill.js";

export class StorageManager {
  constructor() {
    this.browser = BrowserPolyfill.getInstance();
    this.cache = new Map();
    this.initialized = false;
  }

  async init(defaults = {}) {
    if (this.initialized) return;

    // Load all defaults into cache
    const stored = await this.browser.getStorage(Object.keys(defaults));
    for (const [key, defaultValue] of Object.entries(defaults)) {
      this.cache.set(key, stored[key] !== undefined ? stored[key] : defaultValue);
    }
    this.initialized = true;
  }

  async get(keys) {
    if (!this.initialized) await this.init();

    const keyArray = Array.isArray(keys) ? keys : [keys];
    const result = {};

    for (const key of keyArray) {
      if (this.cache.has(key)) {
        result[key] = this.cache.get(key);
      } else {
        const stored = await this.browser.getStorage(key);
        result[key] = stored[key];
        this.cache.set(key, result[key]);
      }
    }

    return Array.isArray(keys) ? result : result[keys];
  }

  async set(items) {
    if (!this.initialized) await this.init();

    const entries = Object.entries(items);
    await this.browser.setStorage(items);

    for (const [key, value] of entries) {
      this.cache.set(key, value);
    }
  }

  async remove(keys) {
    if (!this.initialized) await this.init();

    const keyArray = Array.isArray(keys) ? keys : [keys];
    await this.browser.removeStorage(keyArray);

    for (const key of keyArray) {
      this.cache.delete(key);
    }
  }

  async clear() {
    await this.browser.storage.local.clear();
    this.cache.clear();
  }

  // Sync storage for cross-device settings
  async getSync(keys) {
    const keyArray = Array.isArray(keys) ? keys : [keys];
    const result = await this.browser.getSyncStorage(keyArray);
    return Array.isArray(keys) ? result : result[keys];
  }

  async setSync(items) {
    await this.browser.setSyncStorage(items);
  }

  // Observe changes
  onChanged(callback) {
    this.browser.storage.onChanged.addListener((changes, areaName) => {
      for (const [key, { newValue }] of Object.entries(changes)) {
        this.cache.set(key, newValue);
      }
      callback(changes, areaName);
    });
  }

  // Get all stored data (for export/backup)
  async getAll() {
    return new Promise((resolve, reject) => {
      this.browser.storage.local.get(null, (result) => {
        if (this.browser.runtime.lastError) {
          reject(new Error(this.browser.runtime.lastError.message));
        } else {
          resolve(result);
        }
      });
    });
  }
}