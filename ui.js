const vscode = require('vscode');
const path = require('path');
const settings = require('./settings');

/**
 * Hauptklasse für die konsolidierte Ansicht in der Seitenleiste
 * Kombiniert Status, Schnellaktionen und Einstellungen in einer redundanzfreien Struktur
 */
class MainViewProvider {
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
            return this._getSubItems(element);
        }

        const enabled = settings.get('autoCommitEnabled');
        const items = [];

        // Status und Schnellaktionen
        const statusGroup = new vscode.TreeItem(
            'Status und Schnellaktionen',
            vscode.TreeItemCollapsibleState.Expanded
        );
        statusGroup.contextValue = 'status-group';
        statusGroup.iconPath = new vscode.ThemeIcon('pulse');
        items.push(statusGroup);

        // Git Einstellungen
        const gitGroup = new vscode.TreeItem(
            'Git Konfiguration',
            vscode.TreeItemCollapsibleState.Expanded
        );
        gitGroup.contextValue = 'git-group';
        gitGroup.iconPath = new vscode.ThemeIcon('git-branch');
        items.push(gitGroup);

        // KI Provider Einstellungen
        const aiGroup = new vscode.TreeItem(
            'KI Provider',
            vscode.TreeItemCollapsibleState.Expanded
        );
        aiGroup.contextValue = 'ai-group';
        aiGroup.iconPath = new vscode.ThemeIcon('robot');
        items.push(aiGroup);

        // Trigger Einstellungen
        const triggerGroup = new vscode.TreeItem(
            'Trigger Regeln',
            vscode.TreeItemCollapsibleState.Expanded
        );
        triggerGroup.contextValue = 'trigger-group';
        triggerGroup.iconPath = new vscode.ThemeIcon('settings-gear');
        items.push(triggerGroup);

        // UI Einstellungen
        const uiGroup = new vscode.TreeItem(
            'Benutzeroberfläche',
            vscode.TreeItemCollapsibleState.Expanded
        );
        uiGroup.contextValue = 'ui-group';
        uiGroup.iconPath = new vscode.ThemeIcon('layout');
        items.push(uiGroup);

        return items;
    }

    async _getSubItems(element) {

        switch (element.contextValue) {
            case 'status-group':
                return this._getStatusItems();
            case 'git-group':
                return this._getGitItems();
            case 'ai-group':
                return this._getAIItems();
            case 'trigger-group':
                return this._getTriggerItems();
            case 'ui-group':
                return this._getUIItems();
            default:
                return [];
        }
    }

    async _getStatusItems() {
        const enabled = settings.get('autoCommitEnabled');
        const items = [];

        // Hauptstatus
        const statusItem = new vscode.TreeItem(
            `Comitto: ${enabled ? 'Aktiv' : 'Inaktiv'}`,
            vscode.TreeItemCollapsibleState.None
        );
        statusItem.contextValue = enabled ? 'comitto-status-enabled' : 'comitto-status-disabled';
        statusItem.iconPath = new vscode.ThemeIcon(enabled ? 'check-all' : 'circle-slash');
        statusItem.tooltip = enabled ? 'Auto-Commits sind aktiviert' : 'Auto-Commits sind deaktiviert';
        statusItem.command = {
            command: 'comitto.toggleAutoCommit',
            title: 'Toggle Auto-Commit'
        };
        items.push(statusItem);

        // Manueller Commit
        const manualCommitItem = new vscode.TreeItem(
            'Manueller Commit',
            vscode.TreeItemCollapsibleState.None
        );
        manualCommitItem.iconPath = new vscode.ThemeIcon('git-commit');
        manualCommitItem.tooltip = 'Führt einen manuellen KI-Commit aus';
        manualCommitItem.command = {
            command: 'comitto.manualCommit',
            title: 'Manual Commit'
        };
        items.push(manualCommitItem);

        // Alle Dateien stagen
        const stageAllItem = new vscode.TreeItem(
            'Alle Dateien stagen',
            vscode.TreeItemCollapsibleState.None
        );
        stageAllItem.iconPath = new vscode.ThemeIcon('add');
        stageAllItem.tooltip = 'Staged alle geänderten Dateien';
        stageAllItem.command = {
            command: 'comitto.stageAll',
            title: 'Stage All'
        };
        items.push(stageAllItem);

        // Ausgewählte Dateien stagen
        const stageSelectedItem = new vscode.TreeItem(
            'Ausgewählte Dateien stagen',
            vscode.TreeItemCollapsibleState.None
        );
        stageSelectedItem.iconPath = new vscode.ThemeIcon('checklist');
        stageSelectedItem.tooltip = 'Ermöglicht Auswahl bestimmter Dateien zum Stagen';
        stageSelectedItem.command = {
            command: 'comitto.stageSelected',
            title: 'Stage Selected Files'
        };
        items.push(stageSelectedItem);

        // Dashboard öffnen
        const dashboardItem = new vscode.TreeItem(
            'Dashboard öffnen',
            vscode.TreeItemCollapsibleState.None
        );
        dashboardItem.iconPath = new vscode.ThemeIcon('dashboard');
        dashboardItem.tooltip = 'Öffnet das erweiterte Dashboard';
        dashboardItem.command = {
            command: 'comitto.showDashboard',
            title: 'Show Dashboard'
        };
        items.push(dashboardItem);

        // Einfache UI öffnen
        const simpleUIItem = new vscode.TreeItem(
            'Einfache Oberfläche',
            vscode.TreeItemCollapsibleState.None
        );
        simpleUIItem.iconPath = new vscode.ThemeIcon('rocket');
        simpleUIItem.tooltip = 'Öffnet die vereinfachte Benutzeroberfläche';
        simpleUIItem.command = {
            command: 'comitto.showSimpleUI',
            title: 'Show Simple UI'
        };
        items.push(simpleUIItem);

        return items;
    }

    async _getGitItems() {
        const gitSettings = settings.get('gitSettings');
        const items = [];

        // Auto-Push
        const autoPushItem = new vscode.TreeItem(
            `Auto-Push: ${gitSettings.autoPush ? 'Aktiviert' : 'Deaktiviert'}`,
            vscode.TreeItemCollapsibleState.None
        );
        autoPushItem.iconPath = new vscode.ThemeIcon(gitSettings.autoPush ? 'cloud-upload' : 'x');
        autoPushItem.tooltip = 'Automatisches Push nach Commit';
        autoPushItem.command = {
            command: 'comitto.toggleAutoPush',
            title: 'Toggle Auto Push'
        };
        items.push(autoPushItem);

        // Branch
        const branchItem = new vscode.TreeItem(
            `Branch: ${gitSettings.branch || 'Aktueller Branch'}`,
            vscode.TreeItemCollapsibleState.None
        );
        branchItem.iconPath = new vscode.ThemeIcon('git-branch');
        branchItem.tooltip = 'Ziel-Branch für Commits';
        branchItem.command = {
            command: 'comitto.editBranch',
            title: 'Edit Branch'
        };
        items.push(branchItem);

        // Commit-Stil
        const commitStyleMap = {
            'conventional': 'Conventional Commits',
            'gitmoji': 'Gitmoji',
            'simple': 'Einfach',
            'angular': 'Angular',
            'atom': 'Atom'
        };
        const currentStyle = commitStyleMap[gitSettings.commitMessageStyle] || 'Conventional';
        const commitStyleItem = new vscode.TreeItem(
            `Commit-Stil: ${currentStyle}`,
            vscode.TreeItemCollapsibleState.None
        );
        commitStyleItem.iconPath = new vscode.ThemeIcon('symbol-string');
        commitStyleItem.tooltip = 'Stil der generierten Commit-Nachrichten';
        commitStyleItem.command = {
            command: 'comitto.selectCommitStyle',
            title: 'Select Commit Style'
        };
        items.push(commitStyleItem);

        // Commit-Sprache
        const languageMap = {
            'de': 'Deutsch',
            'en': 'English',
            'fr': 'Français',
            'es': 'Español',
            'it': 'Italiano',
            'ja': '日本語',
            'zh': '中文'
        };
        const currentLanguage = languageMap[gitSettings.commitMessageLanguage] || 'Deutsch';
        const languageItem = new vscode.TreeItem(
            `Sprache: ${currentLanguage}`,
            vscode.TreeItemCollapsibleState.None
        );
        languageItem.iconPath = new vscode.ThemeIcon('symbol-misc');
        languageItem.tooltip = 'Sprache für Commit-Nachrichten';
        languageItem.command = {
            command: 'comitto.selectCommitLanguage',
            title: 'Select Commit Language'
        };
        items.push(languageItem);

        // Stage-Modus
        const stageModeMap = {
            'all': 'Alle Dateien',
            'specific': 'Spezifische Dateien',
            'ask': 'Nachfragen'
        };
        const currentStageMode = stageModeMap[gitSettings.stageMode] || 'Alle Dateien';
        const stageModeItem = new vscode.TreeItem(
            `Stage-Modus: ${currentStageMode}`,
            vscode.TreeItemCollapsibleState.None
        );
        stageModeItem.iconPath = new vscode.ThemeIcon('file-add');
        stageModeItem.tooltip = 'Bestimmt, welche Dateien automatisch gestagt werden';
        stageModeItem.command = {
            command: 'comitto.selectStageMode',
            title: 'Select Stage Mode'
        };
        items.push(stageModeItem);

        // Gitignore verwenden
        const gitignoreItem = new vscode.TreeItem(
            `Gitignore: ${gitSettings.useGitignore ? 'Respektiert' : 'Ignoriert'}`,
            vscode.TreeItemCollapsibleState.None
        );
        gitignoreItem.iconPath = new vscode.ThemeIcon(gitSettings.useGitignore ? 'eye' : 'eye-closed');
        gitignoreItem.tooltip = 'Ob .gitignore Regeln beachtet werden';
        gitignoreItem.command = {
            command: 'comitto.toggleUseGitignore',
            title: 'Toggle Use Gitignore'
        };
        items.push(gitignoreItem);

        return items;
    }

    async _getAIItems() {
        const currentProvider = settings.get('aiProvider');
        const items = [];

        // KI-Provider
        const providerMap = {
            'openai': 'OpenAI',
            'anthropic': 'Anthropic',
            'ollama': 'Ollama'
        };
        const providerItem = new vscode.TreeItem(
            `Provider: ${providerMap[currentProvider] || currentProvider}`,
            vscode.TreeItemCollapsibleState.None
        );
        providerItem.iconPath = new vscode.ThemeIcon('robot');
        providerItem.tooltip = 'Aktueller KI-Provider für Commit-Nachrichten';
        providerItem.command = {
            command: 'comitto.configureAIProvider',
            title: 'Configure AI Provider'
        };
        items.push(providerItem);

        // Provider-spezifische Einstellungen
        switch (currentProvider) {
            case 'openai':
                const openaiSettings = settings.get('openai');
                const openaiModelItem = new vscode.TreeItem(
                    `OpenAI Modell: ${openaiSettings.model}`,
                    vscode.TreeItemCollapsibleState.None
                );
                openaiModelItem.iconPath = new vscode.ThemeIcon('symbol-parameter');
                openaiModelItem.command = {
                    command: 'comitto.selectOpenAIModel',
                    title: 'Select OpenAI Model'
                };
                items.push(openaiModelItem);

                const openaiKeyItem = new vscode.TreeItem(
                    `API-Schlüssel: ${openaiSettings.apiKey ? 'Konfiguriert' : 'Nicht gesetzt'}`,
                    vscode.TreeItemCollapsibleState.None
                );
                openaiKeyItem.iconPath = new vscode.ThemeIcon('key');
                openaiKeyItem.command = {
                    command: 'comitto.editOpenAIKey',
                    title: 'Edit OpenAI API Key'
                };
                items.push(openaiKeyItem);
                break;

            case 'anthropic':
                const anthropicSettings = settings.get('anthropic');
                const anthropicModelItem = new vscode.TreeItem(
                    `Anthropic Modell: ${anthropicSettings.model}`,
                    vscode.TreeItemCollapsibleState.None
                );
                anthropicModelItem.iconPath = new vscode.ThemeIcon('symbol-parameter');
                anthropicModelItem.command = {
                    command: 'comitto.selectAnthropicModel',
                    title: 'Select Anthropic Model'
                };
                items.push(anthropicModelItem);

                const anthropicKeyItem = new vscode.TreeItem(
                    `API-Schlüssel: ${anthropicSettings.apiKey ? 'Konfiguriert' : 'Nicht gesetzt'}`,
                    vscode.TreeItemCollapsibleState.None
                );
                anthropicKeyItem.iconPath = new vscode.ThemeIcon('key');
                anthropicKeyItem.command = {
                    command: 'comitto.editAnthropicKey',
                    title: 'Edit Anthropic API Key'
                };
                items.push(anthropicKeyItem);
                break;

            case 'ollama':
                const ollamaSettings = settings.get('ollama');
                const ollamaModelItem = new vscode.TreeItem(
                    `Ollama Modell: ${ollamaSettings.model}`,
                    vscode.TreeItemCollapsibleState.None
                );
                ollamaModelItem.iconPath = new vscode.ThemeIcon('symbol-parameter');
                ollamaModelItem.command = {
                    command: 'comitto.selectOllamaModel',
                    title: 'Select Ollama Model'
                };
                ollamaModelItem.tooltip = 'Klicken Sie, um ein Ollama-Modell auszuwählen oder manuell einzugeben';
                items.push(ollamaModelItem);

                const ollamaEndpointItem = new vscode.TreeItem(
                    `Endpoint: ${ollamaSettings.endpoint}`,
                    vscode.TreeItemCollapsibleState.None
                );
                ollamaEndpointItem.iconPath = new vscode.ThemeIcon('globe');
                ollamaEndpointItem.command = {
                    command: 'comitto.editOllamaEndpoint',
                    title: 'Edit Ollama Endpoint'
                };
                ollamaEndpointItem.tooltip = 'Klicken Sie, um den Ollama-Endpoint zu bearbeiten';
                items.push(ollamaEndpointItem);
                break;
        }

        // Prompt-Template
        const promptItem = new vscode.TreeItem(
            'Prompt-Template bearbeiten',
            vscode.TreeItemCollapsibleState.None
        );
        promptItem.iconPath = new vscode.ThemeIcon('edit');
        promptItem.tooltip = 'Bearbeitet die Vorlage für KI-Prompts';
        promptItem.command = {
            command: 'comitto.editPromptTemplate',
            title: 'Edit Prompt Template'
        };
        items.push(promptItem);

        return items;
    }

    async _getTriggerItems() {
        const triggerRules = settings.get('triggerRules');
        const items = [];

        // Trigger konfigurieren (Haupteintrag)
        const configureItem = new vscode.TreeItem(
            'Trigger konfigurieren',
            vscode.TreeItemCollapsibleState.None
        );
        configureItem.iconPath = new vscode.ThemeIcon('settings-gear');
        configureItem.tooltip = 'Öffnet die Trigger-Konfiguration';
        configureItem.command = {
            command: 'comitto.configureTriggers',
            title: 'Configure Triggers'
        };
        items.push(configureItem);

        // Bei Speichern
        const onSaveItem = new vscode.TreeItem(
            `Bei Speichern: ${triggerRules.onSave ? 'Aktiv' : 'Inaktiv'}`,
            vscode.TreeItemCollapsibleState.None
        );
        onSaveItem.iconPath = new vscode.ThemeIcon(triggerRules.onSave ? 'check' : 'x');
        onSaveItem.command = {
            command: 'comitto.toggleOnSave',
            title: 'Toggle On Save'
        };
        items.push(onSaveItem);

        // Intervall-basiert
        const onIntervalItem = new vscode.TreeItem(
            `Intervall (${triggerRules.intervalMinutes}min): ${triggerRules.onInterval ? 'Aktiv' : 'Inaktiv'}`,
            vscode.TreeItemCollapsibleState.None
        );
        onIntervalItem.iconPath = new vscode.ThemeIcon(triggerRules.onInterval ? 'clock' : 'circle-slash');
        onIntervalItem.command = {
            command: 'comitto.toggleOnInterval',
            title: 'Toggle On Interval'
        };
        items.push(onIntervalItem);

        // Bei Branch-Wechsel
        const onBranchItem = new vscode.TreeItem(
            `Bei Branch-Wechsel: ${triggerRules.onBranchSwitch ? 'Aktiv' : 'Inaktiv'}`,
            vscode.TreeItemCollapsibleState.None
        );
        onBranchItem.iconPath = new vscode.ThemeIcon(triggerRules.onBranchSwitch ? 'git-branch' : 'x');
        onBranchItem.command = {
            command: 'comitto.toggleOnBranchSwitch',
            title: 'Toggle On Branch Switch'
        };
        items.push(onBranchItem);

        // Schwellwerte
        const fileCountItem = new vscode.TreeItem(
            `Datei-Anzahl-Schwelle: ${triggerRules.fileCountThreshold}`,
            vscode.TreeItemCollapsibleState.None
        );
        fileCountItem.iconPath = new vscode.ThemeIcon('file-code');
        fileCountItem.command = {
            command: 'comitto.editFileCountThreshold',
            title: 'Edit File Count Threshold'
        };
        items.push(fileCountItem);

        const timeThresholdItem = new vscode.TreeItem(
            `Zeit-Schwelle: ${triggerRules.timeThresholdMinutes} min`,
            vscode.TreeItemCollapsibleState.None
        );
        timeThresholdItem.iconPath = new vscode.ThemeIcon('clock');
        timeThresholdItem.command = {
            command: 'comitto.editTimeThreshold',
            title: 'Edit Time Threshold'
        };
        items.push(timeThresholdItem);

        const changeCountItem = new vscode.TreeItem(
            `Mindest-Änderungen: ${triggerRules.minChangeCount}`,
            vscode.TreeItemCollapsibleState.None
        );
        changeCountItem.iconPath = new vscode.ThemeIcon('diff');
        changeCountItem.command = {
            command: 'comitto.editMinChangeCount',
            title: 'Edit Min Change Count'
        };
        items.push(changeCountItem);

        const guardianSettings = settings.get('guardian');
        const guardianItem = new vscode.TreeItem(
            `Guardian: ${guardianSettings.smartCommitProtection ? 'Aktiv' : 'Inaktiv'}`,
            vscode.TreeItemCollapsibleState.None
        );
        guardianItem.description = `Cooldown ${guardianSettings.coolDownMinutes} min · Dateien ${guardianSettings.maxFilesWithoutPrompt}`;
        guardianItem.iconPath = new vscode.ThemeIcon(guardianSettings.smartCommitProtection ? 'shield' : 'shield-off');
        guardianItem.command = {
            command: 'comitto.configureGuardian',
            title: 'Configure Guardian'
        };
        items.push(guardianItem);

        return items;
    }

    async _getUIItems() {
        const uiSettings = settings.get('uiSettings');
        const notificationSettings = settings.get('notifications');
        const items = [];

        // Einfacher Modus
        const simpleModeItem = new vscode.TreeItem(
            `Einfacher Modus: ${uiSettings.simpleMode ? 'Aktiv' : 'Inaktiv'}`,
            vscode.TreeItemCollapsibleState.None
        );
        simpleModeItem.iconPath = new vscode.ThemeIcon(uiSettings.simpleMode ? 'eye' : 'eye-closed');
        simpleModeItem.command = {
            command: 'comitto.toggleSimpleMode',
            title: 'Toggle Simple Mode'
        };
        items.push(simpleModeItem);

        // Theme
        const themeItem = new vscode.TreeItem(
            `Theme: ${uiSettings.theme || 'auto'}`,
            vscode.TreeItemCollapsibleState.None
        );
        themeItem.iconPath = new vscode.ThemeIcon('color-mode');
        themeItem.command = {
            command: 'comitto.selectTheme',
            title: 'Select Theme'
        };
        items.push(themeItem);

        // Benachrichtigungen
        const notificationItem = new vscode.TreeItem(
            `Benachrichtigungen: ${uiSettings.showNotifications ? 'Aktiv' : 'Inaktiv'}`,
            vscode.TreeItemCollapsibleState.None
        );
        notificationItem.iconPath = new vscode.ThemeIcon(uiSettings.showNotifications ? 'bell' : 'bell-slash');
        items.push(notificationItem);

        // Einstellungen öffnen
        const settingsItem = new vscode.TreeItem(
            'VS Code Einstellungen öffnen',
            vscode.TreeItemCollapsibleState.None
        );
        settingsItem.iconPath = new vscode.ThemeIcon('gear');
        settingsItem.command = {
            command: 'comitto.openSettings',
            title: 'Open Settings'
        };
        items.push(settingsItem);

        return items;
    }
}

