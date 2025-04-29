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

    // Neue Toggle-Befehle für Trigger-Regeln
    context.subscriptions.push(vscode.commands.registerCommand('comitto.toggleOnSave', async () => {
        await handleToggleTriggerRuleCommand('onSave', 'Speichern-Trigger');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('comitto.toggleOnInterval', async () => {
        await handleToggleTriggerRuleCommand('onInterval', 'Intervall-Trigger');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('comitto.toggleOnBranchSwitch', async () => {
        await handleToggleTriggerRuleCommand('onBranchSwitch', 'Branch-Wechsel-Trigger');
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

    // #region UI-Einstellungen
    context.subscriptions.push(vscode.commands.registerCommand('comitto.toggleSimpleMode', async () => {
        await handleToggleUISettingCommand('simpleMode', 'Einfacher Modus');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('comitto.toggleConfirmBeforeCommit', async () => {
        await handleToggleUISettingCommand('confirmBeforeCommit', 'Bestätigung vor Commit');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('comitto.toggleShowNotifications', async () => {
        await handleToggleUISettingCommand('showNotifications', 'Benachrichtigungen anzeigen');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('comitto.selectTheme', async () => {
        await handleSelectThemeCommand();
    }));
    // #endregion

    // #region Benachrichtigungseinstellungen
    context.subscriptions.push(vscode.commands.registerCommand('comitto.toggleNotificationOnCommit', async () => {
        await handleToggleNotificationSettingCommand('onCommit', 'Commit-Benachrichtigungen');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('comitto.toggleNotificationOnPush', async () => {
        await handleToggleNotificationSettingCommand('onPush', 'Push-Benachrichtigungen');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('comitto.toggleNotificationOnError', async () => {
        await handleToggleNotificationSettingCommand('onError', 'Fehler-Benachrichtigungen');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('comitto.toggleNotificationOnTriggerFired', async () => {
        await handleToggleNotificationSettingCommand('onTriggerFired', 'Trigger-Benachrichtigungen');
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
    try {
        const config = vscode.workspace.getConfiguration('comitto');
        const triggerRules = config.get('triggerRules') || {};
        
        // Aktuellen Wert umkehren (true -> false, false -> true)
        const newValue = !(triggerRules[ruleKey]);
        
        // Aktualisierte triggerRules erstellen
        const updatedRules = { ...triggerRules, [ruleKey]: newValue };
        
        // In die Konfiguration schreiben
        await config.update('triggerRules', updatedRules, vscode.ConfigurationTarget.Global);
        
        // Benachrichtigung anzeigen
        vscode.window.showInformationMessage(`${settingName} wurde ${newValue ? 'aktiviert' : 'deaktiviert'}.`);
        
        // Falls es der Intervall-Trigger ist und er aktiviert wurde, nach dem Intervall fragen
        if (ruleKey === 'onInterval' && newValue && (!triggerRules.intervalMinutes || triggerRules.intervalMinutes <= 0)) {
            await handleEditTriggerRuleCommand('intervalMinutes', 'Intervall (Minuten)', 'z.B. 5', 'number');
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Fehler beim Umschalten von ${settingName}: ${error.message}`);
    }
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
    try {
        // Neues Panel erstellen
        const panel = vscode.window.createWebviewPanel(
            'comittoDashboard',
            'Comitto Dashboard',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(context.extensionUri, 'resources')
                ]
            }
        );
        
        // Nachrichten vom Webview verarbeiten
        panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'refresh':
                        try {
                            panel.webview.html = generateDashboardHTML(context);
                        } catch (error) {
                            console.error('Fehler beim Aktualisieren des Dashboards:', error);
                            vscode.window.showErrorMessage(`Fehler beim Aktualisieren des Dashboards: ${error.message}`);
                        }
                        break;
                    case 'toggleAutoCommit':
                        try {
                            const config = vscode.workspace.getConfiguration('comitto');
                            const enabled = !config.get('autoCommitEnabled');
                            await config.update('autoCommitEnabled', enabled, vscode.ConfigurationTarget.Global);
                            panel.webview.html = generateDashboardHTML(context);
                        } catch (error) {
                            console.error('Fehler beim Umschalten des Auto-Commit-Status:', error);
                            vscode.window.showErrorMessage(`Fehler beim Umschalten des Auto-Commit-Status: ${error.message}`);
                        }
                        break;
                    case 'manualCommit':
                        vscode.commands.executeCommand('comitto.performManualCommit');
                        break;
                    case 'openSettings':
                        vscode.commands.executeCommand('comitto.openSettings');
                        break;
                    case 'configureProvider':
                        vscode.commands.executeCommand('comitto.configureAIProvider');
                        break;
                    case 'configureTriggers':
                        vscode.commands.executeCommand('comitto.configureTriggers');
                        break;
                }
            },
            undefined,
            context.subscriptions
        );

        // HTML für das Webview generieren und setzen
        console.log('Setze Dashboard-HTML');
        try {
            panel.webview.html = generateDashboardHTML(context);
        } catch (error) {
            console.error('Fehler beim Generieren des Dashboard-HTML:', error);
            vscode.window.showErrorMessage(`Fehler beim Öffnen des Dashboards: ${error.message}`);
            
            // Fallback-HTML setzen
            panel.webview.html = `
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        .error { color: red; }
                    </style>
                </head>
                <body>
                    <h1>Fehler beim Laden des Dashboards</h1>
                    <p class="error">${error.message}</p>
                    <p>Bitte schließen Sie das Dashboard und versuchen Sie es erneut zu öffnen.</p>
                </body>
                </html>
            `;
        }
    } catch (error) {
        console.error('Fehler beim Öffnen des Dashboards:', error);
        vscode.window.showErrorMessage(`Fehler beim Öffnen des Comitto-Dashboards: ${error.message}`);
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
 * Funktion zum Verwalten der OpenAI-Modellauswahl
 * Verbesserte Implementierung mit moderner Benutzeroberfläche
 * @returns {Promise<void>}
 */
async function handleOpenAIModelSelectionCommand() {
    try {
        // OpenAI-Modelle aus UI-Modul abrufen
        const models = ui.getOpenAIModelOptions().map(option => ({
            label: option.label,
            description: option.value,
            detail: option.value === 'gpt-4o' ? 'Empfohlen' : undefined
        }));
        
        // Aktuelles Modell abrufen
        const config = vscode.workspace.getConfiguration('comitto');
        const currentModel = config.get('openai.model');
        
        // Modellauswahl anzeigen
        const selectedModel = await vscode.window.showQuickPick(models, {
            placeHolder: 'Wählen Sie ein OpenAI-Modell',
            title: 'OpenAI-Modell auswählen',
            matchOnDescription: true,
            matchOnDetail: true
        });
        
        if (selectedModel) {
            // Konfiguration aktualisieren
            await config.update('openai.model', selectedModel.description, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`OpenAI-Modell auf "${selectedModel.label}" gesetzt.`);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Fehler bei der OpenAI-Modellauswahl: ${error.message}`);
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
            { label: `Trigger bei Speichern: ${rules.onSave ? 'Ja' : 'Nein'}`, id: 'comitto.toggleOnSave' },
            { label: `Intervall-Trigger: ${rules.onInterval ? `Ja (alle ${rules.intervalMinutes} Min.)` : 'Nein'}`, id: 'comitto.toggleOnInterval' },
            { label: `Intervall-Dauer bearbeiten`, id: 'comitto.editIntervalMinutes', disabled: !rules.onInterval }, // Nur wenn Intervall aktiv
            { label: `Trigger bei Branch-Wechsel: ${rules.onBranchSwitch ? 'Ja' : 'Nein'}`, id: 'comitto.toggleOnBranchSwitch' },
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
 * Zeigt eine einfache Benutzeroberfläche für grundlegende Funktionen.
 * @param {vscode.ExtensionContext} context 
 * @param {Object} providers 
 */
function showSimpleUI(context, providers) {
    try {
        // Neues Panel erstellen
        const panel = vscode.window.createWebviewPanel(
            'comittoSimpleUI',
            'Comitto: Einfache Benutzeroberfläche',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(context.extensionUri, 'resources')
                ]
            }
        );
        
        // Konfiguration auslesen
        const config = vscode.workspace.getConfiguration('comitto');
        const autoCommitEnabled = config.get('autoCommitEnabled');
        const providerName = ui.getProviderDisplayName(config.get('aiProvider'));
        
        // HTML für das Webview generieren und setzen
        panel.webview.html = generateSimpleUIHTML(autoCommitEnabled, providerName, context);
        
        // Nachrichten vom Webview verarbeiten
        panel.webview.onDidReceiveMessage(
            async (message) => {
                try {
                    switch (message.command) {
                        case 'toggleAutoCommit':
                            const newEnabled = !autoCommitEnabled;
                            await config.update('autoCommitEnabled', newEnabled, vscode.ConfigurationTarget.Global);
                            // UI-Aktualisierung (wird automatisch durch Konfigurationsänderung ausgelöst)
                            break;
                        case 'performManualCommit':
                            vscode.commands.executeCommand('comitto.performManualCommit');
                            break;
                        case 'selectProvider':
                            vscode.commands.executeCommand('comitto.configureAIProvider');
                            break;
                        case 'configureTriggers':
                            vscode.commands.executeCommand('comitto.configureTriggers');
                            break;
                        case 'openDashboard':
                            vscode.commands.executeCommand('comitto.showDashboard');
                            break;
                        case 'openSettings':
                            vscode.commands.executeCommand('comitto.openSettings');
                            break;
                    }
                } catch (error) {
                    vscode.window.showErrorMessage(`Fehler bei der Verarbeitung der SimpleUI-Aktion: ${error.message}`);
                }
            },
            undefined,
            context.subscriptions
        );
    } catch (error) {
        console.error('Fehler beim Öffnen der einfachen Benutzeroberfläche:', error);
        vscode.window.showErrorMessage(`Fehler beim Öffnen der einfachen Benutzeroberfläche: ${error.message}`);
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
    const simpleUIJsUri = vscode.Uri.joinPath(context.extensionUri, 'resources', 'ui', 'simpleUI.js');
    const styleUri = vscode.Uri.joinPath(context.extensionUri, 'resources', 'ui', 'styles.css');
    const animationsUri = vscode.Uri.joinPath(context.extensionUri, 'resources', 'ui', 'animations.css');
    const logoUri = vscode.Uri.joinPath(context.extensionUri, 'resources', 'icon.svg');

    // Webview URIs erstellen
    let panel = context.globalState.get('comittoSimpleUIPanel');
    if (!panel) return "<div>Simple UI konnte nicht geladen werden.</div>";

    const simpleUIJsWebviewUri = panel.webview.asWebviewUri(simpleUIJsUri);
    const styleWebviewUri = panel.webview.asWebviewUri(styleUri);
    const animationsWebviewUri = panel.webview.asWebviewUri(animationsUri);
    const logoWebviewUri = panel.webview.asWebviewUri(logoUri);
    
    // Nonce für CSP
    const nonce = getNonce();

    // Version aus package.json lesen
    let version = '0.9.5'; // Aktuelle Version
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
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${panel.webview.cspSource} https://cdn.jsdelivr.net 'unsafe-inline'; font-src https://fonts.gstatic.com; img-src ${panel.webview.cspSource} https: data:; script-src 'nonce-${nonce}' https://cdn.jsdelivr.net; connect-src 'none';">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        
        <!-- Tailwind CSS -->
        <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
        
        <!-- Custom Styles -->
        <link href="${styleWebviewUri}" rel="stylesheet">
        <link href="${animationsWebviewUri}" rel="stylesheet">
        
        <!-- Google Fonts - Inter -->
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        
        <title>Comitto - Einfache Bedienung</title>
        
        <style nonce="${nonce}">
            /* Spezifische Inline-Styles für diese Ansicht */
            .animated-bg {
                background: linear-gradient(-45deg, #6366f1, #4f46e5, #3b82f6, #0ea5e9);
                background-size: 400% 400%;
                animation: animated-bg 15s ease infinite;
            }
            
            .status-box {
                border-radius: 16px;
                padding: 1rem;
                margin: 1.5rem 0;
                text-align: center;
                font-size: 1.25rem;
                font-weight: 500;
                transition: all 0.3s ease;
            }
            
            .provider-card {
                display: flex;
                align-items: center;
                gap: 1rem;
                padding: 1rem;
                border-radius: 12px;
                background: rgba(255, 255, 255, 0.1);
                margin-bottom: 1rem;
            }
            
            .provider-icon {
                font-size: 2rem;
                width: 48px;
                height: 48px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 12px;
                background: rgba(99, 102, 241, 0.2);
            }
        </style>
    </head>
    <body class="vscode-dark">
        <div class="container animated-bg">
            <!-- Header mit Logo -->
            <div class="header flex items-center justify-center py-6">
                <img src="${logoWebviewUri}" alt="Comitto Logo" class="h-16 w-16 floating-element"/>
                <h1 class="text-3xl font-bold ml-4 typing">Comitto</h1>
            </div>
            
            <!-- Status-Anzeige -->
            <div class="status-box glass-container ${autoCommitEnabled ? 'bg-green-900 bg-opacity-20' : 'bg-red-900 bg-opacity-20'} border ${autoCommitEnabled ? 'border-green-500' : 'border-red-500'} shadow-lg">
                <div class="flex items-center justify-center">
                    <span class="status-indicator ${autoCommitEnabled ? 'status-active pulse' : 'status-inactive'} mr-2"></span>
                    <span>Automatische Commits: <strong>${autoCommitEnabled ? 'AKTIVIERT' : 'DEAKTIVIERT'}</strong></span>
                </div>
            </div>
            
            <!-- Aktions-Buttons -->
            <div class="action-buttons flex flex-col gap-4 mt-8">
                <button id="toggleBtn" class="btn ${autoCommitEnabled ? 'btn-danger' : 'btn-secondary'} hover-lift w-full text-lg py-4" data-enabled="${autoCommitEnabled}">
                    <span class="icon text-2xl">${autoCommitEnabled ? '🚫' : '✅'}</span>
                    ${autoCommitEnabled ? 'Auto-Commit deaktivieren' : 'Auto-Commit aktivieren'}
                </button>
                
                <button id="manualCommitBtn" class="btn hover-lift w-full text-lg py-4">
                    <span class="icon text-2xl">💾</span>
                    Manuellen Commit ausführen
                </button>
            </div>
            
            <!-- KI-Provider Info -->
            <div class="info-box glass-container mt-8 p-4 rounded-xl shadow-lg">
                <h2 class="text-xl font-semibold mb-4 flex items-center">
                    <span class="icon mr-2">🧠</span> KI-Provider
                </h2>
                <div class="provider-card">
                    <div class="provider-icon">🤖</div>
                    <div class="flex-1">
                        <p>Aktiver Provider:</p>
                        <p class="text-lg font-semibold">${providerName}</p>
                    </div>
                    <button id="configureAIBtn" class="btn btn-icon">
                        <span class="icon">⚙️</span>
                    </button>
                </div>
            </div>
            
            <!-- Weitere Aktionen -->
            <div class="info-box glass-container mt-6 p-4 rounded-xl shadow-lg">
                <h2 class="text-xl font-semibold mb-4 flex items-center">
                    <span class="icon mr-2">⚡</span> Weitere Aktionen
                </h2>
                <div class="grid grid-cols-1 gap-3">
                    <button id="configureTriggersBtn" class="btn btn-secondary hover-lift">
                        <span class="icon">⚙️</span> Trigger konfigurieren
                    </button>
                    <button id="openDashboardBtn" class="btn btn-secondary hover-lift">
                        <span class="icon">📊</span> Dashboard öffnen
                    </button>
                    <button id="openSettingsBtn" class="btn btn-secondary hover-lift">
                        <span class="icon">🔧</span> Alle Einstellungen
                    </button>
                </div>
            </div>
            
            <!-- Footer -->
            <div class="footer mt-8 mb-4 text-center opacity-70">
                <p>Comitto v${version}</p>
            </div>
        </div>
        
        <!-- Simple UI JavaScript -->
        <script nonce="${nonce}" src="${simpleUIJsWebviewUri}"></script>
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
    // Bestehendes Panel abrufen
    let panel = context.globalState.get('comittoDashboardPanel');
    if (!panel || !panel.webview) {
        console.error('Dashboard-Panel nicht gefunden oder webview nicht verfügbar');
        // Das Panel sollte bereits erstellt worden sein, bevor diese Funktion aufgerufen wird
        // Statt undefined zurückzugeben, geben wir eine Fehlermeldung zurück
        return `<html><body><h1>Fehler beim Initialisieren des Dashboards</h1>
                <p>Bitte schließen Sie das Dashboard und versuchen Sie es erneut zu öffnen.</p></body></html>`;
    }
    
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
    const dashboardJsUri = vscode.Uri.joinPath(context.extensionUri, 'resources', 'ui', 'dashboard.js');
    const styleUri = vscode.Uri.joinPath(context.extensionUri, 'resources', 'ui', 'styles.css');
    const animationsUri = vscode.Uri.joinPath(context.extensionUri, 'resources', 'ui', 'animations.css');
    const logoUri = vscode.Uri.joinPath(context.extensionUri, 'resources', 'icon.svg');
    
    // Webview URIs erstellen
    const dashboardJsWebviewUri = panel.webview.asWebviewUri(dashboardJsUri);
    const styleWebviewUri = panel.webview.asWebviewUri(styleUri);
    const animationsWebviewUri = panel.webview.asWebviewUri(animationsUri);
    const logoWebviewUri = panel.webview.asWebviewUri(logoUri);
    
    // Nonce für CSP
    const nonce = getNonce();
    
    // Version aus package.json lesen
    let version = '0.9.6'; // Aktuelle Version
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
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${panel.webview.cspSource} https://cdn.jsdelivr.net 'unsafe-inline'; font-src https://fonts.gstatic.com; img-src ${panel.webview.cspSource} https: data:; script-src 'nonce-${nonce}' https://cdn.jsdelivr.net; connect-src 'none';">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        
        <!-- Tailwind CSS -->
        <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
        
        <!-- Custom Styles -->
        <link href="${styleWebviewUri}" rel="stylesheet">
        <link href="${animationsWebviewUri}" rel="stylesheet">
        
        <!-- Google Fonts - Inter -->
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        
        <title>Comitto Dashboard</title>
    </head>
    <body class="vscode-dark">
        <div class="container glass-container animated-bg">
            <div class="dashboard-header">
                <div class="flex items-center gap-4">
                    <img src="${logoWebviewUri}" alt="Comitto Logo" class="h-12 w-12 floating-element"/>
                    <h1 class="dashboard-title typing">Comitto Dashboard</h1>
                </div>
                <button id="refreshBtn" class="btn btn-icon" title="Aktualisieren">
                    <span class="icon">🔄</span>
                </button>
            </div>
            
            <div class="flex justify-between items-center mb-6 fade-in" style="animation-delay: 0.2s">
                <div class="status ${enabled ? 'status-enabled' : 'status-disabled'} flex items-center">
                    <span class="status-indicator ${enabled ? 'status-active' : 'status-inactive'}"></span>
                    <span><strong>Status:</strong> Comitto ist derzeit ${enabled ? 'aktiviert' : 'deaktiviert'}</span>
                </div>
                
                <div class="flex gap-2">
                    <button id="commitBtn" class="btn hover-lift" title="Jetzt einen Commit mit KI generieren">
                        <span class="icon">💾</span> Manueller Commit
                    </button>
                    <button id="toggleBtn" class="btn ${enabled ? 'btn-danger' : 'btn-secondary'} hover-lift" data-enabled="${enabled}" title="Automatische Commits an-/ausschalten">
                        <span class="icon">${enabled ? '🚫' : '✅'}</span> ${enabled ? 'Deaktivieren' : 'Aktivieren'}
                    </button>
                </div>
            </div>
            
            <div class="dashboard fade-in" style="animation-delay: 0.4s">
                <!-- KI-Konfiguration -->
                <div class="card interactive">
                    <div class="card-header">
                        <h2 class="card-title">
                            <span class="icon">${providerIcon.id ? `$(${providerIcon.id})` : '🧠'}</span> KI-Konfiguration
                        </h2>
                        <span class="badge badge-primary">
                            ${providerName}
                        </span>
                    </div>
                    <div class="card-content">
                        <p class="mb-2"><strong>Modell:</strong> ${providerModel || 'Nicht gesetzt'}</p>
                        <div class="flex justify-center mt-4">
                            <button id="configureAIBtn" class="btn btn-secondary hover-lift">
                                <span class="icon">⚙️</span> KI konfigurieren
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Trigger-Regeln -->
                <div class="card interactive">
                    <div class="card-header">
                        <h2 class="card-title">
                            <span class="icon">⚙️</span> Trigger-Regeln
                        </h2>
                        <span class="badge ${rules.onSave || rules.onInterval ? 'badge-success' : 'badge-danger'}">
                            ${rules.onSave || rules.onInterval ? 'Aktiv' : 'Inaktiv'}
                        </span>
                    </div>
                    <div class="card-content">
                        <div class="grid grid-cols-2 gap-2 mb-3">
                            <div>
                                <p><strong>Datei-Anzahl:</strong></p>
                                <span class="badge">${rules.fileCountThreshold}</span>
                            </div>
                            <div>
                                <p><strong>Änderungs-Anzahl:</strong></p>
                                <span class="badge">${rules.minChangeCount}</span>
                            </div>
                            <div>
                                <p><strong>Zeit-Schwellwert:</strong></p>
                                <span class="badge">${rules.timeThresholdMinutes} Min.</span>
                            </div>
                            <div>
                                <p><strong>Aktive Trigger:</strong></p>
                                <div class="flex flex-wrap gap-1">
                                    ${rules.onSave ? '<span class="badge badge-success">Speichern</span>' : ''}
                                    ${rules.onInterval ? `<span class="badge badge-success">Intervall (${rules.intervalMinutes} Min.)</span>` : ''}
                                    ${rules.onBranchSwitch ? '<span class="badge badge-success">Branch-Wechsel</span>' : ''}
                                    ${!rules.onSave && !rules.onInterval && !rules.onBranchSwitch ? '<span class="badge badge-danger">Keine</span>' : ''}
                                </div>
                            </div>
                        </div>
                        <div class="flex justify-center">
                            <button id="configureTriggersBtn" class="btn btn-secondary hover-lift">
                                <span class="icon">⚙️</span> Trigger konfigurieren
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Git-Einstellungen -->
                <div class="card interactive">
                    <div class="card-header">
                        <h2 class="card-title">
                            <span class="icon">📝</span> Git-Einstellungen
                        </h2>
                        <span class="badge badge-primary">
                            ${gitSettings.commitMessageLanguage === 'de' ? 'Deutsch' : 'Englisch'}
                        </span>
                    </div>
                    <div class="card-content">
                        <div class="grid grid-cols-2 gap-2 mb-3">
                            <div>
                                <p><strong>Auto-Push:</strong></p>
                                <span class="badge ${gitSettings.autoPush ? 'badge-success' : 'badge-danger'}">
                                    ${gitSettings.autoPush ? 'Ja' : 'Nein'}
                                </span>
                            </div>
                            <div>
                                <p><strong>Branch:</strong></p>
                                <span class="badge tooltip">
                                    ${gitSettings.branch || 'Aktueller Branch'}
                                    <span class="tooltip-text">Aktiv für ${gitSettings.branch || 'aktuellen Branch'}</span>
                                </span>
                            </div>
                            <div>
                                <p><strong>Commit-Stil:</strong></p>
                                <span class="badge">${gitSettings.commitMessageStyle}</span>
                            </div>
                            <div>
                                <p><strong>Staging-Modus:</strong></p>
                                <span class="badge">${ui.getStageModeLabel(gitSettings.stageMode)}</span>
                            </div>
                        </div>
                        <div class="flex justify-center">
                            <button id="openSettingsBtn" class="btn btn-secondary hover-lift">
                                <span class="icon">🔧</span> Alle Einstellungen
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Aktivitätsübersicht -->
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <span class="icon">📊</span> Aktivitätsübersicht
                        </h2>
                    </div>
                    <div class="card-content">
                        <div class="h-40">
                            <canvas id="commitChart"></canvas>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="flex justify-center mt-4 fade-in" style="animation-delay: 0.8s">
                <div class="badge">Comitto v${version}</div>
            </div>
        </div>
        
        <!-- Chart.js (optional) -->
        <script nonce="${nonce}" src="https://cdn.jsdelivr.net/npm/chart.js@3.7.1/dist/chart.min.js"></script>
        
        <!-- Dashboard JavaScript -->
        <script nonce="${nonce}" src="${dashboardJsWebviewUri}"></script>
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
 * Funktion zum Verwalten der Commit-Nachrichtensprache
 * Verbesserte Implementierung mit Anpassung des Prompt-Templates
 * @returns {Promise<void>}
 */
async function handleCommitMessageLanguageCommand() {
    try {
        // Konfiguration abrufen
        const config = vscode.workspace.getConfiguration('comitto');
        const gitSettings = config.get('gitSettings') || {};
        
        // Aktuell eingestellte Sprache abrufen
        const currentLanguage = gitSettings.commitMessageLanguage || 'en';
        
        // Sprachoptionen definieren
        const languageOptions = [
            { label: 'Englisch', value: 'en', description: 'Commit-Nachrichten in englischer Sprache' },
            { label: 'Deutsch', value: 'de', description: 'Commit-Nachrichten in deutscher Sprache' }
        ];
        
        // Sprachauswahl anzeigen
        const selectedLanguage = await vscode.window.showQuickPick(languageOptions, {
            placeHolder: 'Wählen Sie die Sprache für Commit-Nachrichten',
            title: 'Commit-Nachrichtensprache auswählen'
        });
        
        if (selectedLanguage) {
            // Git-Einstellungen aktualisieren
            gitSettings.commitMessageLanguage = selectedLanguage.value;
            await config.update('gitSettings', gitSettings, vscode.ConfigurationTarget.Global);
            
            // Prompt-Template entsprechend anpassen
            let promptTemplate = config.get('promptTemplate');
            
            // Je nach gewählter Sprache den Prompt-Template anpassen
            if (selectedLanguage.value === 'de') {
                // Wenn es bereits ein deutsches Template gibt, nicht ersetzen
                if (!promptTemplate.includes('auf Deutsch')) {
                    promptTemplate = promptTemplate.replace(
                        /Generate a meaningful commit message in English/i,
                        'Generiere eine aussagekräftige Commit-Nachricht auf Deutsch'
                    );
                    promptTemplate = promptTemplate.replace(
                        /using the Conventional Commits format/i,
                        'im Format der Conventional Commits'
                    );
                    promptTemplate = promptTemplate.replace(
                        /Keep it under 80 characters/i,
                        'Halte sie unter 80 Zeichen'
                    );
                    promptTemplate = promptTemplate.replace(
                        /Here is the diff of changes/i,
                        'Hier ist das Diff der Änderungen'
                    );
                }
            } else {
                // Wenn es bereits ein englisches Template gibt, nicht ersetzen
                if (!promptTemplate.includes('in English')) {
                    promptTemplate = promptTemplate.replace(
                        /Generiere eine aussagekräftige Commit-Nachricht auf Deutsch/i,
                        'Generate a meaningful commit message in English'
                    );
                    promptTemplate = promptTemplate.replace(
                        /im Format der Conventional Commits/i,
                        'using the Conventional Commits format'
                    );
                    promptTemplate = promptTemplate.replace(
                        /Halte sie unter 80 Zeichen/i,
                        'Keep it under 80 characters'
                    );
                    promptTemplate = promptTemplate.replace(
                        /Hier ist das Diff der Änderungen/i,
                        'Here is the diff of changes'
                    );
                }
            }
            
            // Aktualisiertes Template speichern
            await config.update('promptTemplate', promptTemplate, vscode.ConfigurationTarget.Global);
            
            vscode.window.showInformationMessage(
                `Commit-Nachrichtensprache auf "${selectedLanguage.label}" gesetzt.`
            );
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Fehler bei der Spracheinstellung: ${error.message}`);
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

/**
 * Umschaltet eine Einstellung in den notifications-Einstellungen
 * @param {string} settingKey Der Schlüssel der Einstellung
 * @param {string} settingName Anzeigename der Einstellung für Benachrichtigungen
 */
async function handleToggleNotificationSettingCommand(settingKey, settingName) {
    try {
        const config = vscode.workspace.getConfiguration('comitto');
        const notifications = config.get('notifications') || {};
        
        // Aktuellen Wert umkehren (true -> false, false -> true)
        const newValue = !(notifications[settingKey]);
        
        // Aktualisierte notifications erstellen
        const updatedNotifications = { ...notifications, [settingKey]: newValue };
        
        // In die Konfiguration schreiben
        await config.update('notifications', updatedNotifications, vscode.ConfigurationTarget.Global);
        
        // Benachrichtigung anzeigen, wenn sie nicht gerade deaktiviert wurde
        if (settingKey !== 'onError' || newValue) {
            vscode.window.showInformationMessage(`${settingName} wurden ${newValue ? 'aktiviert' : 'deaktiviert'}.`);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Fehler beim Umschalten von ${settingName}: ${error.message}`);
    }
}

// #endregion Spezifische Handler

/**
 * Fehlerbehandlungsfunktion für bessere Benutzerfreundlichkeit und Debugging
 * @param {Error} error Der aufgetretene Fehler
 * @param {string} context Kontext, in dem der Fehler aufgetreten ist
 * @param {boolean} showNotification Ob eine Benachrichtigung angezeigt werden soll
 * @returns {string} Benutzerfreundliche Fehlermeldung
 */
function handleError(error, context, showNotification = true) {
    // Originalnachricht für Logging
    const originalMessage = error.message || 'Unbekannter Fehler';
    console.error(`Comitto Fehler [${context}]:`, error);
    
    // Benutzerfreundliche Fehlermeldung extrahieren
    let userMessage = originalMessage;
    
    // Git-spezifische Fehler erkennen und übersetzen
    if (originalMessage.includes('fatal: not a git repository')) {
        userMessage = 'Dieses Verzeichnis ist kein Git-Repository. Bitte initialisieren Sie zuerst ein Git-Repository.';
    } else if (originalMessage.includes('fatal: unable to access')) {
        userMessage = 'Fehler beim Zugriff auf das Remote-Repository. Bitte prüfen Sie Ihre Netzwerkverbindung und Zugangsrechte.';
    } else if (originalMessage.includes('maxBuffer') || originalMessage.includes('zu groß')) {
        userMessage = 'Zu viele oder zu große Änderungen für die automatische Verarbeitung. Es wird versucht, mit einem kleineren Diff fortzufahren.';
    } else if (originalMessage.includes('fatal: could not read')) {
        userMessage = 'Fehler beim Lesen von Git-Objekten. Möglicherweise ist Ihr Repository beschädigt.';
    } else if (originalMessage.includes('Permission denied')) {
        userMessage = 'Zugriff verweigert. Bitte prüfen Sie Ihre Berechtigungen.';
    } else if (originalMessage.includes('Authentication failed')) {
        userMessage = 'Authentifizierung fehlgeschlagen. Bitte prüfen Sie Ihre Git-Credentials.';
    } else if (originalMessage.includes('ENOENT')) {
        userMessage = 'Datei oder Verzeichnis nicht gefunden.';
    } else if (originalMessage.includes('ECONNREFUSED')) {
        userMessage = 'Verbindung verweigert. Der Server ist möglicherweise nicht erreichbar.';
    } else if (originalMessage.includes('ETIMEDOUT')) {
        userMessage = 'Zeitüberschreitung bei der Verbindung. Bitte prüfen Sie Ihre Netzwerkverbindung.';
    }
    
    // Anzeigen, falls gewünscht
    if (showNotification) {
        const config = vscode.workspace.getConfiguration('comitto');
        const notificationSettings = config.get('notifications');
        if (notificationSettings && notificationSettings.onError) {
            vscode.window.showErrorMessage(`${context}: ${userMessage}`);
        }
    }
    
    // Auch als detaillierteren Log ausgeben
    console.warn(`Comitto [${context}] - Benutzerfreundlich: ${userMessage}`);
    
    return userMessage;
}

/**
 * Bereitet die KI-Prompt-Vorlage vor und passt sie an aktuelle Einstellungen an
 * @param {string} gitStatus Die Ausgabe von git status
 * @param {string} diffOutput Die Ausgabe von git diff
 * @returns {string} Die angepasste Prompt-Vorlage
 */
function preparePromptTemplate(gitStatus, diffOutput) {
    const config = vscode.workspace.getConfiguration('comitto');
    const gitSettings = config.get('gitSettings');
    
    // Änderungen in ein lesbares Format bringen
    const changes = gitStatus.split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => {
            const status = line.substring(0, 2).trim();
            const filePath = line.substring(3).trim();
            return `${getStatusText(status)} ${filePath}`;
        })
        .join('\n');
    
    // Prompt-Vorlage mit Änderungen füllen
    let promptTemplate = config.get('promptTemplate');
    promptTemplate = promptTemplate.replace('{changes}', changes);
    
    // Sprache für die Commit-Nachricht einfügen
    const language = gitSettings.commitMessageLanguage || 'en';
    const languageText = language === 'de' ? 'auf Deutsch' : 'in English';
    
    // Sicherstellen, dass die richtige Sprache im Prompt verwendet wird
    if (promptTemplate.includes('auf Deutsch') && language !== 'de') {
        promptTemplate = promptTemplate.replace('auf Deutsch', 'in English');
    } else if (promptTemplate.includes('in English') && language === 'de') {
        promptTemplate = promptTemplate.replace('in English', 'auf Deutsch');
    } else if (!promptTemplate.toLowerCase().includes(languageText.toLowerCase())) {
        promptTemplate += `\nDie Commit-Nachricht soll ${languageText} sein.`;
    }
    
    // Commit-Stil einfügen
    const style = gitSettings.commitMessageStyle || 'conventional';
    if (style === 'conventional' && !promptTemplate.toLowerCase().includes('conventional')) {
        const conventionalText = language === 'de' 
            ? '\nVerwende das Conventional Commits Format (feat, fix, docs, style, etc.).'
            : '\nUse the Conventional Commits format (feat, fix, docs, style, etc.).';
        promptTemplate += conventionalText;
    } else if (style === 'gitmoji' && !promptTemplate.toLowerCase().includes('gitmoji')) {
        const gitmojiText = language === 'de'
            ? '\nVerwende Gitmojis am Anfang der Commit-Nachricht (z.B. 🐛 für Bugfixes, ✨ für neue Features).'
            : '\nUse Gitmojis at the beginning of the commit message (e.g. 🐛 for bugfixes, ✨ for new features).';
        promptTemplate += gitmojiText;
    }
    
    // Zusätzliche Anweisungen für englische Konventionen
    if (language === 'en' && !promptTemplate.toLowerCase().includes('conventional git conventions')) {
        promptTemplate += `
\nFollow these additional rules:
1. Use imperative mood ("Add feature" not "Added feature")
2. Don't capitalize the first word if using conventional commits format
3. No period at the end
4. Keep the message concise and under 72 characters if possible
5. If needed, add more details after a blank line`;
    }
    
    // Diff-Informationen für komplexere Abrechnungen hinzufügen
    if (diffOutput && diffOutput.length > 0) {
        // Eine aggressiv gekürzte Version des Diffs anhängen, um den Kontext zu verbessern,
        // aber nicht zu viel Token zu verwenden
        promptTemplate += `\n\n${processDiffForPrompt(diffOutput)}`;
    }
    
    return promptTemplate;
}

/**
 * Prozessiert den Git-Diff für eine optimale Verwendung im Prompt
 * @param {string} diffOutput Der originale Diff-Output
 * @returns {string} Ein angepasster, gekürzter Diff
 */
function processDiffForPrompt(diffOutput) {
    // Maximale Anzahl der Zeichen des Diffs für den Prompt
    const maxDiffLength = 3000;
    
    // Sehr große Diffs erkennen und Warnung ausgeben
    if (diffOutput.length > 100000) {
        console.warn(`Extrem großer Diff (${diffOutput.length} Zeichen) wird stark gekürzt.`);
    }
    
    // Intelligente Kürzung: Nur die wichtigsten Änderungen
    let shortenedDiff = '';
    
    try {
        // Aufteilen nach Dateiänderungen (beginnen mit 'diff --git')
        const fileChanges = diffOutput.split('diff --git');
        
        // Die ersten Änderungen für jede Datei extrahieren (maximal 8 Dateien)
        const maxFiles = Math.min(8, fileChanges.length);
        const filesToInclude = fileChanges.slice(0, maxFiles);
        
        filesToInclude.forEach((fileChange, index) => {
            if (index === 0 && !fileChange.trim()) return; // Erstes Element kann leer sein
            
            // Dateiinformationen extrahieren
            const fileNameMatch = fileChange.match(/a\/(.+?) b\//);
            const fileName = fileNameMatch ? fileNameMatch[1] : 'unknown-file';
            
            // Jede Dateiänderung auf maximal 500 Zeichen beschränken
            const maxPerFile = 500;
            
            // Nur die relevanten Änderungen erfassen (Zeilen mit + oder - am Anfang)
            const changesOnly = fileChange
                .split('\n')
                .filter(line => line.startsWith('+') || line.startsWith('-'))
                .join('\n')
                .substring(0, maxPerFile);
            
            shortenedDiff += `\n${index > 0 ? 'diff --git' : ''} a/${fileName} b/${fileName}\n${changesOnly}`;
            
            if (changesOnly.length >= maxPerFile) {
                shortenedDiff += '\n...';
            }
        });
        
        // Kürzen, wenn insgesamt zu lang
        if (shortenedDiff.length > maxDiffLength) {
            shortenedDiff = shortenedDiff.substring(0, maxDiffLength);
            shortenedDiff += '\n...';
        }
        
        shortenedDiff += `\n[Diff wurde gekürzt, insgesamt ${diffOutput.length} Zeichen in ${fileChanges.length} Dateien]`;
    } catch (error) {
        console.error('Fehler beim intelligenten Kürzen des Diffs:', error);
        shortenedDiff = diffOutput.substring(0, maxDiffLength) + 
            `\n...\n[Diff wurde einfach gekürzt, insgesamt ${diffOutput.length} Zeichen]`;
    }
    
    // Final cleanup und Optimierung
    return 'Hier ist ein Ausschnitt der konkreten Änderungen:\n' + shortenedDiff;
}

// Ersetze die bestehende generateCommitMessage-Funktion mit dieser verbesserten Version
/**
 * Generiert eine Commit-Nachricht mit dem konfigurierten KI-Modell
 * @param {string} gitStatus Die Ausgabe von git status
 * @param {string} diffOutput Die Ausgabe von git diff
 * @returns {Promise<string>} Generierte Commit-Nachricht
 */
async function generateCommitMessage(gitStatus, diffOutput) {
    try {
        const config = vscode.workspace.getConfiguration('comitto');
        const aiProvider = config.get('aiProvider');
        
        // Generierung des optimierten Prompts
        const prompt = preparePromptTemplate(gitStatus, diffOutput);
        
        // Verschiedene KI-Provider unterstützen
        let commitMessage = '';
        switch (aiProvider) {
            case 'ollama':
                commitMessage = await generateWithOllama(prompt);
                break;
            case 'openai':
                commitMessage = await generateWithOpenAI(prompt);
                break;
            case 'anthropic':
                commitMessage = await generateWithAnthropic(prompt);
                break;
            default:
                throw new Error(`Unbekannter KI-Provider: ${aiProvider}`);
        }
        
        // Nachverarbeitung der Commit-Nachricht
        return processCommitMessage(commitMessage);
    } catch (error) {
        // Fehlerbehandlung
        handleError(error, 'Commit-Nachricht generieren');
        
        // Fallback: Einfache, generische Commit-Nachricht
        const config = vscode.workspace.getConfiguration('comitto');
        const gitSettings = config.get('gitSettings');
        const language = gitSettings.commitMessageLanguage || 'en';
        const style = gitSettings.commitMessageStyle || 'conventional';
        
        // Basierend auf Sprache und Stil einen Fallback erzeugen
        if (language === 'de') {
            return style === 'conventional' ? 
                "chore: Änderungen gespeichert" : 
                "💾 Änderungen gespeichert";
        } else {
            return style === 'conventional' ? 
                "chore: save changes" : 
                "💾 Save changes";
        }
    }
}

/**
 * Nachverarbeitet die generierte Commit-Nachricht gemäß Projektkonventionen
 * @param {string} rawMessage Die rohe, generierte Nachricht
 * @returns {string} Die verarbeitete Nachricht
 */
function processCommitMessage(rawMessage) {
    if (!rawMessage) return "chore: auto commit";
    
    // Leerzeichen und Anführungszeichen entfernen
    let message = rawMessage.trim()
        .replace(/^["']|["']$/g, '')  // Entfernt Anführungszeichen am Anfang und Ende
        .replace(/\n/g, ' ');  // Ersetzt Zeilenumbrüche durch Leerzeichen
    
    // Übliche Probleme korrigieren
    message = message
        // Doppelte Leerzeichen entfernen
        .replace(/\s+/g, ' ')
        // Löscht "Commit-Nachricht:" oder "Commit message:" am Anfang
        .replace(/^(commit[- ]message:?\s*)/i, '')
        // Entfernt Backticks (wenn die KI Code-Formatierung verwendet)
        .replace(/^```|```$/g, '');
    
    // Korrekturen für Conventional Commits Format
    const conventionalMatch = message.match(/^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([\w-]+\))?:\s*(.+)/i);
    if (conventionalMatch) {
        // Stellt sicher, dass der Typ kleingeschrieben ist
        const type = conventionalMatch[1].toLowerCase();
        // Behält den Scope bei, wenn vorhanden
        const scope = conventionalMatch[2] || '';
        // Rest der Nachricht
        const content = conventionalMatch[3];
        // Baut die Nachricht neu zusammen
        message = `${type}${scope}: ${content}`;
    }
    
    // Punkt am Ende entfernen (Konvention)
    message = message.replace(/\.$/, '');
    
    // Längenbegrenzung (72 Zeichen für erste Zeile)
    if (message.length > 72) {
        message = message.substring(0, 69) + '...';
    }
    
    return message;
}

module.exports = {
    registerCommands,
    handleSelectThemeCommand,
    handleStageSelectedCommand,
    handleStageAllCommand,
    handleOpenAIModelSelectionCommand,
    handleCommitMessageLanguageCommand,
    handleConfigureTriggersCommand,
    showSimpleUI,
    generateSimpleUIHTML,
    generateDashboardHTML,
    handleSelectStageModeCommand,
    handleEditStagingPatternsCommand,
    handleToggleGitSettingCommand,
    handleToggleUISettingCommand,
    handleToggleNotificationSettingCommand,
    handleConfigureAIProviderCommand,
    handleEditOpenAIKeyCommand,
    handleSelectAnthropicModelCommand,
    handleEditAnthropicKeyCommand,
    handleEditPromptTemplateCommand
}; 