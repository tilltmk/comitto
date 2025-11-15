const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

/**
 * Internationalization (i18n) system for Comitto
 * Supports multiple languages with fallback to English
 */
class I18n {
    constructor() {
        this.translations = {};
        this.currentLanguage = 'de'; // Default to German
        this.supportedLanguages = ['de', 'en', 'fr', 'es', 'it', 'ja', 'zh'];
        this.loadTranslations();
    }

    /**
     * Load translation files
     */
    loadTranslations() {
        const localesPath = path.join(__dirname);

        // Load German and English translations (required)
        ['de', 'en'].forEach(lang => {
            try {
                const filePath = path.join(localesPath, `${lang}.json`);
                if (fs.existsSync(filePath)) {
                    this.translations[lang] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                }
            } catch (error) {
                console.error(`Failed to load ${lang} translations:`, error);
            }
        });
    }

    /**
     * Set the current UI language
     * @param {string} language - Language code (e.g., 'de', 'en')
     */
    setLanguage(language) {
        if (this.translations[language]) {
            this.currentLanguage = language;
        } else {
            console.warn(`Language '${language}' not available, falling back to English`);
            this.currentLanguage = 'en';
        }
    }

    /**
     * Get the current language from VSCode settings
     */
    getCurrentLanguage() {
        // Try to get UI language from settings
        const config = vscode.workspace.getConfiguration('comitto');
        const uiLanguage = config.get('uiLanguage');

        if (uiLanguage && this.translations[uiLanguage]) {
            return uiLanguage;
        }

        // Fallback to VSCode's display language
        const vscodeLocale = vscode.env.language;
        if (vscodeLocale) {
            const lang = vscodeLocale.split('-')[0]; // 'de-DE' -> 'de'
            if (this.translations[lang]) {
                return lang;
            }
        }

        // Final fallback to German (default)
        return 'de';
    }

    /**
     * Get a translated string by key path
     * @param {string} key - Dot-notation key path (e.g., 'models.selectOllama')
     * @param {object} params - Parameters to replace in the string (e.g., {model: 'gpt-4'})
     * @returns {string} Translated string
     */
    t(key, params = {}) {
        const lang = this.getCurrentLanguage();
        let translation = this.getNestedValue(this.translations[lang], key);

        // Fallback to English if translation not found
        if (!translation && lang !== 'en') {
            translation = this.getNestedValue(this.translations['en'], key);
        }

        // Final fallback to key itself
        if (!translation) {
            console.warn(`Translation missing for key: ${key} (language: ${lang})`);
            return key;
        }

        // Replace parameters in the string
        return this.replaceParams(translation, params);
    }

    /**
     * Get nested value from object using dot notation
     * @param {object} obj - Object to search
     * @param {string} path - Dot-notation path
     * @returns {any} Value at the path
     */
    getNestedValue(obj, path) {
        if (!obj) return null;

        const keys = path.split('.');
        let value = obj;

        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return null;
            }
        }

        return value;
    }

    /**
     * Replace parameters in a string
     * @param {string} str - String with parameters like {name}
     * @param {object} params - Parameters to replace
     * @returns {string} String with replaced parameters
     */
    replaceParams(str, params) {
        if (!params || typeof params !== 'object') {
            return str;
        }

        return str.replace(/\{(\w+)\}/g, (match, key) => {
            return params[key] !== undefined ? params[key] : match;
        });
    }

    /**
     * Get language display name
     * @param {string} code - Language code
     * @returns {string} Display name
     */
    getLanguageDisplayName(code) {
        const names = {
            'de': 'Deutsch',
            'en': 'English',
            'fr': 'Français',
            'es': 'Español',
            'it': 'Italiano',
            'ja': '日本語',
            'zh': '中文'
        };
        return names[code] || code;
    }

    /**
     * Get all supported languages with their display names
     * @returns {Array} Array of {code, name} objects
     */
    getSupportedLanguages() {
        return this.supportedLanguages.map(code => ({
            code,
            name: this.getLanguageDisplayName(code)
        }));
    }
}

// Export singleton instance
const i18n = new I18n();
module.exports = i18n;
