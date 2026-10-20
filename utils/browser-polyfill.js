// Browser API Polyfill - Unifies chrome.* and browser.* APIs
// Provides consistent Promise-based API across Chrome, Firefox, Edge

class BrowserPolyfill {
  constructor() {
    this.api = typeof browser !== "undefined" ? browser : chrome;
    this.isFirefox = typeof browser !== "undefined";
  }

  static getInstance() {
    if (!BrowserPolyfill.instance) {
      BrowserPolyfill.instance = new BrowserPolyfill();
    }
    return BrowserPolyfill.instance;
  }

  get runtime() {
    return this.api.runtime;
  }

  get storage() {
    return this.api.storage;
  }

  get tabs() {
    return this.api.tabs;
  }

  get scripting() {
    return this.api.scripting;
  }

  get declarativeNetRequest() {
    return this.api.declarativeNetRequest;
  }

  get i18n() {
    return this.api.i18n;
  }

  // Wrap callback-based APIs to return Promises
  async sendMessage(message, options) {
    return new Promise((resolve, reject) => {
      this.runtime.sendMessage(message, options, (response) => {
        if (this.runtime.lastError) {
          reject(new Error(this.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  async getStorage(keys) {
    return new Promise((resolve, reject) => {
      this.storage.local.get(keys, (result) => {
        if (this.runtime.lastError) {
          reject(new Error(this.runtime.lastError.message));
        } else {
          resolve(result);
        }
      });
    });
  }

  async setStorage(items) {
    return new Promise((resolve, reject) => {
      this.storage.local.set(items, () => {
        if (this.runtime.lastError) {
          reject(new Error(this.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  async removeStorage(keys) {
    return new Promise((resolve, reject) => {
      this.storage.local.remove(keys, () => {
        if (this.runtime.lastError) {
          reject(new Error(this.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  async queryTabs(queryInfo) {
    return new Promise((resolve, reject) => {
      this.tabs.query(queryInfo, (tabs) => {
        if (this.runtime.lastError) {
          reject(new Error(this.runtime.lastError.message));
        } else {
          resolve(tabs);
        }
      });
    });
  }

  async createTab(createProperties) {
    return new Promise((resolve, reject) => {
      this.tabs.create(createProperties, (tab) => {
        if (this.runtime.lastError) {
          reject(new Error(this.runtime.lastError.message));
        } else {
          resolve(tab);
        }
      });
    });
  }

  async executeScript(target, injection) {
    if (this.scripting?.executeScript) {
      return this.scripting.executeScript(target, injection);
    }
    // Fallback for older APIs
    return new Promise((resolve, reject) => {
      this.tabs.executeScript(target.tabId, injection, (result) => {
        if (this.runtime.lastError) {
          reject(new Error(this.runtime.lastError.message));
        } else {
          resolve(result);
        }
      });
    });
  }

  async insertCSS(target, injection) {
    if (this.scripting?.insertCSS) {
      return this.scripting.insertCSS(target, injection);
    }
    return new Promise((resolve, reject) => {
      this.tabs.insertCSS(target.tabId, injection, () => {
        if (this.runtime.lastError) {
          reject(new Error(this.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  // Firefox-specific: storage.sync vs storage.local
  get syncStorage() {
    return this.isFirefox ? this.api.storage.sync : this.api.storage.sync;
  }

  async getSyncStorage(keys) {
    return new Promise((resolve, reject) => {
      this.syncStorage.get(keys, (result) => {
        if (this.runtime.lastError) {
          reject(new Error(this.runtime.lastError.message));
        } else {
          resolve(result);
        }
      });
    });
  }

  async setSyncStorage(items) {
    return new Promise((resolve, reject) => {
      this.syncStorage.set(items, () => {
        if (this.runtime.lastError) {
          reject(new Error(this.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  // Get extension URL
  getURL(path) {
    return this.runtime.getURL(path);
  }

  // Get manifest
  getManifest() {
    return this.runtime.getManifest();
  }

  // Platform info
  getPlatformInfo() {
    return new Promise((resolve) => {
      this.runtime.getPlatformInfo(resolve);
    });
  }

  // Browser version
  getBrowserVersion() {
    const manifest = this.getManifest();
    return manifest.version;
  }

  // Detect browser type
  getBrowserType() {
    if (this.isFirefox) return "firefox";
    if (navigator.userAgent.includes("Edg/")) return "edge";
    if (navigator.userAgent.includes("Brave")) return "brave";
    return "chrome";
  }
}

export { BrowserPolyfill };