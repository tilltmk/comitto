const vscode = require('vscode');
const path = require('path');

/**
 * Klasse für die Statusanzeige in der Seitenleiste
 * Erweiterte Implementierung mit verbesserten visuellen Elementen und Gruppierung
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
            // Unterelemente für gruppierte Ansicht
            return this._getSubItems(element);
        }

        const config = vscode.workspace.getConfiguration('comitto');
        const enabled = config.get('autoCommitEnabled');
        const items = [];

        // Statusgruppe erstellen
        const statusGroup = new vscode.TreeItem(
            'Status und Schnellzugriff',
            vscode.TreeItemCollapsibleState.Expanded
        );
        statusGroup.contextValue = 'status-group';
        statusGroup.iconPath = new vscode.ThemeIcon('pulse');
        statusGroup.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        items.push(statusGroup);

        // Konfigurationsgruppe erstellen
        const configGroup = new vscode.TreeItem(
            'Konfiguration',
            vscode.TreeItemCollapsibleState.Expanded
        );
        configGroup.contextValue = 'config-group';
        configGroup.iconPath = new vscode.ThemeIcon('settings');
        configGroup.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        items.push(configGroup);

        // Aktionsgruppe erstellen
        const actionGroup = new vscode.TreeItem(
            'Aktionen',
            vscode.TreeItemCollapsibleState.Expanded
        );
        actionGroup.contextValue = 'action-group';
        actionGroup.iconPath = new vscode.ThemeIcon('run-all');
        actionGroup.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        items.push(actionGroup);

        return items;
    }

    /**
     * Liefert Unterelemente für gruppierte Ansicht
     * @param {vscode.TreeItem} element Das Übergeordnete Element
     * @returns {Promise<vscode.TreeItem[]>} Liste der Unterelemente
     */
    async _getSubItems(element) {
        const config = vscode.workspace.getConfiguration('comitto');
        const enabled = config.get('autoCommitEnabled');
        const items = [];

        switch (element.contextValue) {
            case 'status-group':
                // Status-Element mit verbesserter Visualisierung
                const statusItem = new vscode.TreeItem(
                    `Status: ${enabled ? 'Aktiviert' : 'Deaktiviert'}`,
                    vscode.TreeItemCollapsibleState.None
                );
                statusItem.contextValue = enabled ? 'comitto-status-enabled' : 'comitto-status-disabled';
                statusItem.iconPath = new vscode.ThemeIcon(enabled ? 'check' : 'circle-slash');
                statusItem.tooltip = enabled ? 'Comitto überwacht aktiv Änderungen' : 'Comitto ist derzeit deaktiviert';
                statusItem.command = {
                    command: enabled ? 'comitto.disableAutoCommit' : 'comitto.enableAutoCommit',
                    title: enabled ? 'Deaktivieren' : 'Aktivieren'
                };
                items.push(statusItem);

                // Einfache Benutzeroberfläche öffnen
                const simpleUIItem = new vscode.TreeItem(
                    'Einfache Benutzeroberfläche',
                    vscode.TreeItemCollapsibleState.None
                );
                simpleUIItem.iconPath = new vscode.ThemeIcon('rocket');
                simpleUIItem.tooltip = 'Öffnet eine übersichtliche Oberfläche für einfache Einstellungen';
                simpleUIItem.command = {
                    command: 'comitto.showSimpleUI',
                    title: 'Einfache Benutzeroberfläche öffnen'
                };
                items.push(simpleUIItem);

                // Dashboard öffnen
                const dashboardItem = new vscode.TreeItem(
                    'Dashboard anzeigen',
                    vscode.TreeItemCollapsibleState.None
                );
                dashboardItem.iconPath = new vscode.ThemeIcon('dashboard');
                dashboardItem.tooltip = 'Zeigt das vollständige Comitto-Dashboard an';
                dashboardItem.command = {
                    command: 'comitto.showDashboard',
                    title: 'Dashboard anzeigen'
                };
                items.push(dashboardItem);
                break;

            case 'config-group':
                // AI Provider mit mehr Details und exklusiver Auswahl
                const provider = config.get('aiProvider');
                const providerItem = new vscode.TreeItem(
                    `KI-Provider: ${getProviderDisplayName(provider)}`,
                    vscode.TreeItemCollapsibleState.None
                );
                providerItem.iconPath = getProviderIcon(provider);
                providerItem.tooltip = `Aktueller KI-Provider für Commit-Nachrichten: ${getProviderDisplayName(provider)}`;
                providerItem.command = {
                    command: 'comitto.configureAIProvider',
                    title: 'KI-Provider konfigurieren'
                };
                items.push(providerItem);

                // Git-Einstellungen anzeigen
                const gitSettings = config.get('gitSettings');
                const commitLanguage = gitSettings.commitMessageLanguage === 'de' ? 'Deutsch' : 'Englisch';
                const autoPushStatus = gitSettings.autoPush ? 'Mit Auto-Push' : 'Ohne Auto-Push';
                const stageMode = gitSettings.stageMode === 'all' ? 'Alle Dateien stagen' : 
                                gitSettings.stageMode === 'specific' ? 'Spezifische Dateien stagen' :
                                'Nachfragen';
                
                const gitItem = new vscode.TreeItem(
                    `Git: ${commitLanguage}, ${autoPushStatus}`,
                    vscode.TreeItemCollapsibleState.None
                );
                gitItem.iconPath = new vscode.ThemeIcon('git-merge');
                gitItem.tooltip = `Branch: ${gitSettings.branch || 'Aktuell'}, Sprache: ${gitSettings.commitMessageLanguage}, Stil: ${gitSettings.commitMessageStyle}, Stage-Modus: ${stageMode}`;
                gitItem.command = {
                    command: 'comitto.openSettings',
                    title: 'Git-Einstellungen bearbeiten'
                };
                items.push(gitItem);

                // Trigger-Regeln mit mehr Details
                const rules = config.get('triggerRules');
                let triggerDescription = `${rules.fileCountThreshold} Dateien / ${rules.minChangeCount} Änderungen`;
                
                // Aktivierte Trigger anzeigen
                const activeTriggers = [];
                if (rules.onSave) activeTriggers.push('Bei Speichern');
                if (rules.onInterval) activeTriggers.push(`Alle ${rules.intervalMinutes}min`);
                if (rules.onBranchSwitch) activeTriggers.push('Bei Branch-Wechsel');
                
                if (activeTriggers.length > 0) {
                    triggerDescription += ` (${activeTriggers.join(', ')})`;
                }
                
                const rulesItem = new vscode.TreeItem(
                    `Trigger: ${triggerDescription}`,
                    vscode.TreeItemCollapsibleState.None
                );
                rulesItem.iconPath = new vscode.ThemeIcon('settings-gear');
                rulesItem.tooltip = `Commit bei ${rules.fileCountThreshold} Dateien, ${rules.minChangeCount} Änderungen oder nach ${rules.timeThresholdMinutes} Minuten\nAktive Trigger: ${activeTriggers.join(', ')}`;
                rulesItem.command = {
                    command: 'comitto.configureTriggers',
                    title: 'Trigger konfigurieren'
                };
                items.push(rulesItem);
                break;

            case 'action-group':
                // Manuellen Commit-Button hinzufügen
                const manualCommitItem = new vscode.TreeItem(
                    'Manuellen Commit ausführen',
                    vscode.TreeItemCollapsibleState.None
                );
                manualCommitItem.iconPath = new vscode.ThemeIcon('git-commit');
                manualCommitItem.tooltip = 'Führt einen manuellen Commit mit KI-generierter Nachricht aus';
                manualCommitItem.command = {
                    command: 'comitto.performManualCommit',
                    title: 'Manuellen Commit ausführen'
                };
                items.push(manualCommitItem);

                // Staging-Buttons hinzufügen
                const stageAllItem = new vscode.TreeItem(
                    'Alle Änderungen stagen',
                    vscode.TreeItemCollapsibleState.None
                );
                stageAllItem.iconPath = new vscode.ThemeIcon('add');
                stageAllItem.tooltip = 'Stagt alle geänderten Dateien für den nächsten Commit';
                stageAllItem.command = {
                    command: 'comitto.stageAll',
                    title: 'Alle Änderungen stagen'
                };
                items.push(stageAllItem);

                const stageSelectedItem = new vscode.TreeItem(
                    'Ausgewählte Dateien stagen',
                    vscode.TreeItemCollapsibleState.None
                );
                stageSelectedItem.iconPath = new vscode.ThemeIcon('checklist');
                stageSelectedItem.tooltip = 'Erlaubt die Auswahl bestimmter Dateien zum Stagen';
                stageSelectedItem.command = {
                    command: 'comitto.stageSelected',
                    title: 'Ausgewählte Dateien stagen'
                };
                items.push(stageSelectedItem);
                break;
        }

        return items;
    }
}

/**
 * Klasse für die Einstellungen in der Seitenleiste
 * Verbesserte Implementierung mit visuellen Verbesserungen und logischer Gruppierung
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

        // Hauptkategorien für Einstellungen mit verbesserten Icons und Beschreibungen
        const items = [];

        // KI-Provider-Einstellungen
        const aiItem = new vscode.TreeItem(
            'KI-Provider-Einstellungen',
            vscode.TreeItemCollapsibleState.Collapsed
        );
        aiItem.contextValue = 'ai-provider';
        aiItem.iconPath = new vscode.ThemeIcon('symbol-enum');
        aiItem.tooltip = 'Konfiguration der KI-Provider für die Generierung von Commit-Nachrichten';
        items.push(aiItem);

        // Trigger-Einstellungen
        const triggerItem = new vscode.TreeItem(
            'Trigger-Regeln',
            vscode.TreeItemCollapsibleState.Collapsed
        );
        triggerItem.contextValue = 'trigger-rules';
        triggerItem.iconPath = new vscode.ThemeIcon('settings-gear');
        triggerItem.tooltip = 'Konfiguration der Auslöser für automatische Commits';
        items.push(triggerItem);

        // Git-Einstellungen
        const gitItem = new vscode.TreeItem(
            'Git-Einstellungen',
            vscode.TreeItemCollapsibleState.Collapsed
        );
        gitItem.contextValue = 'git-settings';
        gitItem.iconPath = new vscode.ThemeIcon('git-merge');
        gitItem.tooltip = 'Konfiguration von Git-bezogenen Einstellungen für Commits';
        items.push(gitItem);

        // Prompt-Vorlage
        const promptItem = new vscode.TreeItem(
            'Prompt-Vorlage',
            vscode.TreeItemCollapsibleState.None
        );
        promptItem.contextValue = 'prompt-template';
        promptItem.iconPath = new vscode.ThemeIcon('edit');
        promptItem.tooltip = 'Anpassung der Vorlage für die Generierung von Commit-Nachrichten';
        promptItem.command = {
            command: 'comitto.editPromptTemplate',
            title: 'Prompt-Vorlage bearbeiten'
        };
        items.push(promptItem);

        // UI-Einstellungen
        const uiItem = new vscode.TreeItem(
            'Benutzeroberfläche',
            vscode.TreeItemCollapsibleState.Collapsed
        );
        uiItem.contextValue = 'ui-settings';
        uiItem.iconPath = new vscode.ThemeIcon('layout');
        uiItem.tooltip = 'Einstellungen für die Benutzeroberfläche und Benachrichtigungen';
        items.push(uiItem);

        // Benachrichtigungs-Einstellungen
        const notificationItem = new vscode.TreeItem(
            'Benachrichtigungen',
            vscode.TreeItemCollapsibleState.Collapsed
        );
        notificationItem.contextValue = 'notification-settings';
        notificationItem.iconPath = new vscode.ThemeIcon('bell');
        notificationItem.tooltip = 'Konfiguration von Benachrichtigungen und Meldungen';
        items.push(notificationItem);

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
                providerItem.iconPath = getProviderIcon(aiProvider);
                providerItem.tooltip = 'Wählt den KI-Provider für die Generierung von Commit-Nachrichten aus';
                providerItem.command = {
                    command: 'comitto.selectAiProvider',
                    title: 'KI-Provider auswählen'
                };
                items.push(providerItem);

                // Provider-spezifische Einstellungen basierend auf dem ausgewählten Provider
                if (aiProvider === 'ollama') {
                    const ollamaEndpoint = config.get('ollama.endpoint');
                    const ollamaEndpointItem = new vscode.TreeItem(`Ollama-Endpunkt: ${ollamaEndpoint}`);
                    ollamaEndpointItem.iconPath = new vscode.ThemeIcon('link');
                    ollamaEndpointItem.tooltip = 'Konfiguriert den API-Endpunkt für den Ollama-Dienst';
                    ollamaEndpointItem.command = {
                        command: 'comitto.configureOllamaSettings',
                        title: 'Ollama-Einstellungen konfigurieren'
                    };
                    items.push(ollamaEndpointItem);

                    const ollamaModel = config.get('ollama.model');
                    const ollamaModelItem = new vscode.TreeItem(`Ollama-Modell: ${ollamaModel}`);
                    ollamaModelItem.iconPath = new vscode.ThemeIcon('symbol-class');
                    ollamaModelItem.tooltip = 'Wählt das zu verwendende Ollama-Modell aus';
                    ollamaModelItem.command = {
                        command: 'comitto.configureOllamaSettings',
                        title: 'Ollama-Einstellungen konfigurieren'
                    };
                    items.push(ollamaModelItem);
                } else if (aiProvider === 'openai') {
                    const openaiModel = config.get('openai.model');
                    const openaiModelItem = new vscode.TreeItem(`OpenAI-Modell: ${openaiModel}`);
                    openaiModelItem.iconPath = new vscode.ThemeIcon('symbol-class');
                    openaiModelItem.tooltip = 'Wählt das zu verwendende OpenAI-Modell aus';
                    openaiModelItem.command = {
                        command: 'comitto.selectOpenAIModel',
                        title: 'OpenAI-Modell auswählen'
                    };
                    items.push(openaiModelItem);

                    const hasKey = config.get('openai.apiKey') !== '';
                    const openaiKeyItem = new vscode.TreeItem(`API-Schlüssel: ${hasKey ? 'Gesetzt' : 'Nicht gesetzt'}`);
                    openaiKeyItem.iconPath = new vscode.ThemeIcon(hasKey ? 'key' : 'warning');
                    openaiKeyItem.tooltip = 'Konfiguriert den API-Schlüssel für OpenAI';
                    openaiKeyItem.command = {
                        command: 'comitto.editOpenAIKey',
                        title: 'OpenAI-API-Schlüssel bearbeiten'
                    };
                    items.push(openaiKeyItem);
                } else if (aiProvider === 'anthropic') {
                    const anthropicModel = config.get('anthropic.model');
                    const anthropicModelItem = new vscode.TreeItem(`Anthropic-Modell: ${anthropicModel}`);
                    anthropicModelItem.iconPath = new vscode.ThemeIcon('symbol-class');
                    anthropicModelItem.tooltip = 'Wählt das zu verwendende Anthropic-Modell aus';
                    anthropicModelItem.command = {
                        command: 'comitto.selectAnthropicModel',
                        title: 'Anthropic-Modell auswählen'
                    };
                    items.push(anthropicModelItem);

                    const hasKey = config.get('anthropic.apiKey') !== '';
                    const anthropicKeyItem = new vscode.TreeItem(`API-Schlüssel: ${hasKey ? 'Gesetzt' : 'Nicht gesetzt'}`);
                    anthropicKeyItem.iconPath = new vscode.ThemeIcon(hasKey ? 'key' : 'warning');
                    anthropicKeyItem.tooltip = 'Konfiguriert den API-Schlüssel für Anthropic';
                    anthropicKeyItem.command = {
                        command: 'comitto.editAnthropicKey',
                        title: 'Anthropic-API-Schlüssel bearbeiten'
                    };
                    items.push(anthropicKeyItem);
                }
                break;

            case 'trigger-rules':
                const rules = config.get('triggerRules');
                
                // File Count Threshold
                const fileCountItem = new vscode.TreeItem(
                    `Dateianzahl-Schwellenwert: ${rules.fileCountThreshold}`
                );
                fileCountItem.iconPath = new vscode.ThemeIcon('files');
                fileCountItem.tooltip = 'Die Anzahl an Dateien, die für einen automatischen Commit geändert sein müssen';
                fileCountItem.command = {
                    command: 'comitto.editFileCountThreshold',
                    title: 'Dateianzahl-Schwellenwert bearbeiten'
                };
                items.push(fileCountItem);

                // Min Change Count
                const changeCountItem = new vscode.TreeItem(
                    `Änderungsanzahl-Schwellenwert: ${rules.minChangeCount}`
                );
                changeCountItem.iconPath = new vscode.ThemeIcon('edit');
                changeCountItem.tooltip = 'Die minimale Anzahl an Änderungen für einen automatischen Commit';
                changeCountItem.command = {
                    command: 'comitto.editMinChangeCount',
                    title: 'Änderungsanzahl-Schwellenwert bearbeiten'
                };
                items.push(changeCountItem);

                // Time Threshold
                const timeItem = new vscode.TreeItem(
                    `Zeit-Schwellenwert: ${rules.timeThresholdMinutes} Minuten`
                );
                timeItem.iconPath = new vscode.ThemeIcon('watch');
                timeItem.tooltip = 'Die Zeitspanne in Minuten, nach der ein Commit ausgelöst wird';
                timeItem.command = {
                    command: 'comitto.editTimeThreshold',
                    title: 'Zeit-Schwellenwert bearbeiten'
                };
                items.push(timeItem);

                // Trigger Options
                const triggerOptionsItem = new vscode.TreeItem('Trigger-Optionen');
                triggerOptionsItem.iconPath = new vscode.ThemeIcon('settings');
                
                // On Save Trigger
                const onSaveItem = new vscode.TreeItem(
                    `Bei Speichern: ${rules.onSave ? 'Aktiviert' : 'Deaktiviert'}`
                );
                onSaveItem.iconPath = new vscode.ThemeIcon(rules.onSave ? 'check' : 'x');
                onSaveItem.command = {
                    command: 'comitto.toggleOnSave',
                    title: 'Speichern-Trigger umschalten'
                };
                items.push(onSaveItem);

                // On Interval Trigger
                const onIntervalItem = new vscode.TreeItem(
                    `Bei Intervall: ${rules.onInterval ? `Aktiviert (${rules.intervalMinutes}min)` : 'Deaktiviert'}`
                );
                onIntervalItem.iconPath = new vscode.ThemeIcon(rules.onInterval ? 'check' : 'x');
                onIntervalItem.command = {
                    command: 'comitto.toggleOnInterval',
                    title: 'Intervall-Trigger umschalten'
                };
                items.push(onIntervalItem);

                // On Branch Switch
                const onBranchItem = new vscode.TreeItem(
                    `Bei Branch-Wechsel: ${rules.onBranchSwitch ? 'Aktiviert' : 'Deaktiviert'}`
                );
                onBranchItem.iconPath = new vscode.ThemeIcon(rules.onBranchSwitch ? 'check' : 'x');
                onBranchItem.command = {
                    command: 'comitto.toggleOnBranchSwitch',
                    title: 'Branch-Wechsel-Trigger umschalten'
                };
                items.push(onBranchItem);
                
                // File Patterns
                const filePatternsText = rules.filePatterns.length > 0 
                    ? rules.filePatterns.join(', ')
                    : '(Keine)';
                const filePatternsItem = new vscode.TreeItem(
                    `Dateimuster: ${filePatternsText.length > 30 ? filePatternsText.substring(0, 30) + '...' : filePatternsText}`
                );
                filePatternsItem.iconPath = new vscode.ThemeIcon('filter');
                filePatternsItem.tooltip = `Aktuell überwachte Dateimuster: ${rules.filePatterns.join(', ')}`;
                filePatternsItem.command = {
                    command: 'comitto.editFilePatterns',
                    title: 'Dateimuster bearbeiten'
                };
                items.push(filePatternsItem);
                break;

            case 'git-settings':
                const gitSettings = config.get('gitSettings');
                
                // Commit Message Language
                const languageItem = new vscode.TreeItem(
                    `Commit-Sprache: ${gitSettings.commitMessageLanguage === 'de' ? 'Deutsch' : 'Englisch'}`
                );
                languageItem.iconPath = new vscode.ThemeIcon('globe');
                languageItem.tooltip = 'Die Sprache, in der die Commit-Nachrichten generiert werden';
                languageItem.command = {
                    command: 'comitto.selectCommitLanguage',
                    title: 'Commit-Sprache auswählen'
                };
                items.push(languageItem);
                
                // Auto Push
                const autoPushItem = new vscode.TreeItem(
                    `Auto-Push: ${gitSettings.autoPush ? 'Aktiviert' : 'Deaktiviert'}`
                );
                autoPushItem.iconPath = new vscode.ThemeIcon(gitSettings.autoPush ? 'cloud-upload' : 'x');
                autoPushItem.tooltip = 'Ob nach einem Commit automatisch gepusht werden soll';
                autoPushItem.command = {
                    command: 'comitto.toggleAutoPush',
                    title: 'Auto-Push umschalten'
                };
                items.push(autoPushItem);
                
                // Branch
                const branchItem = new vscode.TreeItem(
                    `Branch: ${gitSettings.branch || 'Aktuell'}`
                );
                branchItem.iconPath = new vscode.ThemeIcon('git-branch');
                branchItem.tooltip = 'Der für Commits zu verwendende Branch (leer für aktuellen Branch)';
                branchItem.command = {
                    command: 'comitto.editBranch',
                    title: 'Branch bearbeiten'
                };
                items.push(branchItem);
                
                // Commit Message Style
                const styleItem = new vscode.TreeItem(
                    `Commit-Stil: ${gitSettings.commitMessageStyle === 'conventional' ? 'Conventional' : 'Gitmoji'}`
                );
                styleItem.iconPath = new vscode.ThemeIcon('symbol-string');
                styleItem.tooltip = 'Der Stil der generierten Commit-Nachrichten';
                styleItem.command = {
                    command: 'comitto.selectCommitStyle',
                    title: 'Commit-Stil auswählen'
                };
                items.push(styleItem);
                
                // Stage Mode
                const stageMode = gitSettings.stageMode === 'all' ? 'Alle Dateien' : 
                                gitSettings.stageMode === 'specific' ? 'Spezifische Dateien' :
                                'Nachfragen';
                const stageModeItem = new vscode.TreeItem(
                    `Stage-Modus: ${stageMode}`
                );
                stageModeItem.iconPath = new vscode.ThemeIcon('staged');
                stageModeItem.tooltip = 'Wie Dateien für Commits gestaged werden sollen';
                stageModeItem.command = {
                    command: 'comitto.selectStageMode',
                    title: 'Stage-Modus auswählen'
                };
                items.push(stageModeItem);
                
                // Staging Patterns (if mode is 'specific')
                if (gitSettings.stageMode === 'specific') {
                    const patternsText = gitSettings.specificStagingPatterns.length > 0 
                        ? gitSettings.specificStagingPatterns.join(', ')
                        : '(Keine)';
                    const stagingPatternsItem = new vscode.TreeItem(
                        `Staging-Muster: ${patternsText.length > 30 ? patternsText.substring(0, 30) + '...' : patternsText}`
                    );
                    stagingPatternsItem.iconPath = new vscode.ThemeIcon('filter');
                    stagingPatternsItem.tooltip = `Dateimuster für spezifisches Staging: ${gitSettings.specificStagingPatterns.join(', ')}`;
                    stagingPatternsItem.command = {
                        command: 'comitto.editStagingPatterns',
                        title: 'Staging-Muster bearbeiten'
                    };
                    items.push(stagingPatternsItem);
                }
                
                // Use Gitignore
                const useGitignore = gitSettings.useGitignore !== undefined ? gitSettings.useGitignore : true;
                const gitignoreItem = new vscode.TreeItem(
                    `Gitignore beachten: ${useGitignore ? 'Ja' : 'Nein'}`
                );
                gitignoreItem.iconPath = new vscode.ThemeIcon(useGitignore ? 'check' : 'x');
                gitignoreItem.tooltip = 'Ob die .gitignore-Datei bei der Überwachung beachtet werden soll';
                gitignoreItem.command = {
                    command: 'comitto.toggleUseGitignore',
                    title: 'Gitignore-Verwendung umschalten'
                };
                items.push(gitignoreItem);
                break;

            case 'ui-settings':
                const uiSettings = config.get('uiSettings');
                
                // Simple Mode
                const simpleModeItem = new vscode.TreeItem(
                    `Einfacher Modus: ${uiSettings.simpleMode ? 'Aktiviert' : 'Deaktiviert'}`
                );
                simpleModeItem.iconPath = new vscode.ThemeIcon(uiSettings.simpleMode ? 'check' : 'x');
                simpleModeItem.tooltip = 'Ob die vereinfachte Benutzeroberfläche verwendet werden soll';
                simpleModeItem.command = {
                    command: 'comitto.toggleSimpleMode',
                    title: 'Einfachen Modus umschalten'
                };
                items.push(simpleModeItem);
                
                // Confirm Before Commit
                const confirmItem = new vscode.TreeItem(
                    `Bestätigung vor Commit: ${uiSettings.confirmBeforeCommit ? 'Aktiviert' : 'Deaktiviert'}`
                );
                confirmItem.iconPath = new vscode.ThemeIcon(uiSettings.confirmBeforeCommit ? 'check' : 'x');
                confirmItem.tooltip = 'Ob vor einem Commit eine Bestätigung angefordert werden soll';
                confirmItem.command = {
                    command: 'comitto.toggleConfirmBeforeCommit',
                    title: 'Commit-Bestätigung umschalten'
                };
                items.push(confirmItem);
                
                // Show Notifications
                const notifyItem = new vscode.TreeItem(
                    `Benachrichtigungen anzeigen: ${uiSettings.showNotifications ? 'Aktiviert' : 'Deaktiviert'}`
                );
                notifyItem.iconPath = new vscode.ThemeIcon(uiSettings.showNotifications ? 'check' : 'x');
                notifyItem.tooltip = 'Ob Benachrichtigungen angezeigt werden sollen';
                notifyItem.command = {
                    command: 'comitto.toggleShowNotifications',
                    title: 'Benachrichtigungen umschalten'
                };
                items.push(notifyItem);
                
                // Theme
                const themeItem = new vscode.TreeItem(
                    `Farbschema: ${getThemeLabel(uiSettings.theme)}`
                );
                themeItem.iconPath = new vscode.ThemeIcon('symbol-color');
                themeItem.tooltip = 'Das zu verwendende Farbschema';
                themeItem.command = {
                    command: 'comitto.selectTheme',
                    title: 'Farbschema auswählen'
                };
                items.push(themeItem);
                break;

            case 'notification-settings':
                const notifications = config.get('notifications');
                
                // On Commit
                const onCommitItem = new vscode.TreeItem(
                    `Bei Commit: ${notifications.onCommit ? 'Aktiviert' : 'Deaktiviert'}`
                );
                onCommitItem.iconPath = new vscode.ThemeIcon(notifications.onCommit ? 'check' : 'x');
                onCommitItem.tooltip = 'Ob Benachrichtigungen bei erfolgreichen Commits angezeigt werden sollen';
                onCommitItem.command = {
                    command: 'comitto.toggleNotificationOnCommit',
                    title: 'Commit-Benachrichtigung umschalten'
                };
                items.push(onCommitItem);
                
                // On Push
                const onPushItem = new vscode.TreeItem(
                    `Bei Push: ${notifications.onPush ? 'Aktiviert' : 'Deaktiviert'}`
                );
                onPushItem.iconPath = new vscode.ThemeIcon(notifications.onPush ? 'check' : 'x');
                onPushItem.tooltip = 'Ob Benachrichtigungen bei erfolgreichen Pushes angezeigt werden sollen';
                onPushItem.command = {
                    command: 'comitto.toggleNotificationOnPush',
                    title: 'Push-Benachrichtigung umschalten'
                };
                items.push(onPushItem);
                
                // On Error
                const onErrorItem = new vscode.TreeItem(
                    `Bei Fehler: ${notifications.onError ? 'Aktiviert' : 'Deaktiviert'}`
                );
                onErrorItem.iconPath = new vscode.ThemeIcon(notifications.onError ? 'check' : 'x');
                onErrorItem.tooltip = 'Ob Benachrichtigungen bei Fehlern angezeigt werden sollen';
                onErrorItem.command = {
                    command: 'comitto.toggleNotificationOnError',
                    title: 'Fehler-Benachrichtigung umschalten'
                };
                items.push(onErrorItem);
                
                // On Trigger Fired
                const onTriggerItem = new vscode.TreeItem(
                    `Bei Trigger-Auslösung: ${notifications.onTriggerFired ? 'Aktiviert' : 'Deaktiviert'}`
                );
                onTriggerItem.iconPath = new vscode.ThemeIcon(notifications.onTriggerFired ? 'check' : 'x');
                onTriggerItem.tooltip = 'Ob Benachrichtigungen bei Trigger-Auslösungen angezeigt werden sollen';
                onTriggerItem.command = {
                    command: 'comitto.toggleNotificationOnTriggerFired',
                    title: 'Trigger-Benachrichtigung umschalten'
                };
                items.push(onTriggerItem);
                break;
        }

        return items;
    }
}

/**
 * Klasse für die Schnellaktionen in der Seitenleiste
 * Verbesserte Implementierung mit visuellen Verbesserungen und logischer Gruppierung
 */
class QuickActionsViewProvider {
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
            return this._getSubActions(element);
        }

        // Hauptgruppen für Schnellaktionen
        const items = [];

        // Commit-Aktionen
        const commitGroup = new vscode.TreeItem(
            'Commit-Aktionen',
            vscode.TreeItemCollapsibleState.Expanded
        );
        commitGroup.contextValue = 'commit-actions';
        commitGroup.iconPath = new vscode.ThemeIcon('git-commit');
        items.push(commitGroup);

        // Git-Aktionen
        const gitGroup = new vscode.TreeItem(
            'Git-Aktionen',
            vscode.TreeItemCollapsibleState.Expanded
        );
        gitGroup.contextValue = 'git-actions';
        gitGroup.iconPath = new vscode.ThemeIcon('source-control');
        items.push(gitGroup);

        // Einstellungs-Aktionen
        const configGroup = new vscode.TreeItem(
            'Einstellungs-Aktionen',
            vscode.TreeItemCollapsibleState.Expanded
        );
        configGroup.contextValue = 'config-actions';
        configGroup.iconPath = new vscode.ThemeIcon('gear');
        items.push(configGroup);

        return items;
    }

    /**
     * Liefert Unterelemente für gruppierte Aktionen
     * @param {vscode.TreeItem} element Das Übergeordnete Element
     * @returns {Promise<vscode.TreeItem[]>} Liste der Unterelemente
     */
    async _getSubActions(element) {
        const config = vscode.workspace.getConfiguration('comitto');
        const enabled = config.get('autoCommitEnabled');
        const items = [];

        switch (element.contextValue) {
            case 'commit-actions':
                // Comitto aktivieren/deaktivieren
                const toggleItem = new vscode.TreeItem(
                    `Comitto ${enabled ? 'deaktivieren' : 'aktivieren'}`,
                    vscode.TreeItemCollapsibleState.None
                );
                toggleItem.iconPath = new vscode.ThemeIcon(enabled ? 'circle-slash' : 'check');
                toggleItem.tooltip = enabled ? 'Deaktiviert die automatischen Commits' : 'Aktiviert die automatischen Commits';
                toggleItem.command = {
                    command: 'comitto.toggleAutoCommit',
                    title: `Comitto ${enabled ? 'deaktivieren' : 'aktivieren'}`
                };
                items.push(toggleItem);

                // Manueller Commit
                const manualCommitItem = new vscode.TreeItem(
                    'Manuellen Commit ausführen',
                    vscode.TreeItemCollapsibleState.None
                );
                manualCommitItem.iconPath = new vscode.ThemeIcon('git-commit');
                manualCommitItem.tooltip = 'Führt einen manuellen Commit mit KI-generierter Nachricht aus';
                manualCommitItem.command = {
                    command: 'comitto.performManualCommit',
                    title: 'Manuellen Commit ausführen'
                };
                items.push(manualCommitItem);
                break;

            case 'git-actions':
                // Alle Änderungen stagen
                const stageAllItem = new vscode.TreeItem(
                    'Alle Änderungen stagen',
                    vscode.TreeItemCollapsibleState.None
                );
                stageAllItem.iconPath = new vscode.ThemeIcon('add');
                stageAllItem.tooltip = 'Stagt alle geänderten Dateien für den nächsten Commit';
                stageAllItem.command = {
                    command: 'comitto.stageAll',
                    title: 'Alle Änderungen stagen'
                };
                items.push(stageAllItem);

                // Ausgewählte Dateien stagen
                const stageSelectedItem = new vscode.TreeItem(
                    'Ausgewählte Dateien stagen',
                    vscode.TreeItemCollapsibleState.None
                );
                stageSelectedItem.iconPath = new vscode.ThemeIcon('checklist');
                stageSelectedItem.tooltip = 'Erlaubt die Auswahl bestimmter Dateien zum Stagen';
                stageSelectedItem.command = {
                    command: 'comitto.stageSelected',
                    title: 'Ausgewählte Dateien stagen'
                };
                items.push(stageSelectedItem);

                // Git-Einstellungen bearbeiten
                const gitSettingsItem = new vscode.TreeItem(
                    'Git-Einstellungen bearbeiten',
                    vscode.TreeItemCollapsibleState.None
                );
                gitSettingsItem.iconPath = new vscode.ThemeIcon('gear');
                gitSettingsItem.tooltip = 'Öffnet die Git-Einstellungen zur Bearbeitung';
                gitSettingsItem.command = {
                    command: 'comitto.openSettings',
                    title: 'Git-Einstellungen bearbeiten'
                };
                items.push(gitSettingsItem);
                break;

            case 'config-actions':
                // KI-Provider konfigurieren
                const configAIItem = new vscode.TreeItem(
                    'KI-Provider konfigurieren',
                    vscode.TreeItemCollapsibleState.None
                );
                configAIItem.iconPath = new vscode.ThemeIcon('symbol-misc');
                configAIItem.tooltip = 'Öffnet die KI-Provider-Konfiguration';
                configAIItem.command = {
                    command: 'comitto.configureAIProvider',
                    title: 'KI-Provider konfigurieren'
                };
                items.push(configAIItem);

                // Trigger konfigurieren
                const configTriggersItem = new vscode.TreeItem(
                    'Trigger konfigurieren',
                    vscode.TreeItemCollapsibleState.None
                );
                configTriggersItem.iconPath = new vscode.ThemeIcon('settings-gear');
                configTriggersItem.tooltip = 'Öffnet die Trigger-Konfiguration';
                configTriggersItem.command = {
                    command: 'comitto.configureTriggers',
                    title: 'Trigger konfigurieren'
                };
                items.push(configTriggersItem);

                // Einfache UI anzeigen
                const simpleUIItem = new vscode.TreeItem(
                    'Einfache Benutzeroberfläche öffnen',
                    vscode.TreeItemCollapsibleState.None
                );
                simpleUIItem.iconPath = new vscode.ThemeIcon('rocket');
                simpleUIItem.tooltip = 'Öffnet die vereinfachte Benutzeroberfläche';
                simpleUIItem.command = {
                    command: 'comitto.showSimpleUI',
                    title: 'Einfache Benutzeroberfläche öffnen'
                };
                items.push(simpleUIItem);

                // Dashboard anzeigen
                const dashboardItem = new vscode.TreeItem(
                    'Dashboard anzeigen',
                    vscode.TreeItemCollapsibleState.None
                );
                dashboardItem.iconPath = new vscode.ThemeIcon('dashboard');
                dashboardItem.tooltip = 'Öffnet das Comitto-Dashboard';
                dashboardItem.command = {
                    command: 'comitto.showDashboard',
                    title: 'Dashboard anzeigen'
                };
                items.push(dashboardItem);
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
 * Gibt ein Icon für den Provider zurück
 * @param {string} provider Provider-ID
 * @returns {vscode.ThemeIcon} Icon für den Provider
 */
function getProviderIcon(provider) {
    switch (provider) {
        case 'ollama': return new vscode.ThemeIcon('server');
        case 'openai': return new vscode.ThemeIcon('rocket');
        case 'anthropic': return new vscode.ThemeIcon('beaker');
        default: return new vscode.ThemeIcon('symbol-misc');
    }
}

function getOpenAIModelOptions() {
    return [
        { label: 'GPT-4o', value: 'gpt-4o' },
        { label: 'GPT-4o Mini', value: 'gpt-4o-mini' },
        { label: 'GPT-4', value: 'gpt-4' },
        { label: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
        { label: 'GPT-4 (Januar 2025)', value: 'gpt-4-0125-preview' },
        { label: 'GPT-4 (November 2023)', value: 'gpt-4-1106-preview' },
        { label: 'GPT-4 Vision Preview', value: 'gpt-4-vision-preview' },
        { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
        { label: 'GPT-3.5 Turbo (Januar 2024)', value: 'gpt-3.5-turbo-0125' },
        { label: 'GPT-3.5 Turbo (November 2023)', value: 'gpt-3.5-turbo-1106' }
    ];
}

/**
 * Gibt ein lesbares Label für den Staging-Modus zurück
 * @param {string} mode Der Staging-Modus
 * @returns {string} Lesbares Label
 */
function getStageModeLabel(mode) {
    switch (mode) {
        case 'all': return 'Alle Dateien stagen';
        case 'specific': return 'Spezifische Dateien stagen';
        case 'prompt': return 'Nachfragen';
        default: return mode;
    }
}

/**
 * Gibt ein lesbares Label für das Theme zurück
 * @param {string} theme Das Theme
 * @returns {string} Lesbares Label
 */
function getThemeLabel(theme) {
    switch (theme) {
        case 'light': return 'Hell';
        case 'dark': return 'Dunkel';
        case 'auto': return 'Automatisch';
        default: return theme;
    }
}

/**
 * Gibt eine lesbare Beschreibung für den Git-Status-Code zurück
 * @param {string} statusCode Der Git-Status-Code
 * @returns {string} Lesbare Beschreibung des Status
 */
function getStatusDescription(statusCode) {
    const firstChar = statusCode.charAt(0);
    const secondChar = statusCode.charAt(1);
    
    let description = '';
    
    // Index-Status (erster Buchstabe)
    if (firstChar === 'M') description = 'Modifiziert im Index';
    else if (firstChar === 'A') description = 'Zum Index hinzugefügt';
    else if (firstChar === 'D') description = 'Aus Index gelöscht';
    else if (firstChar === 'R') description = 'Im Index umbenannt';
    else if (firstChar === 'C') description = 'Im Index kopiert';
    else if (firstChar === 'U') description = 'Ungemerged im Index';
    
    // Working Directory Status (zweiter Buchstabe)
    if (secondChar === 'M') {
        if (description) description += ', modifiziert im Arbeitsverzeichnis';
        else description = 'Modifiziert im Arbeitsverzeichnis';
    } else if (secondChar === 'D') {
        if (description) description += ', gelöscht im Arbeitsverzeichnis';
        else description = 'Gelöscht im Arbeitsverzeichnis';
    }
    
    // Untracked files
    if (statusCode === '??') description = 'Nicht verfolgte Datei';
    
    return description || statusCode;
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

    // Schnellaktionen-Ansicht
    const quickActionsProvider = new QuickActionsViewProvider(context);
    const quickActionsTreeView = vscode.window.createTreeView('comitto-quick-actions', {
        treeDataProvider: quickActionsProvider,
        showCollapseAll: false
    });
    context.subscriptions.push(quickActionsTreeView);

    // Einstellungs-Ansicht
    const settingsProvider = new SettingsViewProvider(context);
    const settingsTreeView = vscode.window.createTreeView('comitto-settings', {
        treeDataProvider: settingsProvider,
        showCollapseAll: true
    });
    context.subscriptions.push(settingsTreeView);

    // Nach kurzer Verzögerung Refresh ausführen, um sicherzustellen, dass die UI aktualisiert wird
    setTimeout(() => {
        statusProvider.refresh();
        quickActionsProvider.refresh();
        settingsProvider.refresh();
    }, 500);

    // Registriere einen Event-Handler, der die Seitenleiste sichtbar macht
    context.subscriptions.push(vscode.extensions.onDidChange(() => {
        // Setze den Kontext, dass ein Git-Repository vorhanden ist
        vscode.commands.executeCommand('setContext', 'workspaceHasGit', true);
    }));

    return {
        statusProvider,
        quickActionsProvider,
        settingsProvider,
        statusTreeView,
        settingsTreeView,
        quickActionsTreeView
    };
}

module.exports = {
    registerUI,
    StatusViewProvider,
    QuickActionsViewProvider,
    SettingsViewProvider,
    getProviderDisplayName,
    getProviderIcon,
    getOpenAIModelOptions,
    getStageModeLabel,
    getThemeLabel,
    getStatusDescription
}; 