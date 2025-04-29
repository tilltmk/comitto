const vscode = require('vscode');
const path = require('path');

/**
 * Klasse für die Statusanzeige in der Seitenleiste
 */
class StatusViewProvider {
    constructor(context) {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this._context = context;
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element) {
        return element;
    }

    async getChildren(element) {
        if (element) {
            return [];
        }

        const config = vscode.workspace.getConfiguration('comitto');
        const enabled = config.get('autoCommitEnabled');
        const items = [];

        // Status-Element
        const statusItem = new vscode.TreeItem(
            `Status: ${enabled ? 'Aktiviert' : 'Deaktiviert'}`,
            vscode.TreeItemCollapsibleState.None
        );
        statusItem.contextValue = enabled ? 'comitto-status-enabled' : 'comitto-status-disabled';
        statusItem.iconPath = new vscode.ThemeIcon(enabled ? 'play' : 'debug-pause');
        statusItem.command = {
            command: enabled ? 'comitto.disableAutoCommit' : 'comitto.enableAutoCommit',
            title: enabled ? 'Deaktivieren' : 'Aktivieren'
        };
        items.push(statusItem);

        // AI Provider
        const provider = config.get('aiProvider');
        const providerItem = new vscode.TreeItem(
            `KI-Provider: ${getProviderDisplayName(provider)}`,
            vscode.TreeItemCollapsibleState.None
        );
        providerItem.iconPath = new vscode.ThemeIcon('symbol-enum');
        providerItem.command = {
            command: 'comitto.openSettings',
            title: 'Einstellungen öffnen'
        };
        items.push(providerItem);

        // Trigger-Regeln
        const rules = config.get('triggerRules');
        const rulesItem = new vscode.TreeItem(
            `Trigger: ${rules.fileCountThreshold} Dateien / ${rules.minChangeCount} Änderungen`,
            vscode.TreeItemCollapsibleState.None
        );
        rulesItem.iconPath = new vscode.ThemeIcon('trigger');
        rulesItem.command = {
            command: 'comitto.openSettings',
            title: 'Einstellungen öffnen'
        };
        items.push(rulesItem);

        // Manuellen Commit ausführen
        const commitItem = new vscode.TreeItem('Manuellen Commit ausführen');
        commitItem.iconPath = new vscode.ThemeIcon('git-commit');
        commitItem.command = {
            command: 'comitto.performManualCommit',
            title: 'Manuellen Commit ausführen'
        };
        items.push(commitItem);

        return items;
    }
}

/**
 * Klasse für die Einstellungen in der Seitenleiste
 */
class SettingsViewProvider {
    constructor(context) {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this._context = context;
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element) {
        return element;
    }

    async getChildren(element) {
        if (element) {
            return this._getSubSettings(element);
        }

        // Hauptkategorien für Einstellungen
        const items = [];

        // KI-Provider-Einstellungen
        const aiItem = new vscode.TreeItem(
            'KI-Provider',
            vscode.TreeItemCollapsibleState.Collapsed
        );
        aiItem.contextValue = 'ai-provider';
        aiItem.iconPath = new vscode.ThemeIcon('symbol-enum');
        items.push(aiItem);

        // Trigger-Einstellungen
        const triggerItem = new vscode.TreeItem(
            'Trigger-Regeln',
            vscode.TreeItemCollapsibleState.Collapsed
        );
        triggerItem.contextValue = 'trigger-rules';
        triggerItem.iconPath = new vscode.ThemeIcon('trigger');
        items.push(triggerItem);

        // Git-Einstellungen
        const gitItem = new vscode.TreeItem(
            'Git-Einstellungen',
            vscode.TreeItemCollapsibleState.Collapsed
        );
        gitItem.contextValue = 'git-settings';
        gitItem.iconPath = new vscode.ThemeIcon('git-merge');
        items.push(gitItem);

        // Prompt-Vorlage
        const promptItem = new vscode.TreeItem(
            'Prompt-Vorlage',
            vscode.TreeItemCollapsibleState.None
        );
        promptItem.contextValue = 'prompt-template';
        promptItem.iconPath = new vscode.ThemeIcon('edit');
        promptItem.command = {
            command: 'comitto.editPromptTemplate',
            title: 'Prompt-Vorlage bearbeiten'
        };
        items.push(promptItem);

        return items;
    }