/**
 * Provider für die Debug-Logs Ansicht
 */
class LogsViewProvider {
    constructor(context) {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this._context = context;
        this._logs = [];
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    addLog(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = {
            message,
            type,
            timestamp,
            id: Date.now()
        };
        this._logs.unshift(logEntry);
        
        // Maximal 50 Logs behalten
        if (this._logs.length > 50) {
            this._logs = this._logs.slice(0, 50);
        }
        
        this.refresh();
    }

    clearLogs() {
        this._logs = [];
        this.refresh();
    }

    getTreeItem(element) {
        return element;
    }

    async getChildren() {
        const items = [];
        
        // Clear Button
        const clearItem = new vscode.TreeItem(
            'Logs löschen',
            vscode.TreeItemCollapsibleState.None
        );
        clearItem.iconPath = new vscode.ThemeIcon('trash');
        clearItem.tooltip = 'Löscht alle Debug-Logs';
        clearItem.command = {
            command: 'comitto.clearLogs',
            title: 'Clear Logs'
        };
        items.push(clearItem);

        // Log Entries
        for (const log of this._logs) {
            const logItem = new vscode.TreeItem(
                `[${log.timestamp}] ${log.message}`,
                vscode.TreeItemCollapsibleState.None
            );
            
            switch (log.type) {
                case 'error':
                    logItem.iconPath = new vscode.ThemeIcon('error');
                    break;
                case 'warning':
                    logItem.iconPath = new vscode.ThemeIcon('warning');
                    break;
                case 'success':
                    logItem.iconPath = new vscode.ThemeIcon('check');
                    break;
                default:
                    logItem.iconPath = new vscode.ThemeIcon('info');
            }
            
            logItem.tooltip = `${log.type.toUpperCase()}: ${log.message}`;
            items.push(logItem);
        }

        if (this._logs.length === 0) {
            const emptyItem = new vscode.TreeItem(
                'Keine Logs vorhanden',
                vscode.TreeItemCollapsibleState.None
            );
            emptyItem.iconPath = new vscode.ThemeIcon('info');
            items.push(emptyItem);
        }

        return items;
    }
}

/**
 * Verbesserter Dashboard Provider mit schönerer UI und weniger Störungen
 */
class DashboardProvider {
    constructor(context) {
        this._context = context;
        this._panel = null;
    }

    show() {
        if (this._panel) {
            this._panel.reveal();
        } else {
            this._panel = vscode.window.createWebviewPanel(
                'comittoDashboard',
                'Comitto Dashboard',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: [
                        vscode.Uri.file(path.join(this._context.extensionPath, 'resources'))
                    ]
                }
            );

            this._panel.webview.html = this._getDashboardContent();
            
            this._panel.onDidDispose(() => {
                this._panel = null;
            });

            this._panel.webview.onDidReceiveMessage(message => {
                this._handleDashboardMessage(message);
            });
        }
    }

    _getDashboardContent() {
        const enabled = settings.get('autoCommitEnabled');
        const aiProvider = settings.get('aiProvider');
        const gitSettings = settings.get('gitSettings');
        
        return `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Comitto Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            background: linear-gradient(135deg,rgb(12, 22, 66) 0%,rgb(23, 8, 37) 100%);
            color: white;
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            background: linear-gradient(45deg, #fff, #f0f0f0);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .card {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 25px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        
        .card:hover {
            transform: translateY(-5px);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
        }
        
        .card h3 {
            font-size: 1.4rem;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .status-indicator {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            display: inline-block;
        }
        
        .status-active { background-color: #4ade80; }
        .status-inactive { background-color: #f87171; }
        
        .btn {
            background: linear-gradient(45deg, #4ade80, #22c55e);
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            margin: 5px;
            display: inline-block;
            text-decoration: none;
        }
        
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
        }
        
        .btn-secondary {
            background: linear-gradient(45deg, #6366f1, #8b5cf6);
        }
        
        .btn-danger {
            background: linear-gradient(45deg, #ef4444, #dc2626);
        }
        
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }
        
        .stat-card {
            background: rgba(255, 255, 255, 0.05);
            padding: 15px;
            border-radius: 10px;
            text-align: center;
        }
        
        .stat-number {
            font-size: 2rem;
            font-weight: bold;
            color: #4ade80;
        }
        
        .logs-section {
            background: rgba(0, 0, 0, 0.3);
            border-radius: 15px;
            padding: 20px;
            margin-top: 20px;
            max-height: 300px;
            overflow-y: auto;
        }
        
        .log-entry {
            padding: 8px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            font-family: 'Courier New', monospace;
            font-size: 0.9rem;
        }
        
        .log-entry:last-child {
            border-bottom: none;
        }
        
        .log-info { color: #60a5fa; }
        .log-success { color: #4ade80; }
        .log-warning { color: #fbbf24; }
        .log-error { color: #f87171; }
        
        @media (max-width: 768px) {
            .grid {
                grid-template-columns: 1fr;
            }
            
            .header h1 {
                font-size: 2rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Comitto Dashboard</h1>
            <p>Intelligent Git Commit Management</p>
        </div>
        
        <div class="grid">
            <div class="card">
                <h3>
                    <span class="status-indicator ${enabled ? 'status-active' : 'status-inactive'}"></span>
                    Status
                </h3>
                <p>Auto-Commits: <strong>${enabled ? 'Aktiv' : 'Inaktiv'}</strong></p>
                <p>KI-Provider: <strong>${aiProvider.toUpperCase()}</strong></p>
                <p>Commit-Stil: <strong>${gitSettings.commitMessageStyle || 'conventional'}</strong></p>
                <div style="margin-top: 15px;">
                    <button class="btn" onclick="toggleAutoCommit()">
                        ${enabled ? 'Deaktivieren' : 'Aktivieren'}
                    </button>
                    <button class="btn btn-secondary" onclick="manualCommit()">
                        Manueller Commit
                    </button>
                </div>
            </div>
            
            <div class="card">
                <h3>🛠️ Schnellaktionen</h3>
                <button class="btn" onclick="executeCommand('comitto.stageAll')">Alle Dateien stagen</button>
                <button class="btn btn-secondary" onclick="executeCommand('comitto.stageSelected')">Auswahl stagen</button>
                <button class="btn btn-secondary" onclick="executeCommand('comitto.configureTriggers')">Trigger konfigurieren</button>
                <button class="btn btn-secondary" onclick="executeCommand('comitto.configureAIProvider')">KI konfigurieren</button>
            </div>
            
            <div class="card">
                <h3>📊 Statistiken</h3>
                <div class="stats">
                    <div class="stat-card">
                        <div class="stat-number" id="commitCount">-</div>
                        <div>Commits heute</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number" id="filesStaged">-</div>
                        <div>Dateien gestagt</div>
                    </div>
                </div>
                <div style="margin-top: 15px;">
                    <button class="btn btn-secondary" onclick="refreshStats()">Aktualisieren</button>
                </div>
            </div>
            
            <div class="card">
                <h3>⚙️ Konfiguration</h3>
                <p><strong>Branch:</strong> ${gitSettings.branch || 'Aktueller Branch'}</p>
                <p><strong>Auto-Push:</strong> ${gitSettings.autoPush ? 'Ja' : 'Nein'}</p>
                <p><strong>Sprache:</strong> ${gitSettings.commitMessageLanguage || 'de'}</p>
                <div style="margin-top: 15px;">
                    <button class="btn btn-secondary" onclick="executeCommand('comitto.openSettings')">Einstellungen öffnen</button>
                    <button class="btn btn-secondary" onclick="executeCommand('comitto.showSimpleUI')">Einfache UI</button>
                </div>
            </div>
        </div>
        
        <div class="logs-section">
            <h3>📋 Aktuelle Logs</h3>
            <div id="logs-container">
                <div class="log-entry log-info">[${new Date().toLocaleTimeString()}] Dashboard geladen</div>
            </div>
            <div style="margin-top: 15px;">
                <button class="btn btn-danger" onclick="clearLogs()">Logs löschen</button>
                <button class="btn btn-secondary" onclick="refreshLogs()">Aktualisieren</button>
            </div>
        </div>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        function executeCommand(commandId) {
            vscode.postMessage({
                command: 'executeCommand',
                commandId: commandId
            });
            addLog('Command ausgeführt: ' + commandId, 'info');
        }
        
        function toggleAutoCommit() {
            vscode.postMessage({
                command: 'executeCommand',
                commandId: 'comitto.toggleAutoCommit'
            });
            addLog('Auto-Commit umgeschaltet', 'info');
        }
        
        function manualCommit() {
            vscode.postMessage({
                command: 'executeCommand',
                commandId: 'comitto.manualCommit'
            });
            addLog('Manueller Commit gestartet', 'info');
        }
        
        function refreshStats() {
            // Statistiken aktualisieren (Dummy-Daten für Demo)
            document.getElementById('commitCount').textContent = Math.floor(Math.random() * 20);
            document.getElementById('filesStaged').textContent = Math.floor(Math.random() * 10);
            addLog('Statistiken aktualisiert', 'success');
        }
        
        function addLog(message, type = 'info') {
            const logsContainer = document.getElementById('logs-container');
            const timestamp = new Date().toLocaleTimeString();
            const logEntry = document.createElement('div');
            logEntry.className = 'log-entry log-' + type;
            logEntry.textContent = '[' + timestamp + '] ' + message;
            logsContainer.insertBefore(logEntry, logsContainer.firstChild);
            
            // Maximal 20 Logs anzeigen
            const logs = logsContainer.children;
            if (logs.length > 20) {
                logsContainer.removeChild(logs[logs.length - 1]);
            }
        }
        
        function clearLogs() {
            document.getElementById('logs-container').innerHTML = '';
            addLog('Dashboard geladen', 'info');
        }
        
        function refreshLogs() {
            vscode.postMessage({
                command: 'refreshLogs'
            });
        }
        
        // Initial stats laden
        refreshStats();
    </script>
</body>
</html>`;
    }

    async _handleDashboardMessage(message) {
        switch (message.command) {
            case 'executeCommand':
                await vscode.commands.executeCommand(message.commandId);
                break;
            case 'refreshLogs':
                // Logs aktualisieren
                break;
        }
    }
}

/**
 * Vereinfachte UI Provider
 */
class SimpleUIProvider {
    constructor(context) {
        this._context = context;
        this._panel = null;
    }

    show() {
        if (this._panel) {
            this._panel.reveal();
        } else {
            this._panel = vscode.window.createWebviewPanel(
                'comittoSimpleUI',
                'Comitto - Einfache Oberfläche',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            this._panel.webview.html = this._getSimpleUIContent();
            
            this._panel.onDidDispose(() => {
                this._panel = null;
            });

            this._panel.webview.onDidReceiveMessage(message => {
                this._handleSimpleUIMessage(message);
            });
        }
    }

    _getSimpleUIContent() {
        const enabled = settings.get('autoCommitEnabled');
        const guardianSettings = settings.get('guardian');
        
        return `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Comitto - Einfache Oberfläche</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            max-width: 600px;
            margin: 40px auto;
            padding: 30px;
            background: #f8fafc;
            color: #334155;
        }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        
        .status {
            text-align: center;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 30px;
            font-size: 1.2rem;
            font-weight: 600;
        }
        
        .status.active {
            background: #dcfce7;
            color: #166534;
            border: 2px solid #22c55e;
        }
        
        .status.inactive {
            background: #fef2f2;
            color: #991b1b;
            border: 2px solid #ef4444;
        }
        
        .buttons {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }
        
        .btn {
            padding: 15px 25px;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .btn-primary {
            background: #3b82f6;
            color: white;
        }
        
        .btn-primary:hover {
            background: #2563eb;
        }
        
        .btn-secondary {
            background: #e2e8f0;
            color: #475569;
        }
        
        .btn-secondary:hover {
            background: #cbd5e1;
        }
        
        .btn-success {
            background: #10b981;
            color: white;
        }
        
        .btn-success:hover {
            background: #059669;
        }
          
          .guardian-card {
              margin-top: 25px;
              padding: 20px;
              border-radius: 12px;
              background: #1e293b;
              color: #e2e8f0;
              box-shadow: 0 10px 30px rgba(15, 23, 42, 0.25);
          }
          
          .guardian-card h2 {
              margin-bottom: 10px;
              font-size: 1.2rem;
          }
          
          .guardian-status {
              font-weight: 600;
              margin-bottom: 10px;
          }
          
          .guardian-status.active {
              color: #4ade80;
          }
          
          .guardian-status.inactive {
              color: #f87171;
          }
          
          .guardian-card ul {
              margin: 0;
              padding-left: 18px;
              font-size: 0.95rem;
              color: rgba(226, 232, 240, 0.8);
          }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 Comitto</h1>
        <p>Einfache Benutzeroberfläche</p>
    </div>
    
    <div class="status ${enabled ? 'active' : 'inactive'}">
        ${enabled ? '✅ Auto-Commits sind aktiv' : '❌ Auto-Commits sind inaktiv'}
    </div>
    
    <div class="buttons">
        <button class="btn btn-primary" onclick="toggleAutoCommit()">
            ${enabled ? 'Deaktivieren' : 'Aktivieren'}
        </button>
        <button class="btn btn-success" onclick="manualCommit()">
            Manueller Commit
        </button>
        <button class="btn btn-secondary" onclick="executeCommand('comitto.stageAll')">
            Alle Dateien stagen
        </button>
        <button class="btn btn-secondary" onclick="executeCommand('comitto.configureTriggers')">
            Trigger konfigurieren
        </button>
        <button class="btn btn-secondary" onclick="executeCommand('comitto.configureGuardian')">
            Guardian konfigurieren
        </button>
        <button class="btn btn-secondary" onclick="executeCommand('comitto.configureAIProvider')">
            KI konfigurieren
        </button>
        <button class="btn btn-secondary" onclick="executeCommand('comitto.showDashboard')">
            Dashboard öffnen
        </button>
    </div>
    <div class="guardian-card">
        <h2>Commit Guardian</h2>
        <p class="guardian-status ${guardianSettings.smartCommitProtection ? 'active' : 'inactive'}">
            ${guardianSettings.smartCommitProtection ? 'Schutz aktiv' : 'Schutz deaktiviert'}
        </p>
        <ul>
            <li>Cooldown: ${guardianSettings.coolDownMinutes} Minute(n)</li>
            <li>Dateien ohne Prompt: ${guardianSettings.maxFilesWithoutPrompt}</li>
            <li>Große Diffs: ${guardianSettings.confirmOnLargeChanges ? `Bestätigung ab ${guardianSettings.maxDiffSizeKb} KB` : 'Keine Bestätigung erforderlich'}</li>
        </ul>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        function executeCommand(commandId) {
            vscode.postMessage({
                command: 'executeCommand',
                commandId: commandId
            });
        }
        
        function toggleAutoCommit() {
            executeCommand('comitto.toggleAutoCommit');
        }
        
        function manualCommit() {
            executeCommand('comitto.manualCommit');
        }
    </script>
</body>
</html>`;
    }

    async _handleSimpleUIMessage(message) {
        if (message.command === 'executeCommand') {
            await vscode.commands.executeCommand(message.commandId);
        }
    }
}

module.exports = {
    MainViewProvider,
    LogsViewProvider,
    DashboardProvider,
    SimpleUIProvider
}; 