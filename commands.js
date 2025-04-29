const vscode = require('vscode');
const ui = require('./ui'); // Importiere UI-Modul für Hilfsfunktionen
const { executeGitCommand } = require('./utils'); // Annahme: executeGitCommand ist in utils.js

/**
 * Registriert die Befehle für die UI-Interaktionen
 * @param {vscode.ExtensionContext} context 
 * @param {Object} providers UI-Provider-Instanzen
 * @param {vscode.StatusBarItem} statusBarItem Das Statusleisten-Element
 * @param {Function} setupFileWatcher Funktion zum Einrichten des File Watchers
 * @param {Function} disableFileWatcher Funktion zum Deaktivieren des File Watchers
 * @param {Function} performAutoCommit Funktion zum Ausführen des Commits
 * @param {Function} showNotification Funktion zum Anzeigen von Benachrichtigungen
 */
function registerCommands(context, providers, statusBarItem, setupFileWatcher, disableFileWatcher, performAutoCommit, showNotification) {
    // #region Kernbefehle (vorher in extension.js)

    // Befehl zum Öffnen der Einstellungen
    context.subscriptions.push(vscode.commands.registerCommand('comitto.openSettings', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'comitto');
    }));

    // Befehl zum Aktualisieren der Einstellungsansicht
    context.subscriptions.push(vscode.commands.registerCommand('comitto.refreshSettings', () => {
        if (providers) {
            providers.statusProvider.refresh();
            providers.settingsProvider.refresh();
            providers.quickActionsProvider.refresh();
        }
        showNotification('Comitto-Einstellungen wurden aktualisiert.', 'info');
    }));

    // Befehl zum Aktivieren der automatischen Commits
    context.subscriptions.push(vscode.commands.registerCommand('comitto.enableAutoCommit', async () => {
        await vscode.workspace.getConfiguration('comitto').update('autoCommitEnabled', true, vscode.ConfigurationTarget.Global);
        setupFileWatcher(context); // Übergabe des Kontexts ist hier wichtig
        statusBarItem.text = "$(sync~spin) Comitto: Aktiv";
        
        // UI aktualisieren
        if (providers) {
            providers.statusProvider.refresh();
            providers.quickActionsProvider.refresh();
        }
        
        const config = vscode.workspace.getConfiguration('comitto');
        const uiSettings = config.get('uiSettings');
        if (uiSettings && uiSettings.showNotifications) {
            showNotification('Automatische Commits sind aktiviert.', 'info');
        }
    }));

    // Befehl zum Deaktivieren der automatischen Commits
    context.subscriptions.push(vscode.commands.registerCommand('comitto.disableAutoCommit', async () => {
        await vscode.workspace.getConfiguration('comitto').update('autoCommitEnabled', false, vscode.ConfigurationTarget.Global);
        disableFileWatcher();
        statusBarItem.text = "$(git-commit) Comitto: Inaktiv";
        
        // UI aktualisieren
        if (providers) {
            providers.statusProvider.refresh();
            providers.quickActionsProvider.refresh();
        }
        
        const config = vscode.workspace.getConfiguration('comitto');
        const uiSettings = config.get('uiSettings');
        if (uiSettings && uiSettings.showNotifications) {
            showNotification('Automatische Commits sind deaktiviert.', 'info');
        }
    }));
    
    // Befehl zum Umschalten der automatischen Commits
    context.subscriptions.push(vscode.commands.registerCommand('comitto.toggleAutoCommit', async () => {
        const config = vscode.workspace.getConfiguration('comitto');
        const isEnabled = !config.get('autoCommitEnabled');
        // Rufe die spezifischen enable/disable Befehle auf, um die Logik nicht zu duplizieren
        if (isEnabled) {
            await vscode.commands.executeCommand('comitto.enableAutoCommit');
        } else {
            await vscode.commands.executeCommand('comitto.disableAutoCommit');
        }
    }));

    // Befehl zum manuellen Ausführen eines KI-generierten Commits
    context.subscriptions.push(vscode.commands.registerCommand('comitto.performManualCommit', async () => {
        try {
            const config = vscode.workspace.getConfiguration('comitto');
            const uiSettings = config.get('uiSettings');
            
            // Optional Bestätigung anfordern
            let shouldProceed = true;
            if (uiSettings && uiSettings.confirmBeforeCommit) {
                shouldProceed = await vscode.window.showInformationMessage(
                    'Möchten Sie einen manuellen KI-Commit durchführen?',
                    { modal: true }, // Macht das Dialogfeld modal
                    'Ja'
                ) === 'Ja';
            }
            
            if (shouldProceed) {
                await performAutoCommit(true); // 'true' signalisiert manuellen Trigger
                // Die Erfolgsmeldung wird jetzt innerhalb von performAutoCommit angezeigt
            }
        } catch (error) {
            showNotification(`Fehler beim manuellen Commit: ${error.message}`, 'error');
        }
    }));

    // #endregion Kernbefehle

    // #region UI & Konfigurationsbefehle

    // KI-Provider auswählen
    context.subscriptions.push(vscode.commands.registerCommand('comitto.selectAiProvider', async () => {
        const providerOptions = [
            { label: 'Ollama (lokal)', id: 'ollama' },
            { label: 'OpenAI', id: 'openai' },
            { label: 'Anthropic Claude', id: 'anthropic' }
        ];
        
        const selected = await vscode.window.showQuickPick(providerOptions, {
            placeHolder: 'KI-Provider auswählen',
            title: 'Comitto - KI-Provider auswählen'
        });
        
        if (selected) {
            await vscode.workspace.getConfiguration('comitto').update('aiProvider', selected.id, vscode.ConfigurationTarget.Global);
            if (providers) {
                providers.statusProvider.refresh();
                providers.settingsProvider.refresh();
                providers.quickActionsProvider.refresh();
            }
            showNotification(`KI-Provider auf "${selected.label}" gesetzt.`, 'info');
        }
    }));

    // Ollama-Modell bearbeiten (ersetzt durch configureOllamaSettings)
    // context.subscriptions.push(vscode.commands.registerCommand('comitto.editOllamaModel', async () => { ... }));

    // Ollama-Endpoint bearbeiten (ersetzt durch configureOllamaSettings)
    // context.subscriptions.push(vscode.commands.registerCommand('comitto.editOllamaEndpoint', async () => { ... }));

    // OpenAI-Modell auswählen
    context.subscriptions.push(vscode.commands.registerCommand('comitto.selectOpenAIModel', async () => {
        await handleOpenAIModelSelectionCommand(); // Ruft die dedizierte Funktion auf
        if (providers) providers.settingsProvider.refresh();
    }));

    // OpenAI-Schlüssel bearbeiten
    context.subscriptions.push(vscode.commands.registerCommand('comitto.editOpenAIKey', async () => {
        await handleEditOpenAIKeyCommand();
        if (providers) providers.settingsProvider.refresh();
    }));

    // Anthropic-Modell auswählen
    context.subscriptions.push(vscode.commands.registerCommand('comitto.selectAnthropicModel', async () => {
        await handleSelectAnthropicModelCommand();
        if (providers) providers.settingsProvider.refresh();
    }));

    // Anthropic-Schlüssel bearbeiten
    context.subscriptions.push(vscode.commands.registerCommand('comitto.editAnthropicKey', async () => {
        await handleEditAnthropicKeyCommand();
        if (providers) providers.settingsProvider.refresh();
    }));

    // #region Trigger-Regeln Bearbeiten
    context.subscriptions.push(vscode.commands.registerCommand('comitto.editFileCountThreshold', async () => {
        await handleEditTriggerRuleCommand('fileCountThreshold', 'Datei-Anzahl Schwellenwert', 'z.B. 3', 'number');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('comitto.editMinChangeCount', async () => {
        await handleEditTriggerRuleCommand('minChangeCount', 'Änderungs-Anzahl Schwellenwert', 'z.B. 10', 'number');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('comitto.editTimeThreshold', async () => {
        await handleEditTriggerRuleCommand('timeThresholdMinutes', 'Zeit-Schwellwert (Minuten)', 'z.B. 30', 'number');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('comitto.editFilePatterns', async () => {
        await handleEditTriggerRuleCommand('filePatterns', 'Dateimuster (kommagetrennt)', 'z.B. **/*.js, **/*.ts', 'patterns');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('comitto.editSpecificFiles', async () => {
        await handleEditTriggerRuleCommand('specificFiles', 'Spezifische Dateien (kommagetrennt)', 'z.B. package.json, README.md', 'files');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('comitto.editIntervalMinutes', async () => {
        await handleEditTriggerRuleCommand('intervalMinutes', 'Intervall für Intervall-Trigger (Minuten)', 'z.B. 15', 'number');
    }));
    // #endregion

    // #region Git-Einstellungen Bearbeiten
    context.subscriptions.push(vscode.commands.registerCommand('comitto.toggleAutoPush', async () => {
        await handleToggleGitSettingCommand('autoPush', 'Auto-Push');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('comitto.editBranch', async () => {
        await handleEditGitSettingCommand('branch', 'Branch für Commits', 'Leer lassen für aktuellen Branch');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('comitto.selectCommitLanguage', async () => {
        await handleCommitMessageLanguageCommand(); // Behält eigene Logik wegen Prompt-Anpassung
    }));
    context.subscriptions.push(vscode.commands.registerCommand('comitto.selectCommitStyle', async () => {
        await handleSelectGitSettingCommand('commitMessageStyle', 'Commit-Nachrichtenstil', [
            { label: 'Conventional Commits', value: 'conventional' },
            { label: 'Gitmoji', value: 'gitmoji' }
        ]);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('comitto.toggleUseGitignore', async () => {
        await handleToggleGitSettingCommand('useGitignore', 'Gitignore-Verwendung');
        // Eventuell gitignore neu laden
        const commandExists = await vscode.commands.getCommands(true).then(cmds => cmds.includes('comitto.internal.reloadGitignore'));
        if (commandExists) {
            vscode.commands.executeCommand('comitto.internal.reloadGitignore');
        } else {
            console.warn('Befehl comitto.internal.reloadGitignore nicht gefunden.');
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('comitto.selectStageMode', async () => {
        await handleSelectStageModeCommand(); // Behält eigene Logik wegen Pattern-Frage
    }));
    context.subscriptions.push(vscode.commands.registerCommand('comitto.editStagingPatterns', async () => {
        await handleEditStagingPatternsCommand(); // Behält eigene Logik
    }));
    // #endregion

    // Prompt-Vorlage bearbeiten
    context.subscriptions.push(vscode.commands.registerCommand('comitto.editPromptTemplate', async () => {
        await handleEditPromptTemplateCommand();
        if (providers) providers.settingsProvider.refresh();
    }));

    // Dashboard anzeigen
    context.subscriptions.push(vscode.commands.registerCommand('comitto.showDashboard', async () => {
        await handleShowDashboardCommand(context);
    }));

    // KI-Provider konfigurieren (kombiniert Auswahl und spezifische Konfig)
    context.subscriptions.push(vscode.commands.registerCommand('comitto.configureAIProvider', async () => {
        await handleConfigureAIProviderCommand(providers);
    }));

    // Trigger konfigurieren (grafisch oder direkt)
    context.subscriptions.push(vscode.commands.registerCommand('comitto.configureTriggers', async () => {
        await handleConfigureTriggersCommand(context, providers);
    }));

    // Einfache Benutzeroberfläche anzeigen
    context.subscriptions.push(vscode.commands.registerCommand('comitto.showSimpleUI', () => {
        showSimpleUI(context, providers);
    }));

    // #region UI-Einstellungen Umschalten
    context.subscriptions.push(vscode.commands.registerCommand('comitto.toggleSimpleMode', async () => {
        await handleToggleUISettingCommand('simpleMode', 'Einfacher Modus');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('comitto.toggleConfirmBeforeCommit', async () => {
        await handleToggleUISettingCommand('confirmBeforeCommit', 'Bestätigung vor Commit');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('comitto.toggleShowNotifications', async () => {
        await handleToggleUISettingCommand('showNotifications', 'Benachrichtigungen');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('comitto.selectTheme', async () => {
        await handleSelectThemeCommand(); // Behält eigene Logik
    }));
    // #endregion

    // #region Trigger-Einstellungen Umschalten
    context.subscriptions.push(vscode.commands.registerCommand('comitto.toggleTriggerOnSave', async () => {
        await handleToggleTriggerRuleCommand('onSave', 'Trigger bei Speichern');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('comitto.toggleTriggerOnInterval', async () => {
        await handleToggleTriggerRuleCommand('onInterval', 'Intervall-Trigger');
        // Wenn aktiviert und kein Intervall gesetzt, zur Bearbeitung auffordern
        const config = vscode.workspace.getConfiguration('comitto');
        const rules = config.get('triggerRules');
        if (rules.onInterval && (!rules.intervalMinutes || rules.intervalMinutes <= 0)) {
            await handleEditTriggerRuleCommand('intervalMinutes', 'Intervall für Intervall-Trigger (Minuten)', 'z.B. 15', 'number');
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('comitto.toggleTriggerOnBranchSwitch', async () => {
        await handleToggleTriggerRuleCommand('onBranchSwitch', 'Trigger bei Branch-Wechsel');
    }));
    // #endregion

    // #region Staging-Befehle
    context.subscriptions.push(vscode.commands.registerCommand('comitto.stageAll', async () => {
        await handleStageAllCommand();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('comitto.stageSelected', async () => {
        await handleStageSelectedCommand();
    }));
    // #endregion

    // #endregion UI & Konfigurationsbefehle
}

// ==========================================================================
// HILFSFUNKTIONEN FÜR BEFEHLE
// ==========================================================================

// #region Generische Handler für Einstellungen

/**
 * Generischer Handler zum Bearbeiten einer Trigger-Regel.
 * @param {string} ruleKey Schlüssel der Regel in `triggerRules`.
 * @param {string} promptText Text für die Eingabeaufforderung.
 * @param {string} placeHolder Platzhalter für die Eingabeaufforderung.
 * @param {'number'|'patterns'|'files'} inputType Typ der Eingabe für Validierung/Parsing.
 */
async function handleEditTriggerRuleCommand(ruleKey, promptText, placeHolder, inputType) {
    const config = vscode.workspace.getConfiguration('comitto');
    const rules = { ...config.get('triggerRules') }; // Kopie erstellen
    const currentValue = rules[ruleKey];

    let valueToString = '';
    if (inputType === 'patterns' || inputType === 'files') {
        valueToString = Array.isArray(currentValue) ? currentValue.join(', ') : '';
    } else {
        valueToString = currentValue !== undefined ? currentValue.toString() : '';
    }

    const value = await vscode.window.showInputBox({
        value: valueToString,
        prompt: promptText,
        placeHolder: placeHolder,
        validateInput: text => {
            if (inputType === 'number') {
                if (!text) return 'Eingabe darf nicht leer sein.';
                const num = parseInt(text);
                if (isNaN(num) || num < (ruleKey === 'intervalMinutes' || ruleKey === 'timeThresholdMinutes' ? 1 : 0)) {
                    return 'Bitte geben Sie eine gültige positive Zahl ein.';
                }
            }
            // Keine spezielle Validierung für patterns/files hier, erfolgt beim Speichern
            return null;
        }
    });

    if (value !== undefined) {
        let processedValue;
        if (inputType === 'number') {
            processedValue = parseInt(value);
        } else if (inputType === 'patterns' || inputType === 'files') {
            processedValue = value.split(',').map(p => p.trim()).filter(p => p.length > 0);
            if (inputType === 'patterns' && processedValue.length === 0) {
                processedValue = ['**/*']; // Standard, wenn leer
            }
        } else {
            processedValue = value; // Fallback
        }

        rules[ruleKey] = processedValue;
        await config.update('triggerRules', rules, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`${promptText} aktualisiert.`);
        // UI Refresh wird durch onDidChangeConfiguration ausgelöst
    }
}

/**
 * Generischer Handler zum Umschalten einer booleschen Trigger-Regel.
 * @param {string} ruleKey Schlüssel der Regel in `triggerRules`.
 * @param {string} settingName Name der Einstellung für die Benachrichtigung.
 */
async function handleToggleTriggerRuleCommand(ruleKey, settingName) {
    const config = vscode.workspace.getConfiguration('comitto');
    const rules = { ...config.get('triggerRules') };
    const newValue = !rules[ruleKey];
    rules[ruleKey] = newValue;
    await config.update('triggerRules', rules, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(`${settingName} ${newValue ? 'aktiviert' : 'deaktiviert'}.`);
    // UI Refresh wird durch onDidChangeConfiguration ausgelöst
}

/**
 * Generischer Handler zum Bearbeiten einer Git-Einstellung.
 * @param {string} settingKey Schlüssel der Einstellung in `gitSettings`.
 * @param {string} promptText Text für die Eingabeaufforderung.
 * @param {string} placeHolder Platzhalter für die Eingabeaufforderung.
 */
async function handleEditGitSettingCommand(settingKey, promptText, placeHolder) {
    const config = vscode.workspace.getConfiguration('comitto');
    const gitSettings = { ...config.get('gitSettings') }; // Kopie erstellen
    const currentValue = gitSettings[settingKey];

    const value = await vscode.window.showInputBox({
        value: currentValue !== undefined ? currentValue.toString() : '',
        prompt: promptText,
        placeHolder: placeHolder,
    });

    if (value !== undefined) {
        gitSettings[settingKey] = value;
        await config.update('gitSettings', gitSettings, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`${promptText} aktualisiert.`);
        // UI Refresh wird durch onDidChangeConfiguration ausgelöst
    }
}

/**
 * Generischer Handler zum Umschalten einer booleschen Git-Einstellung.
 * @param {string} settingKey Schlüssel der Einstellung in `gitSettings`.
 * @param {string} settingName Name der Einstellung für die Benachrichtigung.
 */
async function handleToggleGitSettingCommand(settingKey, settingName) {
    const config = vscode.workspace.getConfiguration('comitto');
    const gitSettings = { ...config.get('gitSettings') };
    const newValue = !gitSettings[settingKey];
    gitSettings[settingKey] = newValue;
    await config.update('gitSettings', gitSettings, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(`${settingName} ${newValue ? 'aktiviert' : 'deaktiviert'}.`);
    // UI Refresh wird durch onDidChangeConfiguration ausgelöst
}

/**
 * Generischer Handler zum Auswählen einer Git-Einstellung aus einer Liste.
 * @param {string} settingKey Schlüssel der Einstellung in `gitSettings`.
 * @param {string} placeHolder Platzhalter für die QuickPick-Liste.
 * @param {Array<{label: string, value: any}>} options Auswahloptionen.
 */
async function handleSelectGitSettingCommand(settingKey, placeHolder, options) {
    const config = vscode.workspace.getConfiguration('comitto');
    const gitSettings = { ...config.get('gitSettings') };
    const currentValue = gitSettings[settingKey];

    const selected = await vscode.window.showQuickPick(
        options.map(opt => ({ 
            ...opt,
            description: currentValue === opt.value ? '(Aktuell)' : ''
        })),
        {
            placeHolder: placeHolder,
            ignoreFocusOut: true
        }
    );

    if (selected) {
        gitSettings[settingKey] = selected.value;
        await config.update('gitSettings', gitSettings, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`${placeHolder} auf "${selected.label}" gesetzt.`);
        // UI Refresh wird durch onDidChangeConfiguration ausgelöst
    }
}

/**
 * Generischer Handler zum Umschalten einer booleschen UI-Einstellung.
 * @param {string} settingKey Schlüssel der Einstellung in `uiSettings`.
 * @param {string} settingName Name der Einstellung für die Benachrichtigung.
 */
async function handleToggleUISettingCommand(settingKey, settingName) {
    const config = vscode.workspace.getConfiguration('comitto');
    const uiSettings = { ...config.get('uiSettings') };
    const newValue = !uiSettings[settingKey];
    uiSettings[settingKey] = newValue;
    await config.update('uiSettings', uiSettings, vscode.ConfigurationTarget.Global);
    
    // Für Benachrichtigungen immer eine Nachricht zeigen
    if (settingKey === 'showNotifications') {
         vscode.window.showInformationMessage(`${settingName} wurden ${newValue ? 'aktiviert' : 'deaktiviert'}.`);
    } else if (uiSettings.showNotifications) {
        vscode.window.showInformationMessage(`${settingName} wurde ${newValue ? 'aktiviert' : 'deaktiviert'}.`);
    }
    // UI Refresh wird durch onDidChangeConfiguration ausgelöst
}

// #endregion

// #region Spezifische Handler (Beibehaltene Logik)

/**
 * Behandelt das Kommando zum Bearbeiten des OpenAI API-Schlüssels.
 */
async function handleEditOpenAIKeyCommand() {
    const config = vscode.workspace.getConfiguration('comitto');
    const currentValue = config.get('openai.apiKey');
    const value = await vscode.window.showInputBox({
        value: currentValue,
        prompt: 'Geben Sie Ihren OpenAI API-Schlüssel ein',
        placeHolder: 'sk-...',
        password: true,
        ignoreFocusOut: true
    });
    
    if (value !== undefined) {
        await config.update('openai.apiKey', value, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage('OpenAI API-Schlüssel aktualisiert.');
    }
}

/**
 * Behandelt das Kommando zur Auswahl des Anthropic-Modells.
 */
async function handleSelectAnthropicModelCommand() {
    const config = vscode.workspace.getConfiguration('comitto');
    const currentModel = config.get('anthropic.model');
    const models = [
        'claude-3-haiku-20240307',
        'claude-3-sonnet-20240229',
        'claude-3-opus-20240229',
        'claude-2.1',
        'claude-2.0',
        'claude-instant-1.2'
    ];
    
    const selected = await vscode.window.showQuickPick(
        models.map(name => ({
            label: name,
            description: name === currentModel ? '(Aktuell)' : ''
        })),
        { 
            placeHolder: 'Claude-Modell auswählen',
            ignoreFocusOut: true
        }
    );
    
    if (selected) {
        await config.update('anthropic.model', selected.label, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Anthropic-Modell auf ${selected.label} gesetzt.`);
    }
}

/**
 * Behandelt das Kommando zum Bearbeiten des Anthropic API-Schlüssels.
 */
async function handleEditAnthropicKeyCommand() {
    const config = vscode.workspace.getConfiguration('comitto');
    const currentValue = config.get('anthropic.apiKey');
    const value = await vscode.window.showInputBox({
        value: currentValue,
        prompt: 'Geben Sie Ihren Anthropic API-Schlüssel ein',
        placeHolder: 'sk-ant-...',
        password: true,
        ignoreFocusOut: true
    });
    
    if (value !== undefined) {
        await config.update('anthropic.apiKey', value, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage('Anthropic API-Schlüssel aktualisiert.');
    }
}

/**
 * Behandelt das Kommando zur Bearbeitung der Prompt-Vorlage.
 */
async function handleEditPromptTemplateCommand() {
    const config = vscode.workspace.getConfiguration('comitto');
    const currentValue = config.get('promptTemplate');
    
    // Temporäre Datei erstellen und öffnen
    try {
        const document = await vscode.workspace.openTextDocument({
            content: currentValue,
            language: 'markdown'
        });
        
        await vscode.window.showTextDocument(document);
        
        // Listener für Speichern hinzufügen und nach erfolgreichem Speichern wieder entfernen
        const disposable = vscode.workspace.onDidSaveTextDocument(async (doc) => {
            if (doc === document) {
                const newContent = doc.getText();
                // Nur aktualisieren, wenn sich der Inhalt geändert hat
                if (newContent !== currentValue) {
                    await config.update('promptTemplate', newContent, vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage('Prompt-Vorlage wurde gespeichert.');
                }
                disposable.dispose(); // Listener entfernen
                // Optional: Temporäres Dokument schließen?
                // await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
            }
        });
        
        // Listener für Schließen des Dokuments (ohne Speichern)
        const closeDisposable = vscode.workspace.onDidCloseTextDocument(doc => {
            if (doc === document) {
                disposable.dispose(); // Auch den Speicher-Listener entfernen
                closeDisposable.dispose();
            }
        });

    } catch (error) {
        vscode.window.showErrorMessage(`Fehler beim Öffnen der Prompt-Vorlage: ${error.message}`);
        console.error('Fehler bei handleEditPromptTemplateCommand:', error);
    }
}

/**
 * Behandelt das Kommando zum Anzeigen des Dashboards.
 * @param {vscode.ExtensionContext} context 
 */
async function handleShowDashboardCommand(context) {
    // Panel für Webview erstellen oder anzeigen
    let panel = context.globalState.get('comittoDashboardPanel');
    const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

    if (panel) {
        panel.reveal(column);
        // Inhalt aktualisieren
        panel.webview.html = generateDashboardHTML(context);
    } else {
        panel = vscode.window.createWebviewPanel(
            'comittoDashboard',
            'Comitto Dashboard',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'resources')]
            }
        );
        context.globalState.update('comittoDashboardPanel', panel);

        panel.webview.html = generateDashboardHTML(context);

        // Nachrichtenhandling für Webview
        panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'refresh':
                        panel.webview.html = generateDashboardHTML(context);
                        break;
                    case 'toggleAutoCommit':
                        await vscode.commands.executeCommand('comitto.toggleAutoCommit');
                        // UI wird durch Event-Listener aktualisiert
                        // Panel-Inhalt auch aktualisieren
                        setTimeout(() => panel.webview.html = generateDashboardHTML(context), 100); // Kurze Verzögerung
                        break;
                    case 'performManualCommit':
                        await vscode.commands.executeCommand('comitto.performManualCommit');
                        break;
                    case 'openSettings':
                         await vscode.commands.executeCommand('comitto.openSettings');
                         break;
                    case 'configureAI':
                         await vscode.commands.executeCommand('comitto.configureAIProvider');
                         setTimeout(() => panel.webview.html = generateDashboardHTML(context), 100); // Kurze Verzögerung
                         break;
                    case 'configureTriggers':
                         await vscode.commands.executeCommand('comitto.configureTriggers');
                         break;
                }
            },
            undefined,
            context.subscriptions
        );

        // Bereinigen, wenn das Panel geschlossen wird
        panel.onDidDispose(() => {
            panel = undefined;
            context.globalState.update('comittoDashboardPanel', undefined);
        }, null, context.subscriptions);
    }
}

/**
 * Behandelt das Kommando zur Konfiguration des KI-Providers.
 * @param {Object} providers 
 */
async function handleConfigureAIProviderCommand(providers) {
    const providerOptions = [
        { label: 'Ollama (lokal)', id: 'ollama' },
        { label: 'OpenAI', id: 'openai' },
        { label: 'Anthropic Claude', id: 'anthropic' }
    ];
    
    const selectedProvider = await vscode.window.showQuickPick(providerOptions, {
        placeHolder: 'KI-Provider auswählen',
        title: 'Comitto - KI-Provider konfigurieren'
    });
    
    if (!selectedProvider) return;
    
    // Provider in der Konfiguration speichern
    await vscode.workspace.getConfiguration('comitto').update('aiProvider', selectedProvider.id, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(`KI-Provider auf "${selectedProvider.label}" gesetzt.`);
    
    // Provider-spezifische Einstellungen konfigurieren
    let configSuccess = true;
    switch (selectedProvider.id) {
        case 'ollama':
            configSuccess = await configureOllamaSettings();
            break;
        case 'openai':
            await handleOpenAIModelSelectionCommand();
            await handleEditOpenAIKeyCommand(); // Fragen wir gleich nach dem Key
            break;
        case 'anthropic':
            await handleSelectAnthropicModelCommand();
            await handleEditAnthropicKeyCommand(); // Fragen wir gleich nach dem Key
            break;
    }
    
    // UI nur aktualisieren, wenn Konfiguration erfolgreich war
    if (configSuccess && providers) {
        providers.statusProvider.refresh();
        providers.quickActionsProvider.refresh();
        providers.settingsProvider.refresh();
    }
}

/**
 * Konfiguriert die Ollama-Einstellungen (Endpunkt und Modell) mit verbesserter UX.
 * @returns {Promise<boolean>} True bei Erfolg, False bei Abbruch/Fehler.
 */
async function configureOllamaSettings() {
    try {
        const config = vscode.workspace.getConfiguration('comitto');
        const currentEndpoint = config.get('ollama.endpoint') || 'http://localhost:11434/api/generate';
        const currentModel = config.get('ollama.model') || 'llama3';
        
        // Konfiguration des Endpoints
        const endpoint = await vscode.window.showInputBox({
            placeHolder: 'http://localhost:11434/api/generate',
            prompt: 'Ollama API-Endpunkt',
            value: currentEndpoint,
            validateInput: value => {
                if (!value) return 'Der Endpunkt darf nicht leer sein';
                if (!value.startsWith('http://') && !value.startsWith('https://')) {
                    return 'Der Endpunkt muss mit http:// oder https:// beginnen';
                }
                // Einfache URL-Validierung (optional, könnte komplexer sein)
                try {
                    new URL(value);
                } catch (e) {
                    return 'Ungültige URL';
                }
                return null; // Kein Fehler
            },
            ignoreFocusOut: true
        });
        
        // Abbruch durch Benutzer
        if (endpoint === undefined) return false;

        await config.update('ollama.endpoint', endpoint, vscode.ConfigurationTarget.Global);
        
        // Versuche, die Verbindung zu Ollama zu testen und Modelle zu laden
        let availableModels = [];
        let connectionError = null;
        try {
            const statusBarMessage = vscode.window.setStatusBarMessage('$(sync~spin) Teste Verbindung zu Ollama und lade Modelle...', 5000);
            const axios = require('axios');
            // Verwende /api/tags zum Testen der Verbindung und Abrufen der Modelle
            const tagsEndpoint = endpoint.replace(/\/api\/(generate|chat)$/, '/api/tags');
            const response = await axios.get(tagsEndpoint, { timeout: 7000 }); // 7 Sekunden Timeout
            statusBarMessage.dispose(); // Nachricht entfernen
            
            if (response.data && response.data.models) {
                availableModels = response.data.models.map(model => model.name).sort();
                vscode.window.showInformationMessage(`Verbindung zu Ollama erfolgreich! ${availableModels.length} Modelle gefunden.`);
            } else {
                vscode.window.showWarningMessage('Verbindung zu Ollama erfolgreich, aber keine Modelle gefunden.');
            }
        } catch (error) {
            connectionError = error;
            console.error('Fehler beim Testen der Ollama-Verbindung:', error);
            vscode.window.showWarningMessage(
                `Warnung: Konnte keine Verbindung zu Ollama herstellen (${error.message}). ` +
                'Bitte stellen Sie sicher, dass Ollama läuft und der Endpunkt korrekt ist.'
            );
        }
        
        // Konfiguration des Modells
        const popularModels = [
            'llama3', 'mistral', 'mixtral', 'phi', 'gemma', 'codellama', 'orca-mini'
        ];
        
        // Kombiniere populäre und verfügbare Modelle ohne Duplikate
        const allModels = [...new Set([...availableModels, ...popularModels])].sort(); // Sortieren für bessere Übersicht
        
        // QuickPick für Modell-Auswahl
        const quickPickItems = allModels.map(model => ({
            label: model,
            description: availableModels.includes(model) ? '$(check) Lokal verfügbar' : '$(cloud-download) Evtl. Download nötig',
            detail: model === currentModel ? '(Aktuell ausgewählt)' : ''
        }));
        
        const selectedModel = await vscode.window.showQuickPick(quickPickItems, {
            placeHolder: 'Wählen Sie ein Ollama-Modell',
            title: 'Ollama Modell auswählen',
            ignoreFocusOut: true
        });
        
        // Abbruch durch Benutzer
        if (!selectedModel) return false;

        await config.update('ollama.model', selectedModel.label, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Ollama-Modell auf "${selectedModel.label}" gesetzt.`);
        
        return true; // Erfolg
    } catch (error) {
        vscode.window.showErrorMessage(`Fehler bei der Konfiguration von Ollama: ${error.message}`);
        console.error('Fehler bei der Konfiguration von Ollama:', error);
        return false; // Fehler
    }
}

/**
 * Behandelt das Kommando zur Auswahl des OpenAI-Modells.
 */
async function handleOpenAIModelSelectionCommand() {
    try {
        const config = vscode.workspace.getConfiguration('comitto');
        const currentModel = config.get('openai.model') || 'gpt-4o'; // Standard aktualisiert
        
        // Aktuelle Modelle (Stand Juli 2024)
        const models = [
            { label: 'GPT-4o', value: 'gpt-4o' },
            { label: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
            { label: 'GPT-4', value: 'gpt-4' },
            { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' }
            // Ältere oder spezifischere Modelle ggf. hinzufügen
            // { label: 'GPT-4 Turbo (Preview)', value: 'gpt-4-turbo-preview' }, 
            // { label: 'GPT-3.5 Turbo 16K', value: 'gpt-3.5-turbo-16k' },
        ];
        
        const selected = await vscode.window.showQuickPick(
            models.map(model => ({
                label: model.label,
                description: model.value,
                detail: currentModel === model.value ? '(Aktuell)' : ''
            })),
            {
                placeHolder: 'OpenAI-Modell wählen',
                title: 'OpenAI Modell auswählen',
                canPickMany: false,
                ignoreFocusOut: true
            }
        );
        
        if (selected) {
            await config.update('openai.model', selected.description, vscode.ConfigurationTarget.Global); // Speichere den 'value'
            vscode.window.showInformationMessage(`OpenAI-Modell auf ${selected.label} geändert.`);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Fehler bei der OpenAI-Modellauswahl: ${error.message}`);
        console.error('Fehler bei der OpenAI-Modellauswahl:', error);
    }
}

/**
 * Behandelt das Kommando zur Konfiguration der Trigger-Regeln.
 * @param {vscode.ExtensionContext} context 
 * @param {Object} providers 
 */
async function handleConfigureTriggersCommand(context, providers) {
    const configOptions = [
        // { label: 'Grafischer Trigger-Konfigurator öffnen', id: 'graphical', description: 'Visuelle Einstellung der Trigger' }, // Zukünftig?
        { label: 'Trigger-Einstellungen bearbeiten', id: 'direct', description: 'Einzelne Trigger-Regeln anpassen' }
    ];
    
    const selectedOption = await vscode.window.showQuickPick(configOptions, {
        placeHolder: 'Wie möchten Sie die Trigger konfigurieren?',
        title: 'Comitto - Trigger konfigurieren'
    });
    
    if (!selectedOption) return;
    
    // if (selectedOption.id === 'graphical') {
    //     showTriggerConfigWebview(context, providers); // Für zukünftige grafische UI
    // } else
     if (selectedOption.id === 'direct') {
        // Menü zur Auswahl der spezifischen Trigger-Einstellung
        const config = vscode.workspace.getConfiguration('comitto');
        const rules = config.get('triggerRules');
        
        const triggerOptions = [
            { label: `Datei-Anzahl Schwellenwert: ${rules.fileCountThreshold}`, id: 'comitto.editFileCountThreshold' },
            { label: `Änderungs-Anzahl Schwellenwert: ${rules.minChangeCount}`, id: 'comitto.editMinChangeCount' },
            { label: `Zeit-Schwellwert (Minuten): ${rules.timeThresholdMinutes}`, id: 'comitto.editTimeThreshold' },
            { label: `Trigger bei Speichern: ${rules.onSave ? 'Ja' : 'Nein'}`, id: 'comitto.toggleTriggerOnSave' },
            { label: `Intervall-Trigger: ${rules.onInterval ? `Ja (alle ${rules.intervalMinutes} Min.)` : 'Nein'}`, id: 'comitto.toggleTriggerOnInterval' },
            { label: `Intervall-Dauer bearbeiten`, id: 'comitto.editIntervalMinutes', disabled: !rules.onInterval }, // Nur wenn Intervall aktiv
            { label: `Trigger bei Branch-Wechsel: ${rules.onBranchSwitch ? 'Ja' : 'Nein'}`, id: 'comitto.toggleTriggerOnBranchSwitch' },
            { label: 'Dateimuster bearbeiten', id: 'comitto.editFilePatterns' },
            { label: 'Spezifische Dateien bearbeiten', id: 'comitto.editSpecificFiles' }
        ];
        
        const selectedTrigger = await vscode.window.showQuickPick(
             triggerOptions.filter(opt => !opt.disabled), // Deaktivierte Optionen ausblenden
             {
                placeHolder: 'Welche Trigger-Einstellung möchten Sie bearbeiten?',
                title: 'Comitto - Trigger-Regel bearbeiten'
             }
        );
        
        if (selectedTrigger && selectedTrigger.id) {
            vscode.commands.executeCommand(selectedTrigger.id);
        }
    }
}

/**
 * Zeigt die einfache Benutzeroberfläche als Webview an.
 * @param {vscode.ExtensionContext} context 
 * @param {Object} providers 
 */
function showSimpleUI(context, providers) {
    const config = vscode.workspace.getConfiguration('comitto');
    const autoCommitEnabled = config.get('autoCommitEnabled');
    const aiProvider = config.get('aiProvider');
    const providerName = ui.getProviderDisplayName(aiProvider); // ui-Modul verwenden
    
    let panel = context.globalState.get('comittoSimpleUIPanel');
    const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

    const htmlContent = generateSimpleUIHTML(autoCommitEnabled, providerName, context);

    if (panel) {
        panel.reveal(column);
        panel.webview.html = htmlContent; // Immer aktualisieren
    } else {
        panel = vscode.window.createWebviewPanel(
            'comittoSimpleUI',
            'Comitto - Einfache Bedienung',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'resources')]
            }
        );
        context.globalState.update('comittoSimpleUIPanel', panel);

        panel.webview.html = htmlContent;
        
        // Nachrichtenhandling für Webview
        panel.webview.onDidReceiveMessage(
            async message => {
                let refreshNeeded = false;
                switch (message.command) {
                    case 'toggleAutoCommit':
                        await vscode.commands.executeCommand('comitto.toggleAutoCommit');
                        refreshNeeded = true;
                        break;
                    case 'performManualCommit':
                        await vscode.commands.executeCommand('comitto.performManualCommit');
                        break;
                    case 'openSettings':
                        await vscode.commands.executeCommand('comitto.openSettings');
                        break;
                    case 'configureAI':
                        await vscode.commands.executeCommand('comitto.configureAIProvider');
                        refreshNeeded = true;
                        break;
                    case 'configureTriggers':
                        await vscode.commands.executeCommand('comitto.configureTriggers');
                        break;
                }
                // Panel neu laden, wenn nötig
                if (refreshNeeded && panel) {
                     // Kurze Verzögerung, damit Konfigurationsänderung wirksam wird
                    setTimeout(() => {
                         if(panel) { // Prüfen ob Panel noch existiert
                            const newConfig = vscode.workspace.getConfiguration('comitto');
                            const newEnabled = newConfig.get('autoCommitEnabled');
                            const newProvider = newConfig.get('aiProvider');
                            panel.webview.html = generateSimpleUIHTML(newEnabled, ui.getProviderDisplayName(newProvider), context);
                         }
                    }, 200);
                }
            },
            undefined,
            context.subscriptions
        );

        panel.onDidDispose(() => {
            panel = undefined;
            context.globalState.update('comittoSimpleUIPanel', undefined);
        }, null, context.subscriptions);
    }
}

/**
 * Generiert das HTML für die einfache Benutzeroberfläche.
 * @param {boolean} autoCommitEnabled 
 * @param {string} providerName 
 * @param {vscode.ExtensionContext} context
 * @returns {string} 
 */
function generateSimpleUIHTML(autoCommitEnabled, providerName, context) {
    // Pfade zu Ressourcen erstellen
    const scriptUri = vscode.Uri.joinPath(context.extensionUri, 'resources', 'ui', 'simpleUI.js');
    const styleUri = vscode.Uri.joinPath(context.extensionUri, 'resources', 'ui', 'styles.css');
    const logoUri = vscode.Uri.joinPath(context.extensionUri, 'resources', 'comitto_icon_bw.svg'); // Beispiel-Logo

    // Webview URIs erstellen
    const scriptWebviewUri = panel.webview.asWebviewUri(scriptUri);
    const styleWebviewUri = panel.webview.asWebviewUri(styleUri);
    const logoWebviewUri = panel.webview.asWebviewUri(logoUri);
    
    // Nonce für CSP
    const nonce = getNonce();

    // Version aus package.json lesen (optional)
    let version = '0.5.0'; // Fallback
    try {
        const pkgPath = vscode.Uri.joinPath(context.extensionUri, 'package.json').fsPath;
        const pkg = JSON.parse(require('fs').readFileSync(pkgPath, 'utf8'));
        version = pkg.version || version;
    } catch (e) {
        console.error("Fehler beim Lesen der package.json für Version", e);
    }

    return `
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <!-- Content Security Policy -->
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${panel.webview.cspSource} 'unsafe-inline'; img-src ${panel.webview.cspSource} https: data:; script-src 'nonce-${nonce}';">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${styleWebviewUri}" rel="stylesheet">
        <title>Comitto - Einfache Bedienung</title>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <img src="${logoWebviewUri}" alt="Comitto Logo" class="logo"/>
                <h1>Comitto</h1>
            </div>
            
            <div class="status ${autoCommitEnabled ? 'status-enabled' : 'status-disabled'}">
                Automatische Commits: <strong>${autoCommitEnabled ? 'AKTIVIERT' : 'DEAKTIVIERT'}</strong>
            </div>
            
            <div class="action-buttons">
                <button id="toggleBtn" data-enabled="${autoCommitEnabled}">
                    <span class="icon">${autoCommitEnabled ? '🚫' : '✅'}</span>
                    ${autoCommitEnabled ? 'Auto-Commit deaktivieren' : 'Auto-Commit aktivieren'}
                </button>
                <button id="manualCommitBtn">
                    <span class="icon">💾</span>
                    Manuellen Commit ausführen
                </button>
            </div>
            
            <div class="info-box">
                <h2>KI-Provider</h2>
                <div class="provider-box">
                     <div class="provider-info">
                        <span class="icon">🧠</span>
                        <p>Aktiver Provider: <strong>${providerName}</strong></p>
                     </div>
                     <button id="configureAIBtn" class="settings-button">Konfigurieren</button>
                </div>
            </div>
            
             <div class="info-box">
                <h2>Weitere Aktionen</h2>
                <button id="configureTriggersBtn" class="settings-button full-width">
                    <span class="icon">⚙️</span> Trigger konfigurieren
                </button>
                 <button id="openSettingsBtn" class="settings-button full-width">
                    <span class="icon">🔧</span> Alle Einstellungen öffnen
                </button>
            </div>

            <div class="footer">
                <p>Comitto v${version}</p>
            </div>
        </div>
        
        <script nonce="${nonce}" src="${scriptWebviewUri}"></script>
    </body>
    </html>
    `;
}

/**
 * Generiert das HTML für das Dashboard (Webview).
 * @param {vscode.ExtensionContext} context
 * @returns {string} HTML-Inhalt
 */
function generateDashboardHTML(context) {
    const config = vscode.workspace.getConfiguration('comitto');
    const enabled = config.get('autoCommitEnabled');
    const provider = config.get('aiProvider');
    const rules = config.get('triggerRules');
    const gitSettings = config.get('gitSettings');
    const providerName = ui.getProviderDisplayName(provider);
    const providerIcon = ui.getProviderIcon(provider); // Holen des Icons

    let providerModel = '';
    switch (provider) {
        case 'ollama': providerModel = config.get('ollama.model'); break;
        case 'openai': providerModel = config.get('openai.model'); break;
        case 'anthropic': providerModel = config.get('anthropic.model'); break;
    }

    // Pfade zu Ressourcen
    const scriptUri = vscode.Uri.joinPath(context.extensionUri, 'resources', 'ui', 'dashboard.js');
    const styleUri = vscode.Uri.joinPath(context.extensionUri, 'resources', 'ui', 'styles.css');
    const logoUri = vscode.Uri.joinPath(context.extensionUri, 'resources', 'comitto_icon_color.svg'); // Farbige Version für Dashboard

    // Webview URIs erstellen (benötigt das Panel-Objekt, holen wir es aus dem globalState)
    let panel = context.globalState.get('comittoDashboardPanel');
    if (!panel) return "<div>Dashboard konnte nicht geladen werden. Panel nicht gefunden.</div>";

    const scriptWebviewUri = panel.webview.asWebviewUri(scriptUri);
    const styleWebviewUri = panel.webview.asWebviewUri(styleUri);
    const logoWebviewUri = panel.webview.asWebviewUri(logoUri);
    
    // Nonce für CSP
    const nonce = getNonce();
    
    // Version aus package.json lesen (optional)
    let version = '0.5.0'; // Fallback
    try {
        const pkgPath = vscode.Uri.joinPath(context.extensionUri, 'package.json').fsPath;
        const pkg = JSON.parse(require('fs').readFileSync(pkgPath, 'utf8'));
        version = pkg.version || version;
    } catch (e) {
        console.error("Fehler beim Lesen der package.json für Version", e);
    }

    return `
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <!-- Content Security Policy -->
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${panel.webview.cspSource} 'unsafe-inline'; img-src ${panel.webview.cspSource} https: data:; script-src 'nonce-${nonce}';">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${styleWebviewUri}" rel="stylesheet">
        <title>Comitto Dashboard</title>
    </head>
    <body>
        <div class="container dashboard">
            <div class="header">
                 <img src="${logoWebviewUri}" alt="Comitto Logo" class="logo"/>
                <h1>Comitto Dashboard</h1>
                 <button id="refreshBtn" class="header-button" title="Aktualisieren">🔄</button>
            </div>

            <div class="action-buttons dashboard-actions">
                <button id="commitBtn" title="Jetzt einen Commit mit KI generieren">
                    <span class="icon">💾</span> Manueller Commit
                </button>
                <button id="toggleBtn" data-enabled="${enabled}" title="Automatische Commits an-/ausschalten">
                    <span class="icon">${enabled ? '🚫' : '✅'}</span> ${enabled ? 'Deaktivieren' : 'Aktivieren'}
                </button>
            </div>

            <div class="status ${enabled ? 'status-enabled' : 'status-disabled'}">
                <strong>Status:</strong> Comitto ist derzeit ${enabled ? 'aktiviert' : 'deaktiviert'}
            </div>
            
            <div class="card">
                <h2><span class="icon">${providerIcon.id ? `$(${providerIcon.id})` : '🧠'}</span> KI-Konfiguration</h2>
                <div class="card-content">
                    <div class="card-item">
                        <strong>Provider:</strong> ${providerName}
                    </div>
                    <div class="card-item">
                        <strong>Modell:</strong> ${providerModel || 'Nicht gesetzt'}
                    </div>
                </div>
                 <button id="configureAIBtn" class="settings-button">Provider konfigurieren</button>
            </div>
            
            <div class="card">
                <h2><span class="icon">⚙️</span> Trigger-Regeln</h2>
                <div class="card-content">
                    <div class="card-item">
                        <strong>Datei-Anzahl:</strong> ${rules.fileCountThreshold}
                    </div>
                    <div class="card-item">
                        <strong>Änderungs-Anzahl:</strong> ${rules.minChangeCount}
                    </div>
                    <div class="card-item">
                        <strong>Zeit-Schwellwert:</strong> ${rules.timeThresholdMinutes} Minuten
                    </div>
                    <div class="card-item">
                        <strong>Aktive Trigger:</strong> 
                        ${[rules.onSave && 'Speichern', rules.onInterval && `Intervall (${rules.intervalMinutes} Min.)`, rules.onBranchSwitch && 'Branch-Wechsel'].filter(Boolean).join(', ') || 'Keine'}
                    </div>
                </div>
                 <button id="configureTriggersBtn" class="settings-button">Trigger konfigurieren</button>
            </div>
            
            <div class="card">
                <h2><span class="icon"></span> Git-Einstellungen</h2>
                <div class="card-content">
                    <div class="card-item">
                        <strong>Auto-Push:</strong> ${gitSettings.autoPush ? 'Ja' : 'Nein'}
                    </div>
                    <div class="card-item">
                        <strong>Branch:</strong> ${gitSettings.branch || 'Aktueller Branch'}
                    </div>
                    <div class="card-item">
                        <strong>Sprache:</strong> ${gitSettings.commitMessageLanguage === 'de' ? 'Deutsch' : 'Englisch'}
                    </div>
                    <div class="card-item">
                        <strong>Stil:</strong> ${gitSettings.commitMessageStyle}
                    </div>
                    <div class="card-item">
                        <strong>Staging-Modus:</strong> ${ui.getStageModeLabel(gitSettings.stageMode)}
                    </div>
                </div>
                <button id="openSettingsBtn" class="settings-button">Alle Einstellungen öffnen</button>
            </div>

             <div class="footer">
                <p>Comitto v${version}</p>
            </div>
        </div>
        
       <script nonce="${nonce}" src="${scriptWebviewUri}"></script>
    </body>
    </html>
    `;
}

/**
 * Generiert eine Nonce für die Content Security Policy.
 * @returns {string} Eine zufällige Nonce.
 */
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}


/**
 * Behandelt das Kommando zur Auswahl der Commit-Nachrichtensprache.
 */
async function handleCommitMessageLanguageCommand() {
    try {
        const config = vscode.workspace.getConfiguration('comitto');
        const gitSettings = config.get('gitSettings') || {};
        const currentLanguage = gitSettings.commitMessageLanguage || 'en';
        
        const languages = [
            { label: 'Englisch', value: 'en' },
            { label: 'Deutsch', value: 'de' }
        ];
        
        const selectedLanguage = await vscode.window.showQuickPick(
            languages.map(lang => ({ 
                label: lang.label, 
                value: lang.value, 
                description: currentLanguage === lang.value ? '(Aktuell)' : '' 
            })),
            {
                placeHolder: 'Sprache für Commit-Nachrichten wählen',
                canPickMany: false,
                ignoreFocusOut: true
            }
        );
        
        if (selectedLanguage) {
            // Sicherstellen, dass gitSettings existiert und aktualisieren
            const updatedSettings = { ...gitSettings, commitMessageLanguage: selectedLanguage.value };
            await config.update('gitSettings', updatedSettings, vscode.ConfigurationTarget.Global);
            
            // Aktualisiere auch den promptTemplate entsprechend
            let promptTemplate = config.get('promptTemplate') || '';
            const isEnglish = selectedLanguage.value === 'en';
            const targetLang = isEnglish ? 'English' : 'German';
            const currentLangPattern = /in (English|Englisch|German|Deutsch)/i;
            const defaultPromptBase = `Generate a meaningful commit message in ${targetLang} for the following changes:\n\n{{diff}}\n\nUse the Conventional Commits format (feat, fix, docs, etc.) and keep the message under 100 characters.`;
            
            if (currentLangPattern.test(promptTemplate)) {
                // Ersetze vorhandene Sprachangabe
                promptTemplate = promptTemplate.replace(currentLangPattern, `in ${targetLang}`);
            } else {
                // Füge Sprachangabe hinzu oder setze Standard-Prompt
                 // Prüfe, ob es ein benutzerdefinierter Prompt ist (heuristic)
                if (promptTemplate.includes('{{diff}}') || promptTemplate.includes('{changes}')) {
                     // Füge nur die Sprachpräferenz hinzu, wenn es nach einem benutzerdefinierten Prompt aussieht
                     promptTemplate += ` (Write the commit message in ${targetLang})`;
                } else {
                     // Setze auf Standard-Prompt, wenn es kein erkennbarer Prompt war
                     promptTemplate = defaultPromptBase;
                }
            }
            
            // Ersetze {changes} durch {{diff}} falls noch vorhanden
             promptTemplate = promptTemplate.replace('{changes}', '{{diff}}');

            await config.update('promptTemplate', promptTemplate, vscode.ConfigurationTarget.Global);
            
            vscode.window.showInformationMessage(`Sprache für Commit-Nachrichten auf ${selectedLanguage.label} geändert.`);
            // UI Refresh wird durch onDidChangeConfiguration ausgelöst
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Fehler bei der Sprachauswahl: ${error.message}`);
        console.error('Fehler bei der Sprachauswahl:', error);
    }
}

/**
 * Behandelt das Kommando zur Auswahl des Staging-Modus.
 */
async function handleSelectStageModeCommand() {
    const config = vscode.workspace.getConfiguration('comitto');
    const gitSettings = { ...config.get('gitSettings') };
    const currentMode = gitSettings.stageMode || 'all';

    const modes = [
        { label: 'Alle Änderungen', value: 'all', detail: 'Alle geänderten Dateien automatisch stagen (`git add .`)' },
        { label: 'Spezifische Muster', value: 'specific', detail: 'Nur Dateien stagen, die bestimmten Mustern entsprechen' },
        { label: 'Manuell auswählen', value: 'prompt', detail: 'Vor jedem Commit nach zu stagenden Dateien fragen' }
    ];

    const selected = await vscode.window.showQuickPick(
        modes.map(mode => ({ ...mode, description: currentMode === mode.value ? '(Aktuell)' : ''})),
        {
            placeHolder: 'Staging-Modus auswählen',
            title: 'Wie sollen Änderungen gestaged werden?',
            ignoreFocusOut: true
        });

    if (selected) {
        gitSettings.stageMode = selected.value;
        await config.update('gitSettings', gitSettings, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Staging-Modus auf "${selected.label}" gesetzt.`);
        
        // Wenn "Spezifische Dateien" ausgewählt wurde und keine Muster existieren, nach Mustern fragen
        if (selected.value === 'specific' && (!gitSettings.specificStagingPatterns || gitSettings.specificStagingPatterns.length === 0)) {
            await handleEditStagingPatternsCommand();
        }
        // UI Refresh wird durch onDidChangeConfiguration ausgelöst
    }
}

/**
 * Behandelt das Kommando zum Bearbeiten der Staging-Muster.
 */
async function handleEditStagingPatternsCommand() {
    const config = vscode.workspace.getConfiguration('comitto');
    const gitSettings = { ...config.get('gitSettings') };
    const currentPatterns = gitSettings.specificStagingPatterns || [];

    const input = await vscode.window.showInputBox({
        placeHolder: '*.js,*.json,src/**/*',
        value: currentPatterns.join(','),
        prompt: 'Kommagetrennte Glob-Muster für spezifisches Staging',
        title: 'Staging-Muster bearbeiten',
        ignoreFocusOut: true
    });

    if (input !== undefined) {
        const patterns = input.split(',').map(p => p.trim()).filter(p => p);
        gitSettings.specificStagingPatterns = patterns;
        await config.update('gitSettings', gitSettings, vscode.ConfigurationTarget.Global);
        if (patterns.length > 0) {
            vscode.window.showInformationMessage(`Spezifische Staging-Muster aktualisiert: ${patterns.join(', ')}`);
        } else {
             vscode.window.showInformationMessage('Spezifische Staging-Muster entfernt.');
        }
       // UI Refresh wird durch onDidChangeConfiguration ausgelöst
    }
}

/**
 * Behandelt das Kommando zum Ausführen des "Alle Änderungen stagen"-Befehls.
 * @returns {Promise<boolean>} True bei Erfolg, False bei Fehler/Abbruch.
 */
async function handleStageAllCommand() {
    try {
        const workspaceFolder = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('Kein Workspace geöffnet.');
            return false;
        }
        const repoPath = workspaceFolder.uri.fsPath;
        
        // Prüfe, ob es überhaupt Änderungen gibt
        const statusOutput = await executeGitCommand('git status --porcelain', repoPath);
        if (!statusOutput.trim()) {
            vscode.window.showInformationMessage('Keine Änderungen zum Stagen vorhanden.');
            return true;
        }

        const statusBarMessage = vscode.window.setStatusBarMessage('$(sync~spin) Stage alle Änderungen...', 2000);
        await executeGitCommand('git add .', repoPath);
        statusBarMessage.dispose();
        vscode.window.showInformationMessage('Alle Änderungen wurden gestaged.');
        return true;
    } catch (error) {
        vscode.window.showErrorMessage(`Fehler beim Stagen aller Änderungen: ${error.message}`);
        return false;
    }
}

/**
 * Behandelt das Kommando zum Ausführen des "Ausgewählte Dateien stagen"-Befehls.
 * @returns {Promise<boolean>} True bei Erfolg, False bei Fehler/Abbruch.
 */
async function handleStageSelectedCommand() {
    try {
        const workspaceFolder = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('Kein Workspace geöffnet.');
            return false;
        }
        const repoPath = workspaceFolder.uri.fsPath;
        
        // Git-Status abrufen
        const statusOutput = await executeGitCommand('git status --porcelain', repoPath);
        if (!statusOutput.trim()) {
            vscode.window.showInformationMessage('Keine Änderungen zum Stagen gefunden.');
            return true;
        }
        
        // Geänderte Dateien parsen und für QuickPick vorbereiten
        const changedFiles = statusOutput
            .split('\n')
            .filter(line => line.trim() !== '')
            .map(line => {
                const status = line.substring(0, 2);
                const filePath = line.substring(3).trim(); // Trimmen ist wichtig
                return { 
                    status,
                    filePath,
                    label: `${ui.getStatusDescription(status)}: ${filePath}`,
                    picked: !status.includes('?') // Vorauswahl aller Dateien außer untracked
                };
            });
        
        if (changedFiles.length === 0) {
            vscode.window.showInformationMessage('Keine Änderungen zum Stagen gefunden.');
            return true;
        }
        
        // Dateien zur Auswahl anbieten
        const selectedItems = await vscode.window.showQuickPick(changedFiles, {
            placeHolder: 'Wählen Sie die zu stagenden Dateien aus',
            canPickMany: true,
            ignoreFocusOut: true,
            title: 'Dateien für Staging auswählen'
        });
        
        if (!selectedItems || selectedItems.length === 0) {
            vscode.window.showInformationMessage('Keine Dateien zum Stagen ausgewählt.');
            return false; // Benutzerabbruch
        }
        
        const statusBarMessage = vscode.window.setStatusBarMessage(`$(sync~spin) Stage ${selectedItems.length} Datei(en)...`, 5000);
        // Ausgewählte Dateien stagen
        // Git add akzeptiert mehrere Dateien, sicherstellen, dass Pfade korrekt sind
        const filesToStage = selectedItems.map(item => `"${item.filePath}"`).join(' ');
        await executeGitCommand(`git add -- ${filesToStage}`, repoPath); // '--' trennt Optionen von Dateipfaden
        
        statusBarMessage.dispose();
        vscode.window.showInformationMessage(`${selectedItems.length} Datei(en) wurden gestaged.`);
        return true;
    } catch (error) {
        vscode.window.showErrorMessage(`Fehler beim Stagen ausgewählter Dateien: ${error.message}`);
        console.error("Staging Error Details:", error);
        return false;
    }
}

/**
 * Behandelt das Kommando zur Auswahl des Themes.
 */
async function handleSelectThemeCommand() {
    const config = vscode.workspace.getConfiguration('comitto');
    const uiSettings = { ...config.get('uiSettings') };
    const currentTheme = uiSettings.theme || 'auto';

    const themes = [
        { label: 'Hell', value: 'light', detail: 'Helles Theme für Comitto UI-Elemente' },
        { label: 'Dunkel', value: 'dark', detail: 'Dunkles Theme für Comitto UI-Elemente' },
        { label: 'Automatisch', value: 'auto', detail: 'Theme automatisch an VS Code anpassen' }
    ];

    const selected = await vscode.window.showQuickPick(
        themes.map(theme => ({...theme, description: currentTheme === theme.value ? '(Aktuell)' : ''})),
        {
            placeHolder: 'Theme für Comitto auswählen',
            title: 'Comitto Theme',
            ignoreFocusOut: true
        });

    if (selected) {
        uiSettings.theme = selected.value;
        await config.update('uiSettings', uiSettings, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Comitto Theme auf "${selected.label}" gesetzt.`);
        // UI Refresh wird durch onDidChangeConfiguration ausgelöst
    }
}

// #endregion Spezifische Handler

module.exports = {
    registerCommands,
    handleSelectThemeCommand,
    handleStageSelectedCommand,
    handleStageAllCommand,
    handlePerformManualCommitCommand,
    handleShowSimpleUICommand,
    handleSelectStageModeCommand,
    handleEditStagingPatternsCommand,
    handleToggleUseGitignoreCommand,
    handleToggleSimpleModeCommand,
    handleToggleConfirmBeforeCommitCommand,
    handleToggleShowNotificationsCommand,
    handleConfigureAIProviderCommand,
    handleSelectOpenAIModelCommand,
    handleEditOpenAIKeyCommand,
    handleSelectAnthropicModelCommand,
    handleEditAnthropicKeyCommand,
    handleEditPromptTemplateCommand
}; 