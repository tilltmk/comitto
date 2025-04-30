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
            'Status and Quick Access',
            vscode.TreeItemCollapsibleState.Expanded
        );
        statusGroup.contextValue = 'status-group';
        statusGroup.iconPath = new vscode.ThemeIcon('pulse');
        statusGroup.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        items.push(statusGroup);

        // Konfigurationsgruppe erstellen
        const configGroup = new vscode.TreeItem(
            'Configuration',
            vscode.TreeItemCollapsibleState.Expanded
        );
        configGroup.contextValue = 'config-group';
        configGroup.iconPath = new vscode.ThemeIcon('settings');
        configGroup.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        items.push(configGroup);

        // Aktionsgruppe erstellen
        const actionGroup = new vscode.TreeItem(
            'Actions',
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
                    `Status: ${enabled ? 'Enabled' : 'Disabled'}`,
                    vscode.TreeItemCollapsibleState.None
                );
                statusItem.contextValue = enabled ? 'comitto-status-enabled' : 'comitto-status-disabled';
                statusItem.iconPath = new vscode.ThemeIcon(enabled ? 'check' : 'circle-slash');
                statusItem.tooltip = enabled ? 'Comitto monitors changes' : 'Comitto is currently disabled';
                statusItem.command = {
                    command: enabled ? 'comitto.disableAutoCommit' : 'comitto.enableAutoCommit',
                    title: enabled ? 'Disable' : 'Enable'
                };
                items.push(statusItem);

                // Einfache Benutzeroberfläche öffnen
                const simpleUIItem = new vscode.TreeItem(
                    'Simple User Interface',
                    vscode.TreeItemCollapsibleState.None
                );
                simpleUIItem.iconPath = new vscode.ThemeIcon('rocket');
                simpleUIItem.tooltip = 'Opens a simple interface for easy settings';
                simpleUIItem.command = {
                    command: 'comitto.showSimpleUI',
                    title: 'Open Simple User Interface'
                };
                items.push(simpleUIItem);

                // Dashboard öffnen
                const dashboardItem = new vscode.TreeItem(
                    'Show Dashboard',
                    vscode.TreeItemCollapsibleState.None
                );
                dashboardItem.iconPath = new vscode.ThemeIcon('dashboard');
                dashboardItem.tooltip = 'Shows the complete Comitto dashboard';
                dashboardItem.command = {
                    command: 'comitto.showDashboard',
                    title: 'Show Dashboard'
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
                providerItem.tooltip = `Current KI-Provider for commit messages: ${getProviderDisplayName(provider)}`;
                providerItem.command = {
                    command: 'comitto.configureAIProvider',
                    title: 'Configure KI-Provider'
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
                    title: 'Edit Git Settings'
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
                    title: 'Configure Triggers'
                };
                items.push(rulesItem);
                break;

            case 'action-group':
                // Manuellen Commit-Button hinzufügen
                const manualCommitItem = new vscode.TreeItem(
                    'Perform Manual Commit',
                    vscode.TreeItemCollapsibleState.None
                );
                manualCommitItem.iconPath = new vscode.ThemeIcon('git-commit');
                manualCommitItem.tooltip = 'Führt einen manuellen Commit mit KI-generierter Nachricht aus';
                manualCommitItem.command = {
                    command: 'comitto.performManualCommit',
                    title: 'Perform Manual Commit'
                };
                items.push(manualCommitItem);

                // Staging-Buttons hinzufügen
                const stageAllItem = new vscode.TreeItem(
                    'Stage All Changes',
                    vscode.TreeItemCollapsibleState.None
                );
                stageAllItem.iconPath = new vscode.ThemeIcon('add');
                stageAllItem.tooltip = 'Stagt alle geänderten Dateien für den nächsten Commit';
                stageAllItem.command = {
                    command: 'comitto.stageAll',
                    title: 'Stage All Changes'
                };
                items.push(stageAllItem);

                const stageSelectedItem = new vscode.TreeItem(
                    'Stage Selected Files',
                    vscode.TreeItemCollapsibleState.None
                );
                stageSelectedItem.iconPath = new vscode.ThemeIcon('checklist');
                stageSelectedItem.tooltip = 'Erlaubt die Auswahl bestimmter Dateien zum Stagen';
                stageSelectedItem.command = {
                    command: 'comitto.stageSelected',
                    title: 'Stage Selected Files'
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
            'KI-Provider Settings',
            vscode.TreeItemCollapsibleState.Collapsed
        );
        aiItem.contextValue = 'ai-provider';
        aiItem.iconPath = new vscode.ThemeIcon('symbol-enum');
        aiItem.tooltip = 'Configuration of KI-Providers for generating commit messages';
        items.push(aiItem);

        // Trigger-Einstellungen
        const triggerItem = new vscode.TreeItem(
            'Trigger Rules',
            vscode.TreeItemCollapsibleState.Collapsed
        );
        triggerItem.contextValue = 'trigger-rules';
        triggerItem.iconPath = new vscode.ThemeIcon('settings-gear');
        triggerItem.tooltip = 'Configuration of triggers for automatic commits';
        items.push(triggerItem);

        // Git-Einstellungen
        const gitItem = new vscode.TreeItem(
            'Git Settings',
            vscode.TreeItemCollapsibleState.Collapsed
        );
        gitItem.contextValue = 'git-settings';
        gitItem.iconPath = new vscode.ThemeIcon('git-merge');
        gitItem.tooltip = 'Configuration of Git-related settings for commits';
        items.push(gitItem);

        // Prompt-Vorlage
        const promptItem = new vscode.TreeItem(
            'Prompt Template',
            vscode.TreeItemCollapsibleState.None
        );
        promptItem.contextValue = 'prompt-template';
        promptItem.iconPath = new vscode.ThemeIcon('edit');
        promptItem.tooltip = 'Customization of the template for generating commit messages';
        promptItem.command = {
            command: 'comitto.editPromptTemplate',
            title: 'Edit Prompt Template'
        };
        items.push(promptItem);

        // UI-Einstellungen
        const uiItem = new vscode.TreeItem(
            'User Interface',
            vscode.TreeItemCollapsibleState.Collapsed
        );
        uiItem.contextValue = 'ui-settings';
        uiItem.iconPath = new vscode.ThemeIcon('layout');
        uiItem.tooltip = 'Settings for the user interface and notifications';
        items.push(uiItem);

        // Benachrichtigungs-Einstellungen
        const notificationItem = new vscode.TreeItem(
            'Notifications',
            vscode.TreeItemCollapsibleState.Collapsed
        );
        notificationItem.contextValue = 'notification-settings';
        notificationItem.iconPath = new vscode.ThemeIcon('bell');
        notificationItem.tooltip = 'Configuration of notifications and messages';
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
                const providerItem = new vscode.TreeItem(`Active Provider: ${getProviderDisplayName(aiProvider)}`);
                providerItem.iconPath = getProviderIcon(aiProvider);
                providerItem.tooltip = 'Select the KI-Provider for generating commit messages';
                providerItem.command = {
                    command: 'comitto.selectAiProvider',
                    title: 'Select KI-Provider'
                };
                items.push(providerItem);

                // Provider-spezifische Einstellungen basierend auf dem ausgewählten Provider
                if (aiProvider === 'ollama') {
                    const ollamaEndpoint = config.get('ollama.endpoint');
                    const ollamaEndpointItem = new vscode.TreeItem(`Ollama Endpoint: ${ollamaEndpoint}`);
                    ollamaEndpointItem.iconPath = new vscode.ThemeIcon('link');
                    ollamaEndpointItem.tooltip = 'Configure the API endpoint for the Ollama service';
                    ollamaEndpointItem.command = {
                        command: 'comitto.configureOllamaSettings',
                        title: 'Configure Ollama Settings'
                    };
                    items.push(ollamaEndpointItem);

                    const ollamaModel = config.get('ollama.model');
                    const ollamaModelItem = new vscode.TreeItem(`Ollama Model: ${ollamaModel}`);
                    ollamaModelItem.iconPath = new vscode.ThemeIcon('symbol-class');
                    ollamaModelItem.tooltip = 'Select the Ollama model to use';
                    ollamaModelItem.command = {
                        command: 'comitto.configureOllamaSettings',
                        title: 'Configure Ollama Settings'
                    };
                    items.push(ollamaModelItem);
                } else if (aiProvider === 'openai') {
                    const openaiModel = config.get('openai.model');
                    const openaiModelItem = new vscode.TreeItem(`OpenAI Model: ${openaiModel}`);
                    openaiModelItem.iconPath = new vscode.ThemeIcon('symbol-class');
                    openaiModelItem.tooltip = 'Select the OpenAI model to use';
                    openaiModelItem.command = {
                        command: 'comitto.selectOpenAIModel',
                        title: 'Select OpenAI Model'
                    };
                    items.push(openaiModelItem);

                    const hasKey = config.get('openai.apiKey') !== '';
                    const openaiKeyItem = new vscode.TreeItem(`API Key: ${hasKey ? 'Set' : 'Not set'}`);
                    openaiKeyItem.iconPath = new vscode.ThemeIcon(hasKey ? 'key' : 'warning');
                    openaiKeyItem.tooltip = 'Configure the API key for OpenAI';
                    openaiKeyItem.command = {
                        command: 'comitto.editOpenAIKey',
                        title: 'Edit OpenAI API Key'
                    };
                    items.push(openaiKeyItem);
                } else if (aiProvider === 'anthropic') {
                    const anthropicModel = config.get('anthropic.model');
                    const anthropicModelItem = new vscode.TreeItem(`Anthropic Model: ${anthropicModel}`);
                    anthropicModelItem.iconPath = new vscode.ThemeIcon('symbol-class');
                    anthropicModelItem.tooltip = 'Select the Anthropic model to use';
                    anthropicModelItem.command = {
                        command: 'comitto.selectAnthropicModel',
                        title: 'Select Anthropic Model'
                    };
                    items.push(anthropicModelItem);

                    const hasKey = config.get('anthropic.apiKey') !== '';
                    const anthropicKeyItem = new vscode.TreeItem(`API Key: ${hasKey ? 'Set' : 'Not set'}`);
                    anthropicKeyItem.iconPath = new vscode.ThemeIcon(hasKey ? 'key' : 'warning');
                    anthropicKeyItem.tooltip = 'Configure the API key for Anthropic';
                    anthropicKeyItem.command = {
                        command: 'comitto.editAnthropicKey',
                        title: 'Edit Anthropic API Key'
                    };
                    items.push(anthropicKeyItem);
                }
                break;

            case 'trigger-rules':
                const rules = config.get('triggerRules');
                
                // File Count Threshold
                const fileCountItem = new vscode.TreeItem(
                    `File Count Threshold: ${rules.fileCountThreshold}`
                );
                fileCountItem.iconPath = new vscode.ThemeIcon('files');
                fileCountItem.tooltip = 'The number of files that must be changed for an automatic commit';
                fileCountItem.command = {
                    command: 'comitto.editFileCountThreshold',
                    title: 'Edit File Count Threshold'
                };
                items.push(fileCountItem);

                // Min Change Count
                const changeCountItem = new vscode.TreeItem(
                    `Change Count Threshold: ${rules.minChangeCount}`
                );
                changeCountItem.iconPath = new vscode.ThemeIcon('edit');
                changeCountItem.tooltip = 'The minimum number of changes for an automatic commit';
                changeCountItem.command = {
                    command: 'comitto.editMinChangeCount',
                    title: 'Edit Change Count Threshold'
                };
                items.push(changeCountItem);

                // Time Threshold
                const timeItem = new vscode.TreeItem(
                    `Time Threshold: ${rules.timeThresholdMinutes} Minutes`
                );
                timeItem.iconPath = new vscode.ThemeIcon('watch');
                timeItem.tooltip = 'The time span in minutes before a commit is triggered';
                timeItem.command = {
                    command: 'comitto.editTimeThreshold',
                    title: 'Edit Time Threshold'
                };
                items.push(timeItem);

                // Trigger Options
                const triggerOptionsItem = new vscode.TreeItem('Trigger Options');
                triggerOptionsItem.iconPath = new vscode.ThemeIcon('settings');
                
                // On Save Trigger
                const onSaveItem = new vscode.TreeItem(
                    `On Save: ${rules.onSave ? 'Enabled' : 'Disabled'}`
                );
                onSaveItem.iconPath = new vscode.ThemeIcon(rules.onSave ? 'check' : 'x');
                onSaveItem.command = {
                    command: 'comitto.toggleOnSave',
                    title: 'Toggle On Save Trigger'
                };
                items.push(onSaveItem);

                // On Interval Trigger
                const onIntervalItem = new vscode.TreeItem(
                    `On Interval: ${rules.onInterval ? `Enabled (${rules.intervalMinutes}min)` : 'Disabled'}`
                );
                onIntervalItem.iconPath = new vscode.ThemeIcon(rules.onInterval ? 'check' : 'x');
                onIntervalItem.command = {
                    command: 'comitto.toggleOnInterval',
                    title: 'Toggle On Interval Trigger'
                };
                items.push(onIntervalItem);

                // On Branch Switch
                const onBranchItem = new vscode.TreeItem(
                    `On Branch Switch: ${rules.onBranchSwitch ? 'Enabled' : 'Disabled'}`
                );
                onBranchItem.iconPath = new vscode.ThemeIcon(rules.onBranchSwitch ? 'check' : 'x');
                onBranchItem.command = {
                    command: 'comitto.toggleOnBranchSwitch',
                    title: 'Toggle On Branch Switch Trigger'
                };
                items.push(onBranchItem);
                
                // File Patterns
                const filePatternsText = rules.filePatterns.length > 0 
                    ? rules.filePatterns.join(', ')
                    : '(None)';
                const filePatternsItem = new vscode.TreeItem(
                    `File Patterns: ${filePatternsText.length > 30 ? filePatternsText.substring(0, 30) + '...' : filePatternsText}`
                );
                filePatternsItem.iconPath = new vscode.ThemeIcon('filter');
                filePatternsItem.tooltip = `Currently monitored file patterns: ${rules.filePatterns.join(', ')}`;
                filePatternsItem.command = {
                    command: 'comitto.editFilePatterns',
                    title: 'Edit File Patterns'
                };
                items.push(filePatternsItem);
                break;

            case 'git-settings':
                const gitSettings = config.get('gitSettings');
                
                // Commit Message Language
                const languageItem = new vscode.TreeItem(
                    `Commit Language: ${gitSettings.commitMessageLanguage === 'de' ? 'Deutsch' : 'Englisch'}`
                );
                languageItem.iconPath = new vscode.ThemeIcon('globe');
                languageItem.tooltip = 'The language in which commit messages are generated';
                languageItem.command = {
                    command: 'comitto.selectCommitLanguage',
                    title: 'Select Commit Language'
                };
                items.push(languageItem);
                
                // Auto Push
                const autoPushItem = new vscode.TreeItem(
                    `Auto Push: ${gitSettings.autoPush ? 'Enabled' : 'Disabled'}`
                );
                autoPushItem.iconPath = new vscode.ThemeIcon(gitSettings.autoPush ? 'cloud-upload' : 'x');
                autoPushItem.tooltip = 'Whether to push after a commit';
                autoPushItem.command = {
                    command: 'comitto.toggleAutoPush',
                    title: 'Toggle Auto Push'
                };
                items.push(autoPushItem);
                
                // Branch
                const branchItem = new vscode.TreeItem(
                    `Branch: ${gitSettings.branch || 'Aktuell'}`
                );
                branchItem.iconPath = new vscode.ThemeIcon('git-branch');
                branchItem.tooltip = 'The branch to use for commits (empty for current branch)';
                branchItem.command = {
                    command: 'comitto.editBranch',
                    title: 'Edit Branch'
                };
                items.push(branchItem);
                
                // Commit Message Style
                const styleItem = new vscode.TreeItem(
                    `Commit Style: ${gitSettings.commitMessageStyle === 'conventional' ? 'Conventional' : 'Gitmoji'}`
                );
                styleItem.iconPath = new vscode.ThemeIcon('symbol-string');
                styleItem.tooltip = 'The style of generated commit messages';
                styleItem.command = {
                    command: 'comitto.selectCommitStyle',
                    title: 'Select Commit Style'
                };
                items.push(styleItem);
                
                // Stage Mode
                const stageMode = gitSettings.stageMode === 'all' ? 'Alle Dateien' : 
                                gitSettings.stageMode === 'specific' ? 'Spezifische Dateien' :
                                'Nachfragen';
                const stageModeItem = new vscode.TreeItem(
                    `Stage Mode: ${stageMode}`
                );
                stageModeItem.iconPath = new vscode.ThemeIcon('staged');
                stageModeItem.tooltip = 'How files should be staged for commits';
                stageModeItem.command = {
                    command: 'comitto.selectStageMode',
                    title: 'Select Stage Mode'
                };
                items.push(stageModeItem);
                
                // Staging Patterns (if mode is 'specific')
                if (gitSettings.stageMode === 'specific') {
                    const patternsText = gitSettings.specificStagingPatterns.length > 0 
                        ? gitSettings.specificStagingPatterns.join(', ')
                        : '(None)';
                    const stagingPatternsItem = new vscode.TreeItem(
                        `Staging Patterns: ${patternsText.length > 30 ? patternsText.substring(0, 30) + '...' : patternsText}`
                    );
                    stagingPatternsItem.iconPath = new vscode.ThemeIcon('filter');
                    stagingPatternsItem.tooltip = `File patterns for specific staging: ${gitSettings.specificStagingPatterns.join(', ')}`;
                    stagingPatternsItem.command = {
                        command: 'comitto.editStagingPatterns',
                        title: 'Edit Staging Patterns'
                    };
                    items.push(stagingPatternsItem);
                }
                
                // Use Gitignore
                const useGitignore = gitSettings.useGitignore !== undefined ? gitSettings.useGitignore : true;
                const gitignoreItem = new vscode.TreeItem(
                    `Use Gitignore: ${useGitignore ? 'Yes' : 'No'}`
                );
                gitignoreItem.iconPath = new vscode.ThemeIcon(useGitignore ? 'check' : 'x');
                gitignoreItem.tooltip = 'Whether to consider the .gitignore file when monitoring';
                gitignoreItem.command = {
                    command: 'comitto.toggleUseGitignore',
                    title: 'Toggle Use Gitignore'
                };
                items.push(gitignoreItem);
                break;

            case 'ui-settings':
                const uiSettings = config.get('uiSettings');
                
                // Simple Mode
                const simpleModeItem = new vscode.TreeItem(
                    `Simple Mode: ${uiSettings.simpleMode ? 'Enabled' : 'Disabled'}`
                );
                simpleModeItem.iconPath = new vscode.ThemeIcon(uiSettings.simpleMode ? 'check' : 'x');
                simpleModeItem.tooltip = 'Whether to use the simplified user interface';
                simpleModeItem.command = {
                    command: 'comitto.toggleSimpleMode',
                    title: 'Toggle Simple Mode'
                };
                items.push(simpleModeItem);
                
                // Confirm Before Commit
                const confirmItem = new vscode.TreeItem(
                    `Confirm Before Commit: ${uiSettings.confirmBeforeCommit ? 'Enabled' : 'Disabled'}`
                );
                confirmItem.iconPath = new vscode.ThemeIcon(uiSettings.confirmBeforeCommit ? 'check' : 'x');
                confirmItem.tooltip = 'Whether to prompt for confirmation before a commit';
                confirmItem.command = {
                    command: 'comitto.toggleConfirmBeforeCommit',
                    title: 'Toggle Confirm Before Commit'
                };
                items.push(confirmItem);
                
                // Show Notifications
                const notifyItem = new vscode.TreeItem(
                    `Show Notifications: ${uiSettings.showNotifications ? 'Enabled' : 'Disabled'}`
                );
                notifyItem.iconPath = new vscode.ThemeIcon(uiSettings.showNotifications ? 'check' : 'x');
                notifyItem.tooltip = 'Whether to show notifications';
                notifyItem.command = {
                    command: 'comitto.toggleShowNotifications',
                    title: 'Toggle Show Notifications'
                };
                items.push(notifyItem);
                
                // Theme
                const themeItem = new vscode.TreeItem(
                    `Theme: ${getThemeLabel(uiSettings.theme)}`
                );
                themeItem.iconPath = new vscode.ThemeIcon('symbol-color');
                themeItem.tooltip = 'The theme to use';
                themeItem.command = {
                    command: 'comitto.selectTheme',
                    title: 'Select Theme'
                };
                items.push(themeItem);
                break;

            case 'notification-settings':
                const notifications = config.get('notifications');
                
                // On Commit
                const onCommitItem = new vscode.TreeItem(
                    `On Commit: ${notifications.onCommit ? 'Enabled' : 'Disabled'}`
                );
                onCommitItem.iconPath = new vscode.ThemeIcon(notifications.onCommit ? 'check' : 'x');
                onCommitItem.tooltip = 'Whether to show notifications for successful commits';
                onCommitItem.command = {
                    command: 'comitto.toggleNotificationOnCommit',
                    title: 'Toggle On Commit Notification'
                };
                items.push(onCommitItem);
                
                // On Push
                const onPushItem = new vscode.TreeItem(
                    `On Push: ${notifications.onPush ? 'Enabled' : 'Disabled'}`
                );
                onPushItem.iconPath = new vscode.ThemeIcon(notifications.onPush ? 'check' : 'x');
                onPushItem.tooltip = 'Whether to show notifications for successful pushes';
                onPushItem.command = {
                    command: 'comitto.toggleNotificationOnPush',
                    title: 'Toggle On Push Notification'
                };
                items.push(onPushItem);
                
                // On Error
                const onErrorItem = new vscode.TreeItem(
                    `On Error: ${notifications.onError ? 'Enabled' : 'Disabled'}`
                );
                onErrorItem.iconPath = new vscode.ThemeIcon(notifications.onError ? 'check' : 'x');
                onErrorItem.tooltip = 'Whether to show notifications for errors';
                onErrorItem.command = {
                    command: 'comitto.toggleNotificationOnError',
                    title: 'Toggle On Error Notification'
                };
                items.push(onErrorItem);
                
                // On Trigger Fired
                const onTriggerItem = new vscode.TreeItem(
                    `On Trigger Fired: ${notifications.onTriggerFired ? 'Enabled' : 'Disabled'}`
                );
                onTriggerItem.iconPath = new vscode.ThemeIcon(notifications.onTriggerFired ? 'check' : 'x');
                onTriggerItem.tooltip = 'Whether to show notifications for trigger firings';
                onTriggerItem.command = {
                    command: 'comitto.toggleNotificationOnTriggerFired',
                    title: 'Toggle On Trigger Notification'
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
            'Commit Actions',
            vscode.TreeItemCollapsibleState.Expanded
        );
        commitGroup.contextValue = 'commit-actions';
        commitGroup.iconPath = new vscode.ThemeIcon('git-commit');
        items.push(commitGroup);

        // Git-Aktionen
        const gitGroup = new vscode.TreeItem(
            'Git Actions',
            vscode.TreeItemCollapsibleState.Expanded
        );
        gitGroup.contextValue = 'git-actions';
        gitGroup.iconPath = new vscode.ThemeIcon('source-control');
        items.push(gitGroup);

        // Einstellungs-Aktionen
        const configGroup = new vscode.TreeItem(
            'Configuration Actions',
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
                    `Toggle Comitto ${enabled ? 'Disabled' : 'Enabled'}`,
                    vscode.TreeItemCollapsibleState.None
                );
                toggleItem.iconPath = new vscode.ThemeIcon(enabled ? 'circle-slash' : 'check');
                toggleItem.tooltip = enabled ? 'Deaktiviert die automatischen Commits' : 'Aktiviert die automatischen Commits';
                toggleItem.command = {
                    command: 'comitto.toggleAutoCommit',
                    title: `Toggle Comitto ${enabled ? 'Disabled' : 'Enabled'}`
                };
                items.push(toggleItem);

                // Manueller Commit
                const manualCommitItem = new vscode.TreeItem(
                    'Perform Manual Commit',
                    vscode.TreeItemCollapsibleState.None
                );
                manualCommitItem.iconPath = new vscode.ThemeIcon('git-commit');
                manualCommitItem.tooltip = 'Führt einen manuellen Commit mit KI-generierter Nachricht aus';
                manualCommitItem.command = {
                    command: 'comitto.performManualCommit',
                    title: 'Perform Manual Commit'
                };
                items.push(manualCommitItem);
                break;

            case 'git-actions':
                // Alle Änderungen stagen
                const stageAllItem = new vscode.TreeItem(
                    'Stage All Changes',
                    vscode.TreeItemCollapsibleState.None
                );
                stageAllItem.iconPath = new vscode.ThemeIcon('add');
                stageAllItem.tooltip = 'Stagt alle geänderten Dateien für den nächsten Commit';
                stageAllItem.command = {
                    command: 'comitto.stageAll',
                    title: 'Stage All Changes'
                };
                items.push(stageAllItem);

                // Ausgewählte Dateien stagen
                const stageSelectedItem = new vscode.TreeItem(
                    'Stage Selected Files',
                    vscode.TreeItemCollapsibleState.None
                );
                stageSelectedItem.iconPath = new vscode.ThemeIcon('checklist');
                stageSelectedItem.tooltip = 'Erlaubt die Auswahl bestimmter Dateien zum Stagen';
                stageSelectedItem.command = {
                    command: 'comitto.stageSelected',
                    title: 'Stage Selected Files'
                };
                items.push(stageSelectedItem);

                // Git-Einstellungen bearbeiten
                const gitSettingsItem = new vscode.TreeItem(
                    'Edit Git Settings',
                    vscode.TreeItemCollapsibleState.None
                );
                gitSettingsItem.iconPath = new vscode.ThemeIcon('gear');
                gitSettingsItem.tooltip = 'Öffnet die Git-Einstellungen zur Bearbeitung';
                gitSettingsItem.command = {
                    command: 'comitto.openSettings',
                    title: 'Edit Git Settings'
                };
                items.push(gitSettingsItem);
                break;

            case 'config-actions':
                // KI-Provider konfigurieren
                const configAIItem = new vscode.TreeItem(
                    'Configure KI-Provider',
                    vscode.TreeItemCollapsibleState.None
                );
                configAIItem.iconPath = new vscode.ThemeIcon('symbol-misc');
                configAIItem.tooltip = 'Öffnet die KI-Provider-Konfiguration';
                configAIItem.command = {
                    command: 'comitto.configureAIProvider',
                    title: 'Configure KI-Provider'
                };
                items.push(configAIItem);

                // Trigger konfigurieren
                const configTriggersItem = new vscode.TreeItem(
                    'Configure Triggers',
                    vscode.TreeItemCollapsibleState.None
                );
                configTriggersItem.iconPath = new vscode.ThemeIcon('settings-gear');
                configTriggersItem.tooltip = 'Öffnet die Trigger-Konfiguration';
                configTriggersItem.command = {
                    command: 'comitto.configureTriggers',
                    title: 'Configure Triggers'
                };
                items.push(configTriggersItem);

                // Einfache UI anzeigen
                const simpleUIItem = new vscode.TreeItem(
                    'Open Simple User Interface',
                    vscode.TreeItemCollapsibleState.None
                );
                simpleUIItem.iconPath = new vscode.ThemeIcon('rocket');
                simpleUIItem.tooltip = 'Öffnet die vereinfachte Benutzeroberfläche';
                simpleUIItem.command = {
                    command: 'comitto.showSimpleUI',
                    title: 'Open Simple User Interface'
                };
                items.push(simpleUIItem);

                // Dashboard anzeigen
                const dashboardItem = new vscode.TreeItem(
                    'Show Dashboard',
                    vscode.TreeItemCollapsibleState.None
                );
                dashboardItem.iconPath = new vscode.ThemeIcon('dashboard');
                dashboardItem.tooltip = 'Öffnet das Comitto-Dashboard';
                dashboardItem.command = {
                    command: 'comitto.showDashboard',
                    title: 'Show Dashboard'
                };
                items.push(dashboardItem);
                break;
        }

        return items;
    }
}

/**
 * UI helper functions
 */

/**
 * Returns a display name for the AI provider
 * @param {string} provider Provider ID
 * @returns {string} Display name
 */
function getProviderDisplayName(provider) {
    switch (provider) {
        case 'ollama': return 'Ollama (local)';
        case 'openai': return 'OpenAI';
        case 'anthropic': return 'Anthropic Claude';
        default: return provider;
    }
}

/**
 * Returns an icon for the provider
 * @param {string} provider Provider ID
 * @returns {vscode.ThemeIcon} Icon for the provider
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
        { label: 'GPT-4 (January 2025)', value: 'gpt-4-0125-preview' },
        { label: 'GPT-4 (November 2023)', value: 'gpt-4-1106-preview' },
        { label: 'GPT-4 Vision Preview', value: 'gpt-4-vision-preview' },
        { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
        { label: 'GPT-3.5 Turbo (January 2024)', value: 'gpt-3.5-turbo-0125' },
        { label: 'GPT-3.5 Turbo (November 2023)', value: 'gpt-3.5-turbo-1106' }
    ];
}

/**
 * Returns a readable label for the staging mode
 * @param {string} mode The staging mode
 * @returns {string} Readable label
 */
function getStageModeLabel(mode) {
    switch (mode) {
        case 'all': return 'Stage all files';
        case 'specific': return 'Stage specific files';
        case 'prompt': return 'Ask each time';
        default: return mode;
    }
}

/**
 * Returns a readable label for the theme
 * @param {string} theme The theme
 * @returns {string} Readable label
 */
function getThemeLabel(theme) {
    switch (theme) {
        case 'light': return 'Light';
        case 'dark': return 'Dark';
        case 'auto': return 'Automatic';
        default: return theme;
    }
}

/**
 * Returns a readable description for the Git status code
 * @param {string} statusCode The Git status code
 * @returns {string} Readable description of the status
 */
function getStatusDescription(statusCode) {
    const firstChar = statusCode.charAt(0);
    const secondChar = statusCode.charAt(1);
    
    let description = '';
    
    // Index status (first character)
    if (firstChar === 'M') description = 'Modified in index';
    else if (firstChar === 'A') description = 'Added to index';
    else if (firstChar === 'D') description = 'Deleted from index';
    else if (firstChar === 'R') description = 'Renamed in index';
    else if (firstChar === 'C') description = 'Copied in index';
    else if (firstChar === 'U') description = 'Unmerged in index';
    
    // Working Directory status (second character)
    if (secondChar === 'M') {
        if (description) description += ', modified in working directory';
        else description = 'Modified in working directory';
    } else if (secondChar === 'D') {
        if (description) description += ', deleted in working directory';
        else description = 'Deleted in working directory';
    }
    
    // Untracked files
    if (statusCode === '??') description = 'Untracked file';
    
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