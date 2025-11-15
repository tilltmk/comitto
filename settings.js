const vscode = require('vscode');

const DEFAULTS = {
    autoCommitEnabled: false,
    triggerRules: {
        onSave: true,
        onInterval: false,
        onBranchSwitch: false,
        fileCountThreshold: 3,
        minChangeCount: 10,
        timeThresholdMinutes: 30,
        intervalMinutes: 15,
        filePatterns: ['**/*'],
        specificFiles: []
    },
    gitSettings: {
        autoPush: false,
        pushOptions: '',
        pushRetryCount: 3,
        pullBeforePush: true,
        stageMode: 'all',
        specificStagingPatterns: [],
        branch: '',
        useGitignore: true,
        commitMessageStyle: 'gitmoji',
        commitMessageLanguage: 'de',
        maxCommitAttempts: 3,
        repositoryPath: ''
    },
    aiProvider: 'openai',
    openai: {
        apiKey: '',
        model: 'gpt-4.1-mini'
    },
    ollama: {
        endpoint: 'http://localhost:11434/api/generate',
        model: 'granite3.3:2b'
    },
    anthropic: {
        apiKey: '',
        model: 'claude-3-haiku-20240307'
    },
    promptTemplate: `Generiere eine aussagekräftige Commit-Nachricht basierend auf den folgenden Änderungen.\n\nVerwende je nach Stil:\n- Conventional Commits: feat/fix/docs/style/etc.\n- Gitmoji: 🎉/🐛/📚/💄/etc.\n- Angular: type(scope): description\n- Atom: :emoji: description\n- Simple: Einfache beschreibende Nachrichten\n\nHalte sie unter 72 Zeichen. Hier sind die Änderungen:\n\n{changes}`,
    uiLanguage: 'de',
    uiSettings: {
        simpleMode: false,
        confirmBeforeCommit: true,
        showNotifications: true,
        theme: 'auto'
    },
    notifications: {
        onCommit: true,
        onPush: true,
        onError: true,
        onTriggerFired: false
    },
    debug: {
        enabled: false,
        extendedLogging: false,
        commitDiagnostics: false
    },
    guardian: {
        smartCommitProtection: true,
        coolDownMinutes: 5,
        maxFilesWithoutPrompt: 8,
        confirmOnLargeChanges: true,
        maxDiffSizeKb: 512,
        blockOnDirtyWorkspace: true,
        skipWhenDebugging: true,
        quietHours: [],
        protectedBranches: ['main', 'master', 'release/*'],
        keywordsRequiringConfirmation: ['WIP', 'DO-NOT-COMMIT']
    }
};

function toBoolean(value, fallback) {
    return typeof value === 'boolean' ? value : fallback;
}

function toPositiveInt(value, fallback, { allowZero = true, min = 0 } = {}) {
    const num = Number(value);
    if (!Number.isFinite(num)) {
        return fallback;
    }
    const normalized = Math.trunc(num);
    if (!allowZero && normalized === 0) {
        return fallback;
    }
    if (normalized < min) {
        return fallback;
    }
    return normalized;
}

function toStringValue(value, fallback, { trimResult = true } = {}) {
    if (typeof value !== 'string') {
        return fallback;
    }
    return trimResult ? value.trim() : value;
}

function ensureStringArray(value, fallback, { filterEmpty = true } = {}) {
    if (!Array.isArray(value)) {
        return [...fallback];
    }
    const cleaned = value
        .map(item => typeof item === 'string' ? item.trim() : '')
        .filter(item => filterEmpty ? item.length > 0 : true);
    if (cleaned.length === 0 && fallback.length > 0) {
        return [...fallback];
    }
    return cleaned;
}

function sanitizeTriggerRules(raw = {}) {
    const defaults = DEFAULTS.triggerRules;
    return {
        onSave: toBoolean(raw.onSave, defaults.onSave),
        onInterval: toBoolean(raw.onInterval, defaults.onInterval),
        onBranchSwitch: toBoolean(raw.onBranchSwitch, defaults.onBranchSwitch),
        fileCountThreshold: toPositiveInt(raw.fileCountThreshold, defaults.fileCountThreshold),
        minChangeCount: toPositiveInt(raw.minChangeCount, defaults.minChangeCount),
        timeThresholdMinutes: toPositiveInt(raw.timeThresholdMinutes, defaults.timeThresholdMinutes, { min: 1 }),
        intervalMinutes: toPositiveInt(raw.intervalMinutes, defaults.intervalMinutes, { min: 1 }),
        filePatterns: ensureStringArray(raw.filePatterns, defaults.filePatterns),
        specificFiles: ensureStringArray(raw.specificFiles, defaults.specificFiles, { filterEmpty: true })
    };
}

function sanitizeGitSettings(raw = {}) {
    const defaults = DEFAULTS.gitSettings;
    const allowedStageModes = new Set(['all', 'specific', 'prompt', 'ask']);
    const allowedStyles = new Set(['conventional', 'gitmoji', 'simple', 'angular', 'atom']);
    return {
        autoPush: toBoolean(raw.autoPush, defaults.autoPush),
        pushOptions: toStringValue(raw.pushOptions, defaults.pushOptions, { trimResult: false }),
        pushRetryCount: toPositiveInt(raw.pushRetryCount, defaults.pushRetryCount),
        pullBeforePush: toBoolean(raw.pullBeforePush, defaults.pullBeforePush),
        stageMode: allowedStageModes.has(raw.stageMode) ? raw.stageMode : defaults.stageMode,
        specificStagingPatterns: ensureStringArray(raw.specificStagingPatterns, defaults.specificStagingPatterns),
        branch: toStringValue(raw.branch, defaults.branch),
        useGitignore: toBoolean(raw.useGitignore, defaults.useGitignore),
        commitMessageStyle: allowedStyles.has(raw.commitMessageStyle) ? raw.commitMessageStyle : defaults.commitMessageStyle,
        commitMessageLanguage: toStringValue(raw.commitMessageLanguage, defaults.commitMessageLanguage),
        maxCommitAttempts: toPositiveInt(raw.maxCommitAttempts, defaults.maxCommitAttempts, { min: 1 }),
        repositoryPath: toStringValue(raw.repositoryPath, defaults.repositoryPath)
    };
}

function sanitizeAIProvider(value) {
    const allowedProviders = new Set(['openai', 'anthropic', 'ollama']);
    return allowedProviders.has(value) ? value : DEFAULTS.aiProvider;
}

function sanitizeOpenAI(raw = {}) {
    const defaults = DEFAULTS.openai;
    return {
        apiKey: toStringValue(raw.apiKey, defaults.apiKey, { trimResult: false }),
        model: toStringValue(raw.model, defaults.model)
    };
}

function sanitizeAnthropic(raw = {}) {
    const defaults = DEFAULTS.anthropic;
    return {
        apiKey: toStringValue(raw.apiKey, defaults.apiKey, { trimResult: false }),
        model: toStringValue(raw.model, defaults.model)
    };
}

function sanitizeOllama(raw = {}) {
    const defaults = DEFAULTS.ollama;
    return {
        endpoint: toStringValue(raw.endpoint, defaults.endpoint),
        model: toStringValue(raw.model, defaults.model)
    };
}

function sanitizePromptTemplate(value) {
    const result = toStringValue(value, DEFAULTS.promptTemplate, { trimResult: false });
    return result || DEFAULTS.promptTemplate;
}

function sanitizeUISettings(raw = {}) {
    const defaults = DEFAULTS.uiSettings;
    const theme = toStringValue(raw.theme, defaults.theme);
    const allowedThemes = new Set(['auto', 'hell', 'dunkel', 'contrast']);
    return {
        simpleMode: toBoolean(raw.simpleMode, defaults.simpleMode),
        confirmBeforeCommit: toBoolean(raw.confirmBeforeCommit, defaults.confirmBeforeCommit),
        showNotifications: toBoolean(raw.showNotifications, defaults.showNotifications),
        theme: allowedThemes.has(theme) ? theme : defaults.theme
    };
}

function sanitizeNotifications(raw = {}) {
    const defaults = DEFAULTS.notifications;
    return {
        onCommit: toBoolean(raw.onCommit, defaults.onCommit),
        onPush: toBoolean(raw.onPush, defaults.onPush),
        onError: toBoolean(raw.onError, defaults.onError),
        onTriggerFired: toBoolean(raw.onTriggerFired, defaults.onTriggerFired)
    };
}

function sanitizeDebug(raw = {}) {
    const defaults = DEFAULTS.debug;
    return {
        enabled: toBoolean(raw.enabled, defaults.enabled),
        extendedLogging: toBoolean(raw.extendedLogging, defaults.extendedLogging),
        commitDiagnostics: toBoolean(raw.commitDiagnostics, defaults.commitDiagnostics)
    };
}

function sanitizeGuardian(raw = {}) {
    const defaults = DEFAULTS.guardian;
    return {
        smartCommitProtection: toBoolean(raw.smartCommitProtection, defaults.smartCommitProtection),
        coolDownMinutes: toPositiveInt(raw.coolDownMinutes, defaults.coolDownMinutes),
        maxFilesWithoutPrompt: toPositiveInt(raw.maxFilesWithoutPrompt, defaults.maxFilesWithoutPrompt),
        confirmOnLargeChanges: toBoolean(raw.confirmOnLargeChanges, defaults.confirmOnLargeChanges),
        maxDiffSizeKb: toPositiveInt(raw.maxDiffSizeKb, defaults.maxDiffSizeKb, { min: 32 }),
        blockOnDirtyWorkspace: toBoolean(raw.blockOnDirtyWorkspace, defaults.blockOnDirtyWorkspace),
        skipWhenDebugging: toBoolean(raw.skipWhenDebugging, defaults.skipWhenDebugging),
        quietHours: ensureStringArray(raw.quietHours, defaults.quietHours, { filterEmpty: true }),
        protectedBranches: ensureStringArray(raw.protectedBranches, defaults.protectedBranches),
        keywordsRequiringConfirmation: ensureStringArray(raw.keywordsRequiringConfirmation, defaults.keywordsRequiringConfirmation)
    };
}

function deepFreeze(obj) {
    if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
        Object.freeze(obj);
        for (const value of Object.values(obj)) {
            deepFreeze(value);
        }
    }
    return obj;
}

class SettingsManager {
    constructor() {
        this._listeners = new Set();
        this._legacyValues = {};
        this._settings = deepFreeze(this._computeSettings());
        this._configurationWatcher = vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('comitto')) {
                this._refresh();
            }
        });
    }

    _computeSettings() {
        const config = vscode.workspace.getConfiguration('comitto');
        const legacyOllamaModel = config.get('ollama-model');
        this._legacyValues['ollama-model'] = legacyOllamaModel;

        return {
            autoCommitEnabled: toBoolean(config.get('autoCommitEnabled'), DEFAULTS.autoCommitEnabled),
            triggerRules: sanitizeTriggerRules(config.get('triggerRules')),
            gitSettings: sanitizeGitSettings(config.get('gitSettings')),
            aiProvider: sanitizeAIProvider(config.get('aiProvider')),
            openai: sanitizeOpenAI(config.get('openai')),
            ollama: sanitizeOllama(config.get('ollama')),
            anthropic: sanitizeAnthropic(config.get('anthropic')),
            promptTemplate: sanitizePromptTemplate(config.get('promptTemplate')),
            uiSettings: sanitizeUISettings(config.get('uiSettings')),
            notifications: sanitizeNotifications(config.get('notifications')),
            debug: sanitizeDebug(config.get('debug')),
            guardian: sanitizeGuardian(config.get('guardian'))
        };
    }

    _refresh() {
        this._settings = deepFreeze(this._computeSettings());
        for (const listener of this._listeners) {
            try {
                listener(this._settings);
            } catch (error) {
                console.error('SettingsManager Listener Fehler:', error);
            }
        }
    }

    getAll() {
        return this._settings;
    }

    get(path) {
        if (!path) {
            return this.getAll();
        }
        const segments = path.split('.');
        let current = this._settings;
        for (const segment of segments) {
            if (current && Object.prototype.hasOwnProperty.call(current, segment)) {
                current = current[segment];
            } else {
                return undefined;
            }
        }
        return current;
    }

    onDidChange(listener) {
        this._listeners.add(listener);
        return {
            dispose: () => {
                this._listeners.delete(listener);
            }
        };
    }

    getLegacyValue(key) {
        return this._legacyValues[key];
    }

    async update(path, value, target = vscode.ConfigurationTarget.Global) {
        const config = vscode.workspace.getConfiguration('comitto');
        await config.update(path, value, target);
        this._refresh();
    }

    dispose() {
        if (this._configurationWatcher) {
            this._configurationWatcher.dispose();
            this._configurationWatcher = undefined;
        }
        this._listeners.clear();
    }
}

module.exports = new SettingsManager();