    async _getSubSettings(element) {
        const config = vscode.workspace.getConfiguration('comitto');
        const items = [];

        switch (element.contextValue) {
            case 'ai-provider':
                // KI-Provider auswählen
                const aiProvider = config.get('aiProvider');
                const providerItem = new vscode.TreeItem(`Aktiver Provider: ${getProviderDisplayName(aiProvider)}`);
                providerItem.command = {
                    command: 'comitto.selectAiProvider',
                    title: 'KI-Provider auswählen'
                };
                items.push(providerItem);

                // Provider-spezifische Einstellungen
                switch (aiProvider) {
                    case 'ollama':
                        const ollamaModel = config.get('ollama.model');
                        const ollamaModelItem = new vscode.TreeItem(`Ollama-Modell: ${ollamaModel}`);
                        ollamaModelItem.command = {
                            command: 'comitto.editOllamaModel',
                            title: 'Ollama-Modell bearbeiten'
                        };
                        items.push(ollamaModelItem);

                        const ollamaEndpoint = config.get('ollama.endpoint');
                        const ollamaEndpointItem = new vscode.TreeItem(`Endpoint: ${ollamaEndpoint}`);
                        ollamaEndpointItem.command = {
                            command: 'comitto.editOllamaEndpoint',
                            title: 'Ollama-Endpoint bearbeiten'
                        };
                        items.push(ollamaEndpointItem);
                        break;

                    case 'openai':
                        const openaiModel = config.get('openai.model');
                        const openaiModelItem = new vscode.TreeItem(`OpenAI-Modell: ${openaiModel}`);
                        openaiModelItem.command = {
                            command: 'comitto.selectOpenAIModel',
                            title: 'OpenAI-Modell auswählen'
                        };
                        items.push(openaiModelItem);

                        const hasOpenAIKey = !!config.get('openai.apiKey');
                        const openaiKeyItem = new vscode.TreeItem(`API-Schlüssel: ${hasOpenAIKey ? '✓ Konfiguriert' : '✗ Nicht konfiguriert'}`);
                        openaiKeyItem.command = {
                            command: 'comitto.editOpenAIKey',
                            title: 'OpenAI API-Schlüssel bearbeiten'
                        };
                        items.push(openaiKeyItem);
                        break;

                    case 'anthropic':
                        const anthropicModel = config.get('anthropic.model');
                        const anthropicModelItem = new vscode.TreeItem(`Claude-Modell: ${anthropicModel}`);
                        anthropicModelItem.command = {
                            command: 'comitto.selectAnthropicModel',
                            title: 'Claude-Modell auswählen'
                        };
                        items.push(anthropicModelItem);

                        const hasAnthropicKey = !!config.get('anthropic.apiKey');
                        const anthropicKeyItem = new vscode.TreeItem(`API-Schlüssel: ${hasAnthropicKey ? '✓ Konfiguriert' : '✗ Nicht konfiguriert'}`);
                        anthropicKeyItem.command = {
                            command: 'comitto.editAnthropicKey',
                            title: 'Anthropic API-Schlüssel bearbeiten'
                        };
                        items.push(anthropicKeyItem);
                        break;
                }
                break;

            case 'trigger-rules':
                const rules = config.get('triggerRules');

                const fileCountItem = new vscode.TreeItem(`Datei-Anzahl: ${rules.fileCountThreshold}`);
                fileCountItem.command = {
                    command: 'comitto.editFileCountThreshold',
                    title: 'Datei-Anzahl bearbeiten'
                };
                items.push(fileCountItem);

                const changeCountItem = new vscode.TreeItem(`Änderungs-Anzahl: ${rules.minChangeCount}`);
                changeCountItem.command = {
                    command: 'comitto.editMinChangeCount',
                    title: 'Änderungs-Anzahl bearbeiten'
                };
                items.push(changeCountItem);

                const timeThresholdItem = new vscode.TreeItem(`Zeit-Schwellwert: ${rules.timeThresholdMinutes} Minuten`);
                timeThresholdItem.command = {
                    command: 'comitto.editTimeThreshold',
                    title: 'Zeit-Schwellwert bearbeiten'
                };
                items.push(timeThresholdItem);

                const filePatternsItem = new vscode.TreeItem(`Dateimuster: ${rules.filePatterns.join(', ')}`);
                filePatternsItem.command = {
                    command: 'comitto.editFilePatterns',
                    title: 'Dateimuster bearbeiten'
                };
                items.push(filePatternsItem);

                const specificFilesItem = new vscode.TreeItem(`Spezifische Dateien: ${rules.specificFiles.length > 0 ? rules.specificFiles.join(', ') : 'Keine'}`);
                specificFilesItem.command = {
                    command: 'comitto.editSpecificFiles',
                    title: 'Spezifische Dateien bearbeiten'
                };
                items.push(specificFilesItem);
                break;

            case 'git-settings':
                const gitSettings = config.get('gitSettings');

                const autoPushItem = new vscode.TreeItem(`Auto-Push: ${gitSettings.autoPush ? 'Ja' : 'Nein'}`);
                autoPushItem.command = {
                    command: 'comitto.toggleAutoPush',
                    title: 'Auto-Push umschalten'
                };
                items.push(autoPushItem);

                const branchItem = new vscode.TreeItem(`Branch: ${gitSettings.branch || 'Aktueller Branch'}`);
                branchItem.command = {
                    command: 'comitto.editBranch',
                    title: 'Branch bearbeiten'
                };
                items.push(branchItem);

                const langItem = new vscode.TreeItem(`Nachrichtensprache: ${gitSettings.commitMessageLanguage}`);
                langItem.command = {
                    command: 'comitto.selectCommitLanguage',
                    title: 'Sprache auswählen'
                };
                items.push(langItem);

                const styleItem = new vscode.TreeItem(`Nachrichtenstil: ${gitSettings.commitMessageStyle}`);
                styleItem.command = {
                    command: 'comitto.selectCommitStyle',
                    title: 'Stil auswählen'
                };
                items.push(styleItem);

                const useGitignoreItem = new vscode.TreeItem(`Gitignore verwenden: ${gitSettings.useGitignore ? 'Ja' : 'Nein'}`);
                useGitignoreItem.command = {
                    command: 'comitto.toggleUseGitignore',
                    title: 'Gitignore-Verwendung umschalten'
                };
                items.push(useGitignoreItem);
                break;
        }

        return items;
    }
}

/**
 * UI-Hilfsfunktionen
 */

/**
 * Gibt einen anzeigbaren Namen für den KI-Provider zurück
 * @param {string} provider Provider-ID
 * @returns {string} Anzeigename
 */
function getProviderDisplayName(provider) {
    switch (provider) {
        case 'ollama': return 'Ollama (lokal)';
        case 'openai': return 'OpenAI';
        case 'anthropic': return 'Anthropic Claude';
        default: return provider;
    }
}

/**
 * Registriert alle UI-Komponenten
 * @param {vscode.ExtensionContext} context 
 * @returns {Object} Die Provider-Instanzen
 */
function registerUI(context) {
    // Status-Ansicht
    const statusProvider = new StatusViewProvider(context);
    const statusTreeView = vscode.window.createTreeView('comitto-status', {
        treeDataProvider: statusProvider,
        showCollapseAll: false
    });
    context.subscriptions.push(statusTreeView);

    // Einstellungs-Ansicht
    const settingsProvider = new SettingsViewProvider(context);
    const settingsTreeView = vscode.window.createTreeView('comitto-settings', {
        treeDataProvider: settingsProvider,
        showCollapseAll: true
    });
    context.subscriptions.push(settingsTreeView);

    return {
        statusProvider,
        settingsProvider
    };
}

module.exports = {
    registerUI,
    StatusViewProvider,
    SettingsViewProvider
}; 