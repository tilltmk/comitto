const vscode = require('vscode');

/**
 * Registriert die Befehle für die UI-Interaktionen
 * @param {vscode.ExtensionContext} context 
 * @param {Object} providers UI-Provider-Instanzen
 */
function registerCommands(context, providers) {
    // Einstellungen aktualisieren
    context.subscriptions.push(vscode.commands.registerCommand('comitto.refreshSettings', () => {
        providers.statusProvider.refresh();
        providers.settingsProvider.refresh();
        vscode.window.showInformationMessage('Comitto-Einstellungen wurden aktualisiert.');
    }));

    // Einstellungen öffnen
    context.subscriptions.push(vscode.commands.registerCommand('comitto.openSettings', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'comitto');
    }));

    // KI-Provider auswählen
    context.subscriptions.push(vscode.commands.registerCommand('comitto.selectAiProvider', async () => {
        const providers = ['ollama', 'openai', 'anthropic'];
        const displayNames = ['Ollama (lokal)', 'OpenAI', 'Anthropic Claude'];
        
        const selected = await vscode.window.showQuickPick(
            displayNames.map((name, index) => ({ label: name, id: providers[index] })),
            { placeHolder: 'KI-Provider auswählen' }
        );
        
        if (selected) {
            await vscode.workspace.getConfiguration('comitto').update('aiProvider', selected.id, vscode.ConfigurationTarget.Global);
            providers.statusProvider.refresh();
            providers.settingsProvider.refresh();
        }
    }));

    // Ollama-Modell bearbeiten
    context.subscriptions.push(vscode.commands.registerCommand('comitto.editOllamaModel', async () => {
        const currentValue = vscode.workspace.getConfiguration('comitto').get('ollama.model');
        const value = await vscode.window.showInputBox({
            value: currentValue,
            prompt: 'Geben Sie den Namen des Ollama-Modells ein',
            placeHolder: 'z.B. llama3, mistral, ...'
        });
        
        if (value !== undefined) {
            await vscode.workspace.getConfiguration('comitto').update('ollama.model', value, vscode.ConfigurationTarget.Global);
            providers.settingsProvider.refresh();
        }
    }));

    // Ollama-Endpoint bearbeiten
    context.subscriptions.push(vscode.commands.registerCommand('comitto.editOllamaEndpoint', async () => {
        const currentValue = vscode.workspace.getConfiguration('comitto').get('ollama.endpoint');
        const value = await vscode.window.showInputBox({
            value: currentValue,
            prompt: 'Geben Sie den Ollama API-Endpunkt ein',
            placeHolder: 'http://localhost:11434/api/generate'
        });
        
        if (value !== undefined) {
            await vscode.workspace.getConfiguration('comitto').update('ollama.endpoint', value, vscode.ConfigurationTarget.Global);
            providers.settingsProvider.refresh();
        }
    }));

    // OpenAI-Modell auswählen
    context.subscriptions.push(vscode.commands.registerCommand('comitto.selectOpenAIModel', async () => {
        const currentModel = vscode.workspace.getConfiguration('comitto').get('openai.model');
        
        const models = [
            "gpt-3.5-turbo",
            "gpt-3.5-turbo-0125",
            "gpt-3.5-turbo-1106",
            "gpt-4o",
            "gpt-4o-mini",
            "gpt-4",
            "gpt-4-turbo",
            "gpt-4-0125-preview",
            "gpt-4-1106-preview",
            "gpt-4-vision-preview"
        ];
        
        const selectedModel = await vscode.window.showQuickPick(models, {
            placeHolder: currentModel || 'gpt-4o',
            title: 'Wähle ein OpenAI-Modell'
        });
        
        if (selectedModel) {
            await vscode.workspace.getConfiguration('comitto').update('openai.model', selectedModel, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`OpenAI-Modell auf ${selectedModel} gesetzt`);
            refreshUiProviders();
        }
    }));

    // OpenAI-Schlüssel bearbeiten
    context.subscriptions.push(vscode.commands.registerCommand('comitto.editOpenAIKey', async () => {
        const currentValue = vscode.workspace.getConfiguration('comitto').get('openai.apiKey');
        const value = await vscode.window.showInputBox({
            value: currentValue,
            prompt: 'Geben Sie Ihren OpenAI API-Schlüssel ein',
            placeHolder: 'sk-...',
            password: true
        });
        
        if (value !== undefined) {
            await vscode.workspace.getConfiguration('comitto').update('openai.apiKey', value, vscode.ConfigurationTarget.Global);
            providers.settingsProvider.refresh();
        }
    }));

    // Anthropic-Modell auswählen
    context.subscriptions.push(vscode.commands.registerCommand('comitto.selectAnthropicModel', async () => {
        const models = ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229'];
        
        const selected = await vscode.window.showQuickPick(
            models.map(name => ({ label: name })),
            { placeHolder: 'Claude-Modell auswählen' }
        );
        
        if (selected) {
            await vscode.workspace.getConfiguration('comitto').update('anthropic.model', selected.label, vscode.ConfigurationTarget.Global);
            providers.settingsProvider.refresh();
        }
    }));

    // Anthropic-Schlüssel bearbeiten
    context.subscriptions.push(vscode.commands.registerCommand('comitto.editAnthropicKey', async () => {
        const currentValue = vscode.workspace.getConfiguration('comitto').get('anthropic.apiKey');
        const value = await vscode.window.showInputBox({
            value: currentValue,
            prompt: 'Geben Sie Ihren Anthropic API-Schlüssel ein',
            placeHolder: 'sk-ant-...',
            password: true
        });
        
        if (value !== undefined) {
            await vscode.workspace.getConfiguration('comitto').update('anthropic.apiKey', value, vscode.ConfigurationTarget.Global);
            providers.settingsProvider.refresh();
        }
    }));

    // Datei-Anzahl-Schwellwert bearbeiten
    context.subscriptions.push(vscode.commands.registerCommand('comitto.editFileCountThreshold', async () => {
        const currentValue = vscode.workspace.getConfiguration('comitto').get('triggerRules').fileCountThreshold;
        const value = await vscode.window.showInputBox({
            value: currentValue.toString(),
            prompt: 'Geben Sie den Schwellwert für die Anzahl der Dateien ein',
            placeHolder: 'z.B. 3',
            validateInput: text => {
                const num = parseInt(text);
                return isNaN(num) || num < 1 ? 'Bitte geben Sie eine positive Zahl ein' : null;
            }
        });
        
        if (value !== undefined) {
            const rules = vscode.workspace.getConfiguration('comitto').get('triggerRules');
            rules.fileCountThreshold = parseInt(value);
            await vscode.workspace.getConfiguration('comitto').update('triggerRules', rules, vscode.ConfigurationTarget.Global);
            providers.statusProvider.refresh();
            providers.settingsProvider.refresh();
        }
    }));

    // Änderungs-Anzahl bearbeiten
    context.subscriptions.push(vscode.commands.registerCommand('comitto.editMinChangeCount', async () => {
        const currentValue = vscode.workspace.getConfiguration('comitto').get('triggerRules').minChangeCount;
        const value = await vscode.window.showInputBox({
            value: currentValue.toString(),
            prompt: 'Geben Sie die Mindestanzahl an Änderungen ein',
            placeHolder: 'z.B. 10',
            validateInput: text => {
                const num = parseInt(text);
                return isNaN(num) || num < 1 ? 'Bitte geben Sie eine positive Zahl ein' : null;
            }
        });
        
        if (value !== undefined) {
            const rules = vscode.workspace.getConfiguration('comitto').get('triggerRules');
            rules.minChangeCount = parseInt(value);
            await vscode.workspace.getConfiguration('comitto').update('triggerRules', rules, vscode.ConfigurationTarget.Global);
            providers.statusProvider.refresh();
            providers.settingsProvider.refresh();
        }
    }));

    // Zeit-Schwellwert bearbeiten
    context.subscriptions.push(vscode.commands.registerCommand('comitto.editTimeThreshold', async () => {
        const currentValue = vscode.workspace.getConfiguration('comitto').get('triggerRules').timeThresholdMinutes;
        const value = await vscode.window.showInputBox({
            value: currentValue.toString(),
            prompt: 'Geben Sie den Zeit-Schwellwert in Minuten ein',
            placeHolder: 'z.B. 30',
            validateInput: text => {
                const num = parseInt(text);
                return isNaN(num) || num < 1 ? 'Bitte geben Sie eine positive Zahl ein' : null;
            }
        });
        
        if (value !== undefined) {
            const rules = vscode.workspace.getConfiguration('comitto').get('triggerRules');
            rules.timeThresholdMinutes = parseInt(value);
            await vscode.workspace.getConfiguration('comitto').update('triggerRules', rules, vscode.ConfigurationTarget.Global);
            providers.settingsProvider.refresh();
        }
    }));

    // Dateimuster bearbeiten
    context.subscriptions.push(vscode.commands.registerCommand('comitto.editFilePatterns', async () => {
        const currentValue = vscode.workspace.getConfiguration('comitto').get('triggerRules').filePatterns;
        const value = await vscode.window.showInputBox({
            value: currentValue.join(', '),
            prompt: 'Geben Sie Dateimuster ein (durch Komma getrennt)',
            placeHolder: 'z.B. **/*.js, **/*.ts'
        });
        
        if (value !== undefined) {
            const patterns = value.split(',').map(p => p.trim()).filter(p => p.length > 0);
            const rules = vscode.workspace.getConfiguration('comitto').get('triggerRules');
            rules.filePatterns = patterns.length > 0 ? patterns : ['**/*'];
            await vscode.workspace.getConfiguration('comitto').update('triggerRules', rules, vscode.ConfigurationTarget.Global);
            providers.settingsProvider.refresh();
        }
    }));

    // Spezifische Dateien bearbeiten
    context.subscriptions.push(vscode.commands.registerCommand('comitto.editSpecificFiles', async () => {
        const currentValue = vscode.workspace.getConfiguration('comitto').get('triggerRules').specificFiles;
        const value = await vscode.window.showInputBox({
            value: currentValue.join(', '),
            prompt: 'Geben Sie spezifische Dateien ein (durch Komma getrennt)',
            placeHolder: 'z.B. package.json, README.md'
        });
        
        if (value !== undefined) {
            const files = value.split(',').map(f => f.trim()).filter(f => f.length > 0);
            const rules = vscode.workspace.getConfiguration('comitto').get('triggerRules');
            rules.specificFiles = files;
            await vscode.workspace.getConfiguration('comitto').update('triggerRules', rules, vscode.ConfigurationTarget.Global);
            providers.settingsProvider.refresh();
        }
    }));

    // Auto-Push umschalten
    context.subscriptions.push(vscode.commands.registerCommand('comitto.toggleAutoPush', async () => {
        const gitSettings = vscode.workspace.getConfiguration('comitto').get('gitSettings');
        gitSettings.autoPush = !gitSettings.autoPush;
        await vscode.workspace.getConfiguration('comitto').update('gitSettings', gitSettings, vscode.ConfigurationTarget.Global);
        providers.settingsProvider.refresh();
    }));

    // Branch bearbeiten
    context.subscriptions.push(vscode.commands.registerCommand('comitto.editBranch', async () => {
        const currentValue = vscode.workspace.getConfiguration('comitto').get('gitSettings').branch;
        const value = await vscode.window.showInputBox({
            value: currentValue,
            prompt: 'Geben Sie den Branch-Namen ein (leer lassen für aktuellen Branch)',
            placeHolder: 'z.B. main, develop'
        });
        
        if (value !== undefined) {
            const gitSettings = vscode.workspace.getConfiguration('comitto').get('gitSettings');
            gitSettings.branch = value;
            await vscode.workspace.getConfiguration('comitto').update('gitSettings', gitSettings, vscode.ConfigurationTarget.Global);
            providers.settingsProvider.refresh();
        }
    }));

    // Commit-Sprache auswählen
    context.subscriptions.push(vscode.commands.registerCommand('comitto.selectCommitLanguage', async () => {
        const currentLanguage = vscode.workspace.getConfiguration('comitto').get('gitSettings.commitMessageLanguage') || 'en';
        
        const languages = [
            { label: 'Englisch', value: 'en' },
            { label: 'Deutsch', value: 'de' }
        ];
        
        const selectedLanguage = await vscode.window.showQuickPick(languages, {
            placeHolder: `Aktuelle Sprache: ${currentLanguage === 'en' ? 'Englisch' : 'Deutsch'}`,
            title: 'Wähle die Sprache für Commit-Nachrichten'
        });
        
        if (selectedLanguage) {
            const gitSettings = vscode.workspace.getConfiguration('comitto').get('gitSettings');
            const updatedSettings = { ...gitSettings, commitMessageLanguage: selectedLanguage.value };
            
            await vscode.workspace.getConfiguration('comitto').update('gitSettings', updatedSettings, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Commit-Nachrichtensprache auf ${selectedLanguage.label} gesetzt`);
            refreshUiProviders();
        }
    }));

    // Commit-Stil auswählen
    context.subscriptions.push(vscode.commands.registerCommand('comitto.selectCommitStyle', async () => {
        const styles = ['conventional', 'gitmoji'];
        const displayNames = ['Conventional Commits', 'Gitmoji'];
        
        const selected = await vscode.window.showQuickPick(
            displayNames.map((name, index) => ({ label: name, id: styles[index] })),
            { placeHolder: 'Commit-Nachrichtenstil auswählen' }
        );
        
        if (selected) {
            const gitSettings = vscode.workspace.getConfiguration('comitto').get('gitSettings');
            gitSettings.commitMessageStyle = selected.id;
            await vscode.workspace.getConfiguration('comitto').update('gitSettings', gitSettings, vscode.ConfigurationTarget.Global);
            providers.settingsProvider.refresh();
        }
    }));

    // Gitignore-Verwendung umschalten
    context.subscriptions.push(vscode.commands.registerCommand('comitto.toggleUseGitignore', async () => {
        const gitSettings = vscode.workspace.getConfiguration('comitto').get('gitSettings');
        gitSettings.useGitignore = !gitSettings.useGitignore;
        await vscode.workspace.getConfiguration('comitto').update('gitSettings', gitSettings, vscode.ConfigurationTarget.Global);
        providers.settingsProvider.refresh();
    }));

    // Prompt-Vorlage bearbeiten
    context.subscriptions.push(vscode.commands.registerCommand('comitto.editPromptTemplate', async () => {
        const currentValue = vscode.workspace.getConfiguration('comitto').get('promptTemplate');
        
        // Temporäre Datei erstellen und öffnen
        const document = await vscode.workspace.openTextDocument({
            content: currentValue,
            language: 'markdown'
        });
        
        const editor = await vscode.window.showTextDocument(document);
        
        // Listener für Speichern
        const disposable = vscode.workspace.onDidSaveTextDocument(async (doc) => {
            if (doc === document) {
                await vscode.workspace.getConfiguration('comitto').update('promptTemplate', doc.getText(), vscode.ConfigurationTarget.Global);
                providers.settingsProvider.refresh();
                vscode.window.showInformationMessage('Prompt-Vorlage wurde gespeichert.');
                disposable.dispose();
            }
        });
    }));

    // Dashboard anzeigen
    context.subscriptions.push(vscode.commands.registerCommand('comitto.showDashboard', async () => {
        // Erstelle eine temporäre HTML-Datei für das Dashboard
        const dashboardContent = generateDashboardHTML();
        
        const document = await vscode.workspace.openTextDocument({
            content: dashboardContent,
            language: 'html'
        });
        
        // Panel für Webview erstellen
        const panel = vscode.window.createWebviewPanel(
            'comittoDashboard',
            'Comitto Dashboard',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );
        
        // Dashboard-Inhalt setzen
        panel.webview.html = dashboardContent;
        
        // Nachrichtenhandling für Webview
        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'refresh':
                        panel.webview.html = generateDashboardHTML();
                        break;
                    case 'toggleAutoCommit':
                        const isEnabled = vscode.workspace.getConfiguration('comitto').get('autoCommitEnabled');
                        vscode.commands.executeCommand(
                            isEnabled ? 'comitto.disableAutoCommit' : 'comitto.enableAutoCommit'
                        );
                        break;
                    case 'performManualCommit':
                        vscode.commands.executeCommand('comitto.performManualCommit');
                        break;
                }
            }
        );
    }));

    // KI-Provider konfigurieren
    context.subscriptions.push(vscode.commands.registerCommand('comitto.configureAIProvider', async () => {
        const providers = ['ollama', 'openai', 'anthropic'];
        const displayNames = ['Ollama (lokal)', 'OpenAI', 'Anthropic Claude'];
        
        const selected = await vscode.window.showQuickPick(
            displayNames.map((name, index) => ({ label: name, id: providers[index] })),
            { 
                placeHolder: 'KI-Provider auswählen',
                title: 'Comitto - KI-Provider konfigurieren'
            }
        );
        
        if (selected) {
            // Wähle ausschließlich einen Provider aus und deaktiviere die anderen
            await vscode.workspace.getConfiguration('comitto').update('aiProvider', selected.id, vscode.ConfigurationTarget.Global);
            
            // Zeige deutlich an, dass nur ein Provider ausgewählt ist
            vscode.window.showInformationMessage(`KI-Provider wurde auf "${selected.label}" gesetzt. Andere Provider sind deaktiviert.`);
            
            // Provider-spezifische Einstellungen
            switch (selected.id) {
                case 'ollama':
                    const ollamaModel = await vscode.window.showInputBox({
                        value: vscode.workspace.getConfiguration('comitto').get('ollama.model'),
                        prompt: 'Geben Sie den Namen des Ollama-Modells ein',
                        placeHolder: 'z.B. llama3, mistral, ...',
                        title: 'Ollama-Modell'
                    });
                    
                    if (ollamaModel !== undefined) {
                        await vscode.workspace.getConfiguration('comitto').update('ollama.model', ollamaModel, vscode.ConfigurationTarget.Global);
                    }
                    
                    const ollamaEndpoint = await vscode.window.showInputBox({
                        value: vscode.workspace.getConfiguration('comitto').get('ollama.endpoint'),
                        prompt: 'Geben Sie den Ollama API-Endpunkt ein',
                        placeHolder: 'http://localhost:11434/api/generate',
                        title: 'Ollama API-Endpunkt'
                    });
                    
                    if (ollamaEndpoint !== undefined) {
                        await vscode.workspace.getConfiguration('comitto').update('ollama.endpoint', ollamaEndpoint, vscode.ConfigurationTarget.Global);
                    }
                    break;
                    
                case 'openai':
                    await handleOpenAIModelSelectionCommand();
                    break;
                    
                case 'anthropic':
                    const anthropicModel = await vscode.window.showQuickPick(
                        ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229'],
                        { 
                            placeHolder: 'Claude-Modell auswählen',
                            title: 'Claude-Modell konfigurieren'
                        }
                    );
                    
                    if (anthropicModel) {
                        await vscode.workspace.getConfiguration('comitto').update('anthropic.model', anthropicModel, vscode.ConfigurationTarget.Global);
                    }
                    break;
            }
            
            if (providers) {
                providers.statusProvider.refresh();
                providers.quickActionsProvider.refresh();
                providers.settingsProvider.refresh();
            }
        }
    }));

    // Trigger konfigurieren mit grafischer UI
    context.subscriptions.push(vscode.commands.registerCommand('comitto.configureTriggers', async () => {
        // Optionen zum Öffnen des grafischen Konfigurators oder zum schnellen Bearbeiten
        const configOptions = [
            { label: 'Grafischer Trigger-Konfigurator öffnen', id: 'graphical' },
            { label: 'Trigger-Regeln direkt bearbeiten', id: 'direct' }
        ];
        
        const selectedOption = await vscode.window.showQuickPick(configOptions, {
            placeHolder: 'Wie möchten Sie die Trigger konfigurieren?',
            title: 'Comitto - Trigger-Konfigurationsmethode'
        });
        
        if (!selectedOption) return;
        
        if (selectedOption.id === 'graphical') {
            // Grafischen Konfigurator öffnen
            showTriggerConfigWebview(context, providers);
        } else {
            // Direkte Bearbeitung wie bisher
            const rules = vscode.workspace.getConfiguration('comitto').get('triggerRules');
            
            const options = [
                { label: `Datei-Anzahl: ${rules.fileCountThreshold}`, id: 'fileCountThreshold' },
                { label: `Änderungs-Anzahl: ${rules.minChangeCount}`, id: 'minChangeCount' },
                { label: `Zeit-Schwellwert: ${rules.timeThresholdMinutes} Minuten`, id: 'timeThresholdMinutes' },
                { label: 'Dateimuster bearbeiten', id: 'filePatterns' },
                { label: 'Spezifische Dateien bearbeiten', id: 'specificFiles' }
            ];
            
            const selected = await vscode.window.showQuickPick(options, {
                placeHolder: 'Welchen Trigger möchten Sie konfigurieren?',
                title: 'Comitto - Trigger konfigurieren'
            });
            
            if (selected) {
                switch (selected.id) {
                    case 'fileCountThreshold':
                        vscode.commands.executeCommand('comitto.editFileCountThreshold');
                        break;
                    case 'minChangeCount':
                        vscode.commands.executeCommand('comitto.editMinChangeCount');
                        break;
                    case 'timeThresholdMinutes':
                        vscode.commands.executeCommand('comitto.editTimeThreshold');
                        break;
                    case 'filePatterns':
                        vscode.commands.executeCommand('comitto.editFilePatterns');
                        break;
                    case 'specificFiles':
                        vscode.commands.executeCommand('comitto.editSpecificFiles');
                        break;
                }
            }
        }
    }));

    // Einfache Benutzeroberfläche anzeigen
    context.subscriptions.push(vscode.commands.registerCommand('comitto.showSimpleUI', () => {
        showSimpleUI(context, providers);
    }));

    // Sicherstellen, dass der toggleAutoCommit-Befehl korrekt funktioniert
    context.subscriptions.push(vscode.commands.registerCommand('comitto.toggleAutoCommit', async () => {
        const config = vscode.workspace.getConfiguration('comitto');
        const isEnabled = !config.get('autoCommitEnabled');
        
        await config.update('autoCommitEnabled', isEnabled, vscode.ConfigurationTarget.Global);
        
        // Zustandsänderung kommunizieren und UI aktualisieren
        if (isEnabled) {
            vscode.commands.executeCommand('comitto.enableAutoCommit');
        } else {
            vscode.commands.executeCommand('comitto.disableAutoCommit');
        }
        
        // Wenn Benachrichtigungen aktiviert sind, Meldung anzeigen
        if (config.get('uiSettings').showNotifications) {
            vscode.window.showInformationMessage(
                `Automatische Commits sind ${isEnabled ? 'aktiviert' : 'deaktiviert'}.`
            );
        }
    }));

    // UI-Einstellungen umschalten
    context.subscriptions.push(vscode.commands.registerCommand('comitto.toggleSimpleMode', async () => {
        const config = vscode.workspace.getConfiguration('comitto');
        const uiSettings = config.get('uiSettings');
        
        uiSettings.simpleMode = !uiSettings.simpleMode;
        await config.update('uiSettings', uiSettings, vscode.ConfigurationTarget.Global);
        
        if (providers) {
            providers.settingsProvider.refresh();
        }
        
        if (uiSettings.showNotifications) {
            vscode.window.showInformationMessage(
                `Einfacher Modus wurde ${uiSettings.simpleMode ? 'aktiviert' : 'deaktiviert'}.`
            );
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('comitto.toggleConfirmBeforeCommit', async () => {
        const config = vscode.workspace.getConfiguration('comitto');
        const uiSettings = config.get('uiSettings');
        
        uiSettings.confirmBeforeCommit = !uiSettings.confirmBeforeCommit;
        await config.update('uiSettings', uiSettings, vscode.ConfigurationTarget.Global);
        
        if (providers) {
            providers.settingsProvider.refresh();
        }
        
        if (uiSettings.showNotifications) {
            vscode.window.showInformationMessage(
                `Bestätigung vor Commit wurde ${uiSettings.confirmBeforeCommit ? 'aktiviert' : 'deaktiviert'}.`
            );
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('comitto.toggleShowNotifications', async () => {
        const config = vscode.workspace.getConfiguration('comitto');
        const uiSettings = config.get('uiSettings');
        
        uiSettings.showNotifications = !uiSettings.showNotifications;
        await config.update('uiSettings', uiSettings, vscode.ConfigurationTarget.Global);
        
        if (providers) {
            providers.settingsProvider.refresh();
        }
        
        // Immer eine Benachrichtigung zeigen, da der Benutzer sonst nicht weiß, ob die Einstellung geändert wurde
        vscode.window.showInformationMessage(
            `Benachrichtigungen wurden ${uiSettings.showNotifications ? 'aktiviert' : 'deaktiviert'}.`
        );
    }));

    // Behandelt das Kommando zur Auswahl des Staging-Modus
    context.subscriptions.push(vscode.commands.registerCommand('comitto.selectStageMode', async () => {
        await handleSelectStageModeCommand();
    }));

    // Behandelt das Kommando zum Bearbeiten der Staging-Muster
    context.subscriptions.push(vscode.commands.registerCommand('comitto.editStagingPatterns', async () => {
        await handleEditStagingPatternsCommand();
    }));

    // Behandelt das Kommando zum Umschalten des Triggers bei Speichern
    context.subscriptions.push(vscode.commands.registerCommand('comitto.toggleTriggerOnSave', async () => {
        await handleToggleTriggerOnSaveCommand();
    }));

    // Behandelt das Kommando zum Umschalten des Intervall-Triggers
    context.subscriptions.push(vscode.commands.registerCommand('comitto.toggleTriggerOnInterval', async () => {
        await handleToggleTriggerOnIntervalCommand();
    }));

    // Behandelt das Kommando zum Bearbeiten der Intervall-Minuten
    context.subscriptions.push(vscode.commands.registerCommand('comitto.editIntervalMinutes', async () => {
        await handleEditIntervalMinutesCommand();
    }));

    // Behandelt das Kommando zum Umschalten des Triggers bei Branch-Wechsel
    context.subscriptions.push(vscode.commands.registerCommand('comitto.toggleTriggerOnBranchSwitch', async () => {
        await handleToggleTriggerOnBranchSwitchCommand();
    }));

    // Behandelt das Kommando zum Bearbeiten der spezifischen Dateien
    context.subscriptions.push(vscode.commands.registerCommand('comitto.editSpecificFiles', async () => {
        await handleEditSpecificFilesCommand();
    }));

    // Behandelt das Kommando zum Ausführen des "Alle Änderungen stagen"-Befehls
    context.subscriptions.push(vscode.commands.registerCommand('comitto.stageAll', async () => {
        await handleStageAllCommand();
    }));

    // Behandelt das Kommando zum Ausführen des "Ausgewählte Dateien stagen"-Befehls
    context.subscriptions.push(vscode.commands.registerCommand('comitto.stageSelected', async () => {
        await handleStageSelectedCommand();
    }));

    // Behandelt das Kommando zur grafischen Konfiguration der Trigger
    context.subscriptions.push(vscode.commands.registerCommand('comitto.configureTriggers', async () => {
        await handleConfigureTriggersCommand();
    }));

    // Behandelt das Kommando zur Auswahl des Themes
    context.subscriptions.push(vscode.commands.registerCommand('comitto.selectTheme', async () => {
        await handleSelectThemeCommand();
    }));
}

/**
 * Zeigt die einfache Benutzeroberfläche in einem Webview-Panel
 * @param {vscode.ExtensionContext} context Extension-Kontext
 * @param {Object} providers UI-Provider-Instanzen
 */
function showSimpleUI(context, providers) {
    const config = vscode.workspace.getConfiguration('comitto');
    const autoCommitEnabled = config.get('autoCommitEnabled');
    const aiProvider = config.get('aiProvider');
    const providerName = getProviderDisplayName(aiProvider);
    
    // Panel für Webview erstellen
    const panel = vscode.window.createWebviewPanel(
        'comittoSimpleUI',
        'Comitto - Einfache Bedienung',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );
    
    // HTML-Inhalt erstellen
    panel.webview.html = generateSimpleUIHTML(autoCommitEnabled, providerName);
    
    // Nachrichtenhandling für Webview
    panel.webview.onDidReceiveMessage(
        async message => {
            switch (message.command) {
                case 'toggleAutoCommit':
                    await vscode.commands.executeCommand('comitto.toggleAutoCommit');
                    panel.webview.html = generateSimpleUIHTML(
                        vscode.workspace.getConfiguration('comitto').get('autoCommitEnabled'),
                        getProviderDisplayName(vscode.workspace.getConfiguration('comitto').get('aiProvider'))
                    );
                    break;
                
                case 'performManualCommit':
                    await vscode.commands.executeCommand('comitto.performManualCommit');
                    break;
                
                case 'openSettings':
                    await vscode.commands.executeCommand('comitto.openSettings');
                    break;
                
                case 'configureAI':
                    await vscode.commands.executeCommand('comitto.configureAIProvider');
                    panel.webview.html = generateSimpleUIHTML(
                        vscode.workspace.getConfiguration('comitto').get('autoCommitEnabled'),
                        getProviderDisplayName(vscode.workspace.getConfiguration('comitto').get('aiProvider'))
                    );
                    break;
                
                case 'advancedSettings':
                    await vscode.commands.executeCommand('comitto.configureTriggers');
                    break;
            }
        }
    );
}

/**
 * Generiert das HTML für die einfache Benutzeroberfläche
 * @param {boolean} autoCommitEnabled Status der automatischen Commits
 * @param {string} providerName Name des AI-Providers
 * @returns {string} HTML-Inhalt
 */
function generateSimpleUIHTML(autoCommitEnabled, providerName) {
    return `
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Comitto - Einfache Bedienung</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                margin: 0;
                padding: 20px;
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
            }
            .container {
                max-width: 800px;
                margin: 0 auto;
            }
            .header {
                display: flex;
                align-items: center;
                margin-bottom: 30px;
                padding-bottom: 15px;
                border-bottom: 1px solid var(--vscode-panelTitle-activeBorder);
            }
            .logo {
                width: 50px;
                height: 50px;
                margin-right: 15px;
                background-color: var(--vscode-button-background);
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
            }
            h1 {
                margin: 0;
                color: var(--vscode-editor-foreground);
                font-size: 24px;
            }
            .status {
                padding: 20px;
                margin-bottom: 30px;
                border-radius: 10px;
                background-color: ${autoCommitEnabled ? 'var(--vscode-editorGutter-addedBackground)' : 'var(--vscode-editorGutter-deletedBackground)'};
                text-align: center;
                font-size: 18px;
                font-weight: bold;
            }
            .action-buttons {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 15px;
                margin-bottom: 30px;
            }
            button {
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                padding: 15px;
                border-radius: 7px;
                cursor: pointer;
                font-size: 16px;
                font-weight: bold;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                text-align: center;
                transition: background-color 0.2s;
                min-height: 100px;
            }
            button:hover {
                background-color: var(--vscode-button-hoverBackground);
            }
            button .icon {
                font-size: 32px;
                margin-bottom: 10px;
            }
            .info-box {
                background-color: var(--vscode-editor-inactiveSelectionBackground);
                padding: 15px;
                border-radius: 7px;
                margin-bottom: 20px;
            }
            .info-box h2 {
                margin-top: 0;
                margin-bottom: 10px;
                font-size: 16px;
            }
            .info-box p {
                margin: 0;
                font-size: 14px;
            }
            .provider-box {
                display: flex;
                align-items: center;
                justify-content: space-between;
                background-color: var(--vscode-editor-inactiveSelectionBackground);
                padding: 15px;
                border-radius: 7px;
                margin-top: 20px;
            }
            .provider-info {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .settings-button {
                background-color: var(--vscode-button-secondaryBackground);
                color: var(--vscode-button-secondaryForeground);
                padding: 5px 10px;
                border-radius: 4px;
                font-size: 12px;
                cursor: pointer;
                border: none;
            }
            .settings-button:hover {
                background-color: var(--vscode-button-secondaryHoverBackground);
            }
            .footer {
                margin-top: 40px;
                text-align: center;
                font-size: 12px;
                color: var(--vscode-descriptionForeground);
            }
            .advanced-button {
                margin-top: 20px;
                width: 100%;
                background-color: var(--vscode-button-secondaryBackground);
                color: var(--vscode-button-secondaryForeground);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">✓</div>
                <h1>Comitto - Einfache Bedienung</h1>
            </div>
            
            <div class="status">
                Automatische Commits sind ${autoCommitEnabled ? 'AKTIVIERT' : 'DEAKTIVIERT'}
            </div>
            
            <div class="action-buttons">
                <button id="toggleBtn">
                    <span class="icon">${autoCommitEnabled ? '✗' : '✓'}</span>
                    ${autoCommitEnabled ? 'Auto-Commit deaktivieren' : 'Auto-Commit aktivieren'}
                </button>
                <button id="manualCommitBtn">
                    <span class="icon">&#128190;</span>
                    Manuellen Commit ausführen
                </button>
            </div>
            
            <div class="info-box">
                <h2>Was macht Comitto?</h2>
                <p>Comitto erstellt automatisch Commit-Nachrichten für Ihre Änderungen mit Hilfe von KI. Es überwacht Ihren Arbeitsbereich und erstellt Commits basierend auf den Änderungen.</p>
            </div>
            
            <div class="provider-box">
                <div class="provider-info">
                    <span class="icon">&#129302;</span>
                    <div>
                        <h2 style="margin:0;">KI-Provider: ${providerName}</h2>
                    </div>
                </div>
                <button id="configureAIBtn" class="settings-button">Provider ändern</button>
            </div>
            
            <button id="advancedBtn" class="advanced-button">
                <span class="icon">⚙️</span>
                Erweiterte Einstellungen öffnen
            </button>
            
            <div class="footer">
                <p>Comitto v0.4.0 | <a id="settingsLink" href="#">Alle Einstellungen öffnen</a></p>
            </div>
        </div>
        
        <script>
            (function() {
                const vscode = acquireVsCodeApi();
                
                document.getElementById('toggleBtn').addEventListener('click', () => {
                    vscode.postMessage({
                        command: 'toggleAutoCommit'
                    });
                });
                
                document.getElementById('manualCommitBtn').addEventListener('click', () => {
                    vscode.postMessage({
                        command: 'performManualCommit'
                    });
                });
                
                document.getElementById('configureAIBtn').addEventListener('click', () => {
                    vscode.postMessage({
                        command: 'configureAI'
                    });
                });
                
                document.getElementById('advancedBtn').addEventListener('click', () => {
                    vscode.postMessage({
                        command: 'advancedSettings'
                    });
                });
                
                document.getElementById('settingsLink').addEventListener('click', (e) => {
                    e.preventDefault();
                    vscode.postMessage({
                        command: 'openSettings'
                    });
                });
            })();
        </script>
    </body>
    </html>
    `;
}

/**
 * Hilfsfunktion zur Formatierung des Providernamens
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
 * Generiert das HTML für das Dashboard
 * @returns {string} HTML-Inhalt
 */
function generateDashboardHTML() {
    const config = vscode.workspace.getConfiguration('comitto');
    const enabled = config.get('autoCommitEnabled');
    const provider = config.get('aiProvider');
    const rules = config.get('triggerRules');
    const gitSettings = config.get('gitSettings');
    
    // Bestimme Provider-Namen
    let providerName = '';
    switch (provider) {
        case 'ollama': providerName = 'Ollama (lokal)'; break;
        case 'openai': providerName = 'OpenAI'; break;
        case 'anthropic': providerName = 'Anthropic Claude'; break;
        default: providerName = provider;
    }
    
    return `
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Comitto Dashboard</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                margin: 0;
                padding: 20px;
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
            }
            .container {
                max-width: 800px;
                margin: 0 auto;
            }
            .header {
                display: flex;
                align-items: center;
                margin-bottom: 20px;
                border-bottom: 1px solid var(--vscode-panel-border);
                padding-bottom: 10px;
            }
            .logo {
                width: 50px;
                height: 50px;
                margin-right: 15px;
            }
            h1 {
                margin: 0;
                color: var(--vscode-editor-foreground);
            }
            .status {
                padding: 15px;
                border-radius: 5px;
                margin-bottom: 20px;
                background-color: ${enabled ? 'var(--vscode-editorGutter-addedBackground)' : 'var(--vscode-editorGutter-deletedBackground)'};
            }
            .card {
                background-color: var(--vscode-editor-inactiveSelectionBackground);
                padding: 15px;
                margin-bottom: 15px;
                border-radius: 5px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }
            .card h2 {
                margin-top: 0;
                margin-bottom: 10px;
                color: var(--vscode-editor-foreground);
            }
            .card-content {
                display: flex;
                flex-wrap: wrap;
            }
            .card-item {
                flex: 1 0 45%;
                margin-bottom: 10px;
            }
            .card-item strong {
                display: block;
                margin-bottom: 5px;
            }
            .buttons {
                display: flex;
                gap: 10px;
                margin-bottom: 20px;
            }
            button {
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                padding: 8px 16px;
                border-radius: 3px;
                cursor: pointer;
            }
            button:hover {
                background-color: var(--vscode-button-hoverBackground);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <img src="data:image/png;base64,{BASE64_LOGO}" alt="Comitto Logo" class="logo" />
                <h1>Comitto Dashboard</h1>
            </div>
            
            <div class="buttons">
                <button id="commitBtn">Manuellen Commit ausführen</button>
                <button id="toggleBtn">${enabled ? 'Deaktivieren' : 'Aktivieren'}</button>
                <button id="refreshBtn">Aktualisieren</button>
            </div>
            
            <div class="status">
                <strong>Status:</strong> Comitto ist derzeit ${enabled ? 'aktiviert' : 'deaktiviert'}
            </div>
            
            <div class="card">
                <h2>KI-Provider</h2>
                <div class="card-content">
                    <div class="card-item">
                        <strong>Provider:</strong> ${providerName}
                    </div>
                    <div class="card-item">
                        <strong>Modell:</strong> ${config.get(`${provider}.model`)}
                    </div>
                </div>
            </div>
            
            <div class="card">
                <h2>Trigger-Regeln</h2>
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
                        <strong>Dateimuster:</strong> ${rules.filePatterns.join(', ')}
                    </div>
                </div>
            </div>
            
            <div class="card">
                <h2>Git-Einstellungen</h2>
                <div class="card-content">
                    <div class="card-item">
                        <strong>Auto-Push:</strong> ${gitSettings.autoPush ? 'Ja' : 'Nein'}
                    </div>
                    <div class="card-item">
                        <strong>Branch:</strong> ${gitSettings.branch || 'Aktueller Branch'}
                    </div>
                    <div class="card-item">
                        <strong>Nachrichtensprache:</strong> ${gitSettings.commitMessageLanguage}
                    </div>
                    <div class="card-item">
                        <strong>Nachrichtenstil:</strong> ${gitSettings.commitMessageStyle}
                    </div>
                </div>
            </div>
        </div>
        
        <script>
            (function() {
                const vscode = acquireVsCodeApi();
                
                document.getElementById('commitBtn').addEventListener('click', () => {
                    vscode.postMessage({
                        command: 'performManualCommit'
                    });
                });
                
                document.getElementById('toggleBtn').addEventListener('click', () => {
                    vscode.postMessage({
                        command: 'toggleAutoCommit'
                    });
                });
                
                document.getElementById('refreshBtn').addEventListener('click', () => {
                    vscode.postMessage({
                        command: 'refresh'
                    });
                });
            })();
        </script>
    </body>
    </html>
    `;
}

/**
 * Zeigt den grafischen Trigger-Konfigurator als Webview an
 * @param {vscode.ExtensionContext} context Extension-Kontext
 * @param {Object} providers UI-Provider-Instanzen
 */
function showTriggerConfigWebview(context, providers) {
    // Aktuelle Konfiguration abrufen
    const config = vscode.workspace.getConfiguration('comitto');
    const rules = config.get('triggerRules');
    
    // Panel für Webview erstellen
    const panel = vscode.window.createWebviewPanel(
        'comittoTriggerConfig',
        'Comitto Trigger-Konfigurator',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );
    
    // HTML-Inhalt erstellen
    panel.webview.html = `
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Comitto Trigger-Konfigurator</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                margin: 0;
                padding: 20px;
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
            }
            .container {
                max-width: 800px;
                margin: 0 auto;
            }
            .header {
                display: flex;
                align-items: center;
                margin-bottom: 20px;
                border-bottom: 1px solid var(--vscode-panel-border);
                padding-bottom: 10px;
            }
            h1 {
                margin: 0;
                color: var(--vscode-editor-foreground);
            }
            .section {
                background-color: var(--vscode-editor-inactiveSelectionBackground);
                padding: 15px;
                margin-bottom: 15px;
                border-radius: 5px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }
            .section h2 {
                margin-top: 0;
                margin-bottom: 10px;
                color: var(--vscode-editor-foreground);
            }
            .form-group {
                margin-bottom: 15px;
            }
            label {
                display: block;
                margin-bottom: 5px;
                font-weight: bold;
            }
            input, textarea, select {
                width: 100%;
                padding: 8px;
                border-radius: 3px;
                border: 1px solid var(--vscode-input-border);
                background-color: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
            }
            input[type="range"] {
                width: 80%;
            }
            .range-value {
                display: inline-block;
                margin-left: 10px;
                min-width: 30px;
                text-align: center;
            }
            .checkbox-group {
                display: flex;
                align-items: center;
            }
            input[type="checkbox"] {
                width: auto;
                margin-right: 10px;
            }
            .chip-container {
                display: flex;
                flex-wrap: wrap;
                gap: 5px;
                margin-top: 10px;
            }
            .chip {
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                padding: 4px 8px;
                border-radius: 12px;
                display: inline-flex;
                align-items: center;
            }
            .chip button {
                background: none;
                border: none;
                color: var(--vscode-button-foreground);
                margin-left: 5px;
                cursor: pointer;
                font-weight: bold;
            }
            .buttons {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                margin-top: 20px;
            }
            button {
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                padding: 8px 16px;
                border-radius: 3px;
                cursor: pointer;
            }
            button:hover {
                background-color: var(--vscode-button-hoverBackground);
            }
            .add-button {
                margin-top: 5px;
            }
            .tag-input {
                display: flex;
                gap: 5px;
            }
            .tag-input button {
                flex-shrink: 0;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Comitto Trigger-Konfigurator</h1>
            </div>
            
            <div class="section">
                <h2>Schwellenwerte</h2>
                
                <div class="form-group">
                    <label for="fileCountThreshold">Datei-Anzahl Schwellenwert</label>
                    <div style="display: flex; align-items: center;">
                        <input type="range" id="fileCountThreshold" min="1" max="20" value="${rules.fileCountThreshold}" oninput="document.getElementById('fileCountValue').textContent = this.value">
                        <span id="fileCountValue" class="range-value">${rules.fileCountThreshold}</span>
                    </div>
                    <small>Commit auslösen, wenn diese Anzahl an Dateien geändert wurde</small>
                </div>
                
                <div class="form-group">
                    <label for="minChangeCount">Änderungs-Anzahl Schwellenwert</label>
                    <div style="display: flex; align-items: center;">
                        <input type="range" id="minChangeCount" min="1" max="100" value="${rules.minChangeCount}" oninput="document.getElementById('changeCountValue').textContent = this.value">
                        <span id="changeCountValue" class="range-value">${rules.minChangeCount}</span>
                    </div>
                    <small>Commit auslösen, wenn diese Anzahl an Änderungen erreicht wurde</small>
                </div>
                
                <div class="form-group">
                    <label for="timeThresholdMinutes">Zeit-Schwellenwert (Minuten)</label>
                    <div style="display: flex; align-items: center;">
                        <input type="range" id="timeThresholdMinutes" min="1" max="120" value="${rules.timeThresholdMinutes}" oninput="document.getElementById('timeValue').textContent = this.value">
                        <span id="timeValue" class="range-value">${rules.timeThresholdMinutes}</span>
                    </div>
                    <small>Commit auslösen, wenn seit dem letzten Commit diese Zeit vergangen ist</small>
                </div>
            </div>
            
            <div class="section">
                <h2>Dateimuster</h2>
                <div class="form-group">
                    <label for="filePattern">Dateimuster hinzufügen</label>
                    <div class="tag-input">
                        <input type="text" id="filePattern" placeholder="z.B. **/*.js, **/*.ts">
                        <button onclick="addFilePattern()">Hinzufügen</button>
                    </div>
                    <small>Glob-Muster für Dateien, die überwacht werden sollen (z.B. **/*.js für alle JavaScript-Dateien)</small>
                    
                    <div class="chip-container" id="filePatterns">
                        ${rules.filePatterns.map(pattern => `
                            <div class="chip" data-value="${pattern}">
                                ${pattern}
                                <button onclick="removeFilePattern('${pattern}')">×</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            
            <div class="section">
                <h2>Spezifische Dateien</h2>
                <div class="form-group">
                    <label for="specificFile">Spezifische Datei hinzufügen</label>
                    <div class="tag-input">
                        <input type="text" id="specificFile" placeholder="z.B. package.json, README.md">
                        <button onclick="addSpecificFile()">Hinzufügen</button>
                    </div>
                    <small>Spezifische Dateien, die immer überwacht werden sollen (z.B. package.json)</small>
                    
                    <div class="chip-container" id="specificFiles">
                        ${rules.specificFiles.map(file => `
                            <div class="chip" data-value="${file}">
                                ${file}
                                <button onclick="removeSpecificFile('${file}')">×</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            
            <div class="buttons">
                <button onclick="saveConfig()">Speichern</button>
                <button onclick="resetConfig()">Zurücksetzen</button>
            </div>
        </div>
        
        <script>
            (function() {
                const vscode = acquireVsCodeApi();
                
                // Speicherkopie der aktuellen Konfiguration
                let currentConfig = ${JSON.stringify(rules)};
                
                // Methode zum Speichern der Konfiguration
                window.saveConfig = function() {
                    // Alle Schwellenwerte abrufen
                    const fileCountThreshold = parseInt(document.getElementById('fileCountThreshold').value);
                    const minChangeCount = parseInt(document.getElementById('minChangeCount').value);
                    const timeThresholdMinutes = parseInt(document.getElementById('timeThresholdMinutes').value);
                    
                    // Alle Dateimuster sammeln
                    const filePatterns = [];
                    document.querySelectorAll('#filePatterns .chip').forEach(chip => {
                        filePatterns.push(chip.dataset.value);
                    });
                    
                    // Alle spezifischen Dateien sammeln
                    const specificFiles = [];
                    document.querySelectorAll('#specificFiles .chip').forEach(chip => {
                        specificFiles.push(chip.dataset.value);
                    });
                    
                    // Konfiguration an die Erweiterung senden
                    vscode.postMessage({
                        command: 'saveConfig',
                        config: {
                            fileCountThreshold,
                            minChangeCount,
                            timeThresholdMinutes,
                            filePatterns: filePatterns.length > 0 ? filePatterns : ['**/*'],
                            specificFiles
                        }
                    });
                };
                
                // Methode zum Zurücksetzen der Konfiguration
                window.resetConfig = function() {
                    vscode.postMessage({
                        command: 'resetConfig'
                    });
                };
                
                // Methode zum Hinzufügen eines Dateimusters
                window.addFilePattern = function() {
                    const input = document.getElementById('filePattern');
                    const value = input.value.trim();
                    
                    if (value) {
                        // Prüfen, ob das Muster bereits existiert
                        const exists = Array.from(document.querySelectorAll('#filePatterns .chip')).some(chip => 
                            chip.dataset.value === value
                        );
                        
                        if (!exists) {
                            const container = document.getElementById('filePatterns');
                            const chipDiv = document.createElement('div');
                            chipDiv.className = 'chip';
                            chipDiv.dataset.value = value;
                            chipDiv.innerHTML = value + '<button onclick="removeFilePattern(\'' + value + '\')">×</button>';
                            container.appendChild(chipDiv);
                            input.value = '';
                        }
                    }
                };
                
                // Methode zum Entfernen eines Dateimusters
                window.removeFilePattern = function(value) {
                    document.querySelectorAll('#filePatterns .chip').forEach(chip => {
                        if (chip.dataset.value === value) {
                            chip.remove();
                        }
                    });
                };
                
                // Methode zum Hinzufügen einer spezifischen Datei
                window.addSpecificFile = function() {
                    const input = document.getElementById('specificFile');
                    const value = input.value.trim();
                    
                    if (value) {
                        // Prüfen, ob die Datei bereits existiert
                        const exists = Array.from(document.querySelectorAll('#specificFiles .chip')).some(chip => 
                            chip.dataset.value === value
                        );
                        
                        if (!exists) {
                            const container = document.getElementById('specificFiles');
                            const chipDiv = document.createElement('div');
                            chipDiv.className = 'chip';
                            chipDiv.dataset.value = value;
                            chipDiv.innerHTML = value + '<button onclick="removeSpecificFile(\'' + value + '\')">×</button>';
                            container.appendChild(chipDiv);
                            input.value = '';
                        }
                    }
                };
                
                // Methode zum Entfernen einer spezifischen Datei
                window.removeSpecificFile = function(value) {
                    document.querySelectorAll('#specificFiles .chip').forEach(chip => {
                        if (chip.dataset.value === value) {
                            chip.remove();
                        }
                    });
                };
            })();
        </script>
    </body>
    </html>
    `;
    
    // Nachrichtenhandling für Webview
    panel.webview.onDidReceiveMessage(
        async message => {
            switch (message.command) {
                case 'saveConfig':
                    // Konfiguration speichern
                    await vscode.workspace.getConfiguration('comitto').update('triggerRules', message.config, vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage('Trigger-Konfiguration wurde gespeichert.');
                    
                    // UI aktualisieren
                    if (providers) {
                        providers.statusProvider.refresh();
                        providers.settingsProvider.refresh();
                    }
                    
                    panel.dispose();
                    break;
                    
                case 'resetConfig':
                    // Standardwerte wiederherstellen
                    const defaultConfig = {
                        fileCountThreshold: 3,
                        minChangeCount: 10,
                        timeThresholdMinutes: 30,
                        filePatterns: ['**/*'],
                        specificFiles: []
                    };
                    
                    await vscode.workspace.getConfiguration('comitto').update('triggerRules', defaultConfig, vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage('Trigger-Konfiguration wurde zurückgesetzt.');
                    
                    // UI aktualisieren
                    if (providers) {
                        providers.statusProvider.refresh();
                        providers.settingsProvider.refresh();
                    }
                    
                    panel.dispose();
                    break;
            }
        }
    );
}

/**
 * Konfiguriert den KI-Provider für die Commit-Nachrichtengenerierung
 * @param {vscode.ExtensionContext} context
 */
async function configureAIProvider(context) {
    const providerOptions = ['ollama', 'openai', 'anthropic'];
    const currentProvider = vscode.workspace.getConfiguration('comitto').get('aiProvider');
    
    const selectedProvider = await vscode.window.showQuickPick(providerOptions, {
        placeHolder: 'KI-Provider auswählen',
        title: 'KI-Provider für Commit-Nachrichtengenerierung konfigurieren'
    });
    
    if (!selectedProvider) return;
    
    await vscode.workspace.getConfiguration('comitto').update('aiProvider', selectedProvider, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(`KI-Provider auf ${selectedProvider} umgestellt`);
    
    // Konfiguriere den ausgewählten Provider
    switch (selectedProvider) {
        case 'ollama':
            await configureOllamaSettings();
            break;
        case 'openai':
            await handleOpenAIModelSelectionCommand();
            break;
        case 'anthropic':
            const anthropicModel = await vscode.window.showQuickPick(
                ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229'],
                { 
                    placeHolder: 'Claude-Modell auswählen',
                    title: 'Claude-Modell konfigurieren'
                }
            );
            
            if (anthropicModel) {
                await vscode.workspace.getConfiguration('comitto').update('anthropic.model', anthropicModel, vscode.ConfigurationTarget.Global);
            }
            break;
    }
    
    refreshSettings(context);
}

/**
 * Konfiguriert die Ollama-Einstellungen
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
                return null; // Kein Fehler
            }
        });
        
        if (endpoint) {
            await config.update('ollama.endpoint', endpoint, vscode.ConfigurationTarget.Global);
            
            // Versuche, die Verbindung zu Ollama zu testen
            try {
                vscode.window.showInformationMessage('Teste Verbindung zu Ollama...');
                
                const axios = require('axios');
                await axios.get(endpoint.replace('/api/generate', '/api/tags'), { timeout: 5000 });
                
                vscode.window.showInformationMessage('Verbindung zu Ollama erfolgreich hergestellt!');
            } catch (error) {
                vscode.window.showWarningMessage(
                    `Warnung: Konnte keine Verbindung zu Ollama herstellen (${error.message}). ` +
                    'Bitte stellen Sie sicher, dass Ollama läuft und der Endpunkt korrekt ist.'
                );
            }
        }
        
        // Konfiguration des Modells
        const popularModels = [
            'llama3', 
            'mistral', 
            'mixtral', 
            'phi', 
            'gemma', 
            'codellama', 
            'orca-mini'
        ];
        
        // Lade verfügbare Modelle von Ollama
        let availableModels = [];
        try {
            if (endpoint) {
                const axios = require('axios');
                const response = await axios.get(endpoint.replace('/api/generate', '/api/tags'), { timeout: 5000 });
                if (response.data && response.data.models) {
                    availableModels = response.data.models.map(model => model.name);
                }
            }
        } catch (error) {
            console.error('Fehler beim Abrufen der Ollama-Modelle:', error);
            // Weiter mit populären Modellen als Fallback
        }
        
        // Kombiniere populäre und verfügbare Modelle ohne Duplikate
        const allModels = [...new Set([...popularModels, ...availableModels])];
        
        // Zeige QuickPick für Modell-Auswahl an
        const selectedModel = await vscode.window.showQuickPick(
            allModels.map(model => ({
                label: model,
                description: availableModels.includes(model) ? '(Verfügbar)' : '',
                detail: model === currentModel ? '(Aktuell ausgewählt)' : ''
            })),
            {
                placeHolder: 'Wählen Sie ein Ollama-Modell',
                ignoreFocusOut: true
            }
        );
        
        if (selectedModel) {
            await config.update('ollama.model', selectedModel.label, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Ollama-Modell auf "${selectedModel.label}" gesetzt.`);
        }
        
        return true;
    } catch (error) {
        vscode.window.showErrorMessage(`Fehler bei der Konfiguration von Ollama: ${error.message}`);
        console.error('Fehler bei der Konfiguration von Ollama:', error);
        return false;
    }
}

/**
 * Konfiguriert die OpenAI-Einstellungen
 */
async function handleOpenAIModelSelectionCommand() {
    try {
        const config = vscode.workspace.getConfiguration('comitto');
        const aiSettings = config.get('aiSettings') || {};
        const openAISettings = aiSettings.openai || {};
        const currentModel = openAISettings.model || 'gpt-3.5-turbo';
        
        const models = [
            { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
            { label: 'GPT-3.5 Turbo 16K', value: 'gpt-3.5-turbo-16k' },
            { label: 'GPT-4', value: 'gpt-4' },
            { label: 'GPT-4 Turbo', value: 'gpt-4-turbo-preview' },
            { label: 'GPT-4o', value: 'gpt-4o' }
        ];
        
        const selectedModel = await vscode.window.showQuickPick(
            models.map(model => ({
                label: model.label,
                value: model.value,
                description: currentModel === model.value ? '(Aktuell)' : ''
            })),
            {
                placeHolder: 'OpenAI-Modell wählen',
                canPickMany: false,
                ignoreFocusOut: true
            }
        );
        
        if (selectedModel) {
            // Aktualisiere die Konfiguration mit dem ausgewählten Modell
            const updatedOpenAISettings = { ...openAISettings, model: selectedModel.value };
            const updatedAISettings = { ...aiSettings, openai: updatedOpenAISettings };
            
            await config.update('aiSettings', updatedAISettings, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`OpenAI-Modell auf ${selectedModel.label} geändert.`);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Fehler bei der Modellauswahl: ${error.message}`);
        console.error('Fehler bei der Modellauswahl:', error);
    }
}

/**
 * Konfiguriert die Anthropic-Einstellungen
 */
async function configureAnthropicSettings() {
    const apiKey = await vscode.window.showInputBox({
        password: true,
        placeHolder: 'sk-ant-...',
        prompt: 'Anthropic API-Schlüssel',
        value: vscode.workspace.getConfiguration('comitto').get('anthropic.apiKey')
    });
    
    if (apiKey !== undefined) {
        await vscode.workspace.getConfiguration('comitto').update('anthropic.apiKey', apiKey, vscode.ConfigurationTarget.Global);
    }
    
    const modelOptions = [
        'claude-3-haiku-20240307',
        'claude-3-sonnet-20240229',
        'claude-3-opus-20240229',
        'claude-2.1',
        'claude-2.0',
        'claude-instant-1.2'
    ];
    
    const currentModel = vscode.workspace.getConfiguration('comitto').get('anthropic.model');
    const selectedModel = await vscode.window.showQuickPick(modelOptions, {
        placeHolder: currentModel,
        title: 'Anthropic Claude-Modell auswählen'
    });
    
    if (selectedModel) {
        await vscode.workspace.getConfiguration('comitto').update('anthropic.model', selectedModel, vscode.ConfigurationTarget.Global);
    }
}

/**
 * Generiert eine Commit-Nachricht mit dem konfigurierten KI-Provider
 * @param {string} changes Die Änderungen, für die eine Commit-Nachricht generiert werden soll
 * @returns {Promise<string>} Die generierte Commit-Nachricht
 */
async function generateCommitMessage(changes) {
    const config = vscode.workspace.getConfiguration('comitto');
    const provider = config.get('aiProvider');
    
    // Stelle sicher, dass die Commit-Nachrichten immer auf Englisch generiert werden
    const gitSettings = config.get('gitSettings');
    gitSettings.commitMessageLanguage = 'en';
    await config.update('gitSettings', gitSettings, vscode.ConfigurationTarget.Global);
    
    // Hole den Prompt-Template und ersetze den Platzhalter für die Änderungen
    let promptTemplate = config.get('promptTemplate');
    
    // Setze einen englischen Prompt, wenn kein benutzerdefinierter gesetzt ist
    if (!promptTemplate || promptTemplate.includes('Generiere eine aussagekräftige Commit-Nachricht')) {
        promptTemplate = "Generate a meaningful commit message for the following changes: \n\n{changes}\n\nUse the Conventional Commits format (feat, fix, docs, etc.) and keep the message under 80 characters. Always write the commit message in English.";
        await config.update('promptTemplate', promptTemplate, vscode.ConfigurationTarget.Global);
    }
    
    // Füge die Anweisung auf Englisch zu schreiben hinzu, falls nicht vorhanden
    if (!promptTemplate.toLowerCase().includes('english')) {
        promptTemplate += " Always write the commit message in English.";
        await config.update('promptTemplate', promptTemplate, vscode.ConfigurationTarget.Global);
    }
    
    const prompt = promptTemplate.replace('{changes}', changes);

    try {
        switch (provider) {
            case 'ollama':
                return await generateWithOllama(prompt);
            case 'openai':
                return await generateWithOpenAI(prompt);
            case 'anthropic':
                return await generateWithAnthropic(prompt);
            default:
                throw new Error(`Unbekannter KI-Provider: ${provider}`);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Fehler bei der Generierung der Commit-Nachricht: ${error.message}`);
        return "";
    }
}

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
            
            // Anpassen des Prompts basierend auf der ausgewählten Sprache
            if (selectedLanguage.value === 'en') {
                promptTemplate = promptTemplate.replace(
                    /in (German|Deutsch|Englisch)/i,
                    'in English'
                );
                
                if (!promptTemplate.includes('in English')) {
                    // Standardtext für englische Prompts hinzufügen
                    promptTemplate = "Generate a meaningful commit message in English for the following changes:\n\n{changes}\n\nUse the Conventional Commits format (feat, fix, docs, etc.) and keep the message under 80 characters.";
                }
            } else if (selectedLanguage.value === 'de') {
                promptTemplate = promptTemplate.replace(
                    /in (English|Englisch|German)/i,
                    'in German'
                );
                
                if (!promptTemplate.includes('in German')) {
                    // Standardtext für deutsche Prompts hinzufügen
                    promptTemplate = "Generate a meaningful commit message in German for the following changes:\n\n{changes}\n\nUse the Conventional Commits format (feat, fix, docs, etc.) and keep the message under 80 characters.";
                }
            }
            
            await config.update('promptTemplate', promptTemplate, vscode.ConfigurationTarget.Global);
            
            vscode.window.showInformationMessage(`Sprache für Commit-Nachrichten auf ${selectedLanguage.label} geändert.`);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Fehler bei der Sprachauswahl: ${error.message}`);
        console.error('Fehler bei der Sprachauswahl:', error);
    }
}

/**
 * Behandelt das Kommando zur Auswahl des Staging-Modus
 * @returns {Promise<void>} Promise, der nach der Ausführung erfüllt wird
 */
async function handleSelectStageModeCommand() {
    const config = vscode.workspace.getConfiguration('comitto');
    const gitSettings = config.get('gitSettings');
    const currentMode = gitSettings.stageMode || 'all';

    const ui = require('./ui');
    const modes = [
        { label: 'Alle Dateien', value: 'all', detail: 'Alle Änderungen automatisch stagen' },
        { label: 'Spezifische Dateien', value: 'specific', detail: 'Nur Dateien stagen, die bestimmten Mustern entsprechen' },
        { label: 'Nachfragen', value: 'prompt', detail: 'Vor jedem Commit nach zu stagenden Dateien fragen' }
    ];

    const selected = await vscode.window.showQuickPick(modes, {
        placeHolder: 'Staging-Modus auswählen',
        ignoreFocusOut: true
    });

    if (selected) {
        gitSettings.stageMode = selected.value;
        await config.update('gitSettings', gitSettings, vscode.ConfigurationTarget.Global);
        
        // Wenn "Spezifische Dateien" ausgewählt wurde, nach den Mustern fragen
        if (selected.value === 'specific' && (!gitSettings.specificStagingPatterns || gitSettings.specificStagingPatterns.length === 0)) {
            await handleEditStagingPatternsCommand();
        }
        
        vscode.window.showInformationMessage(`Staging-Modus auf "${ui.getStageModeLabel(selected.value)}" gesetzt.`);
    }
}

/**
 * Behandelt das Kommando zum Bearbeiten der Staging-Muster
 * @returns {Promise<void>} Promise, der nach der Ausführung erfüllt wird
 */
async function handleEditStagingPatternsCommand() {
    const config = vscode.workspace.getConfiguration('comitto');
    const gitSettings = config.get('gitSettings');
    const currentPatterns = gitSettings.specificStagingPatterns || ['*.js', '*.ts', '*.jsx', '*.tsx'];

    const input = await vscode.window.showInputBox({
        placeHolder: 'Kommagetrennte Liste von Glob-Mustern (z.B. *.js,*.json,src/**/*)',
        value: currentPatterns.join(','),
        prompt: 'Geben Sie die Dateimuster ein, die automatisch gestaged werden sollen'
    });

    if (input !== undefined) {
        const patterns = input.split(',').map(p => p.trim()).filter(p => p);
        gitSettings.specificStagingPatterns = patterns;
        await config.update('gitSettings', gitSettings, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Staging-Muster aktualisiert: ${patterns.join(', ')}`);
    }
}

/**
 * Behandelt das Kommando zum Umschalten des Triggers bei Speichern
 * @returns {Promise<void>} Promise, der nach der Ausführung erfüllt wird
 */
async function handleToggleTriggerOnSaveCommand() {
    const config = vscode.workspace.getConfiguration('comitto');
    const rules = config.get('triggerRules');
    rules.onSave = !rules.onSave;
    
    await config.update('triggerRules', rules, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(`Trigger bei Speichern ${rules.onSave ? 'aktiviert' : 'deaktiviert'}.`);
}

/**
 * Behandelt das Kommando zum Umschalten des Intervall-Triggers
 * @returns {Promise<void>} Promise, der nach der Ausführung erfüllt wird
 */
async function handleToggleTriggerOnIntervalCommand() {
    const config = vscode.workspace.getConfiguration('comitto');
    const rules = config.get('triggerRules');
    rules.onInterval = !rules.onInterval;
    
    await config.update('triggerRules', rules, vscode.ConfigurationTarget.Global);
    
    if (rules.onInterval && (!rules.intervalMinutes || rules.intervalMinutes <= 0)) {
        await handleEditIntervalMinutesCommand();
    } else {
        vscode.window.showInformationMessage(`Intervall-Trigger ${rules.onInterval ? 'aktiviert' : 'deaktiviert'}.`);
    }
}

/**
 * Behandelt das Kommando zum Bearbeiten der Intervall-Minuten
 * @returns {Promise<void>} Promise, der nach der Ausführung erfüllt wird
 */
async function handleEditIntervalMinutesCommand() {
    const config = vscode.workspace.getConfiguration('comitto');
    const rules = config.get('triggerRules');
    const currentValue = rules.intervalMinutes || 15;

    const input = await vscode.window.showInputBox({
        placeHolder: 'Intervall in Minuten (z.B. 15)',
        value: currentValue.toString(),
        prompt: 'Geben Sie das Intervall für automatische Commits in Minuten ein',
        validateInput: value => {
            const num = parseInt(value);
            return (isNaN(num) || num <= 0) ? 'Bitte geben Sie eine positive Zahl ein' : null;
        }
    });

    if (input !== undefined) {
        const minutes = parseInt(input);
        if (!isNaN(minutes) && minutes > 0) {
            rules.intervalMinutes = minutes;
            await config.update('triggerRules', rules, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Intervall-Minuten auf ${minutes} gesetzt.`);
        }
    }
}

/**
 * Behandelt das Kommando zum Umschalten des Triggers bei Branch-Wechsel
 * @returns {Promise<void>} Promise, der nach der Ausführung erfüllt wird
 */
async function handleToggleTriggerOnBranchSwitchCommand() {
    const config = vscode.workspace.getConfiguration('comitto');
    const rules = config.get('triggerRules');
    rules.onBranchSwitch = !rules.onBranchSwitch;
    
    await config.update('triggerRules', rules, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(`Trigger bei Branch-Wechsel ${rules.onBranchSwitch ? 'aktiviert' : 'deaktiviert'}.`);
}

/**
 * Behandelt das Kommando zum Bearbeiten der spezifischen Dateien
 * @returns {Promise<void>} Promise, der nach der Ausführung erfüllt wird
 */
async function handleEditSpecificFilesCommand() {
    const config = vscode.workspace.getConfiguration('comitto');
    const rules = config.get('triggerRules');
    const currentFiles = rules.specificFiles || [];

    const input = await vscode.window.showInputBox({
        placeHolder: 'Kommagetrennte Liste von Dateipfaden (z.B. package.json,README.md)',
        value: currentFiles.join(','),
        prompt: 'Geben Sie die spezifischen Dateien ein, die überwacht werden sollen'
    });

    if (input !== undefined) {
        const files = input.split(',').map(f => f.trim()).filter(f => f);
        rules.specificFiles = files;
        await config.update('triggerRules', rules, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Spezifische Dateien aktualisiert: ${files.join(', ')}`);
    }
}

/**
 * Behandelt das Kommando zum Ausführen des "Alle Änderungen stagen"-Befehls
 * @returns {Promise<void>} Promise, der nach der Ausführung erfüllt wird
 */
async function handleStageAllCommand() {
    try {
        const workspaceFolder = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('Kein Workspace geöffnet.');
            return;
        }
        
        const result = await executeGitCommand('add -A', workspaceFolder.uri.fsPath);
        vscode.window.showInformationMessage('Alle Änderungen wurden gestaged.');
        return result;
    } catch (error) {
        vscode.window.showErrorMessage(`Fehler beim Stagen aller Änderungen: ${error.message}`);
    }
}

/**
 * Behandelt das Kommando zum Ausführen des "Ausgewählte Dateien stagen"-Befehls
 * @returns {Promise<void>} Promise, der nach der Ausführung erfüllt wird
 */
async function handleStageSelectedCommand() {
    try {
        const workspaceFolder = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('Kein Workspace geöffnet.');
            return;
        }
        
        // Git-Status abrufen
        const statusOutput = await executeGitCommand('status --porcelain', workspaceFolder.uri.fsPath);
        
        if (!statusOutput) {
            vscode.window.showInformationMessage('Keine Änderungen zum Stagen gefunden.');
            return;
        }
        
        // Geänderte Dateien parsen
        const changedFiles = statusOutput
            .split('\n')
            .filter(line => line.trim() !== '')
            .map(line => {
                const status = line.substring(0, 2);
                const filePath = line.substring(3);
                return { 
                    status, 
                    filePath,
                    label: `${getStatusLabel(status)} ${filePath}`,
                    picked: !status.includes('?') // Vorauswahl aller Dateien außer untracked
                };
            });
        
        if (changedFiles.length === 0) {
            vscode.window.showInformationMessage('Keine Änderungen zum Stagen gefunden.');
            return;
        }
        
        // Dateien zur Auswahl anbieten
        const selectedFiles = await vscode.window.showQuickPick(changedFiles, {
            placeHolder: 'Wählen Sie die zu stagenden Dateien aus',
            canPickMany: true
        });
        
        if (!selectedFiles || selectedFiles.length === 0) {
            return;
        }
        
        // Ausgewählte Dateien stagen
        for (const file of selectedFiles) {
            await executeGitCommand(`add "${file.filePath}"`, workspaceFolder.uri.fsPath);
        }
        
        vscode.window.showInformationMessage(`${selectedFiles.length} Datei(en) wurden gestaged.`);
    } catch (error) {
        vscode.window.showErrorMessage(`Fehler beim Stagen ausgewählter Dateien: ${error.message}`);
    }
}

/**
 * Gibt ein lesbares Label für den Git-Status zurück
 * @param {string} status Git-Status-Code
 * @returns {string} Lesbares Label
 */
function getStatusLabel(status) {
    if (status.includes('M')) return '[Geändert]';
    if (status.includes('A')) return '[Hinzugefügt]';
    if (status.includes('D')) return '[Gelöscht]';
    if (status.includes('R')) return '[Umbenannt]';
    if (status.includes('C')) return '[Kopiert]';
    if (status.includes('?')) return '[Untracked]';
    if (status.includes('U')) return '[Konflikt]';
    return '[Geändert]';
}

/**
 * Behandelt das Kommando zur grafischen Konfiguration der Trigger
 * @returns {Promise<void>} Promise, der nach der Ausführung erfüllt wird
 */
async function handleConfigureTriggersCommand() {
    const config = vscode.workspace.getConfiguration('comitto');
    const rules = config.get('triggerRules');
    
    const options = [
        { label: `Datei-Anzahl: ${rules.fileCountThreshold}`, id: 'fileCount' },
        { label: `Änderungs-Anzahl: ${rules.minChangeCount}`, id: 'changeCount' },
        { label: `Zeit-Schwellwert: ${rules.timeThresholdMinutes} Minuten`, id: 'timeThreshold' },
        { label: `Bei Speichern: ${rules.onSave ? 'Ja' : 'Nein'}`, id: 'onSave', picked: rules.onSave },
        { label: `Intervall-Trigger: ${rules.onInterval ? `Alle ${rules.intervalMinutes} Min.` : 'Deaktiviert'}`, id: 'onInterval', picked: rules.onInterval },
        { label: `Bei Branch-Wechsel: ${rules.onBranchSwitch ? 'Ja' : 'Nein'}`, id: 'onBranchSwitch', picked: rules.onBranchSwitch },
        { label: `Dateimuster bearbeiten`, id: 'filePatterns' },
        { label: `Spezifische Dateien bearbeiten`, id: 'specificFiles' }
    ];
    
    const selected = await vscode.window.showQuickPick(options, {
        placeHolder: 'Trigger-Einstellung auswählen',
        ignoreFocusOut: true
    });
    
    if (!selected) {
        return;
    }
    
    switch (selected.id) {
        case 'fileCount':
            await handleEditFileCountThresholdCommand();
            break;
        case 'changeCount':
            await handleEditMinChangeCountCommand();
            break;
        case 'timeThreshold':
            await handleEditTimeThresholdCommand();
            break;
        case 'onSave':
            await handleToggleTriggerOnSaveCommand();
            break;
        case 'onInterval':
            await handleToggleTriggerOnIntervalCommand();
            break;
        case 'onBranchSwitch':
            await handleToggleTriggerOnBranchSwitchCommand();
            break;
        case 'filePatterns':
            await handleEditFilePatternsCommand();
            break;
        case 'specificFiles':
            await handleEditSpecificFilesCommand();
            break;
    }
}

/**
 * Behandelt das Kommando zur Auswahl des Themes
 * @returns {Promise<void>} Promise, der nach der Ausführung erfüllt wird
 */
async function handleSelectThemeCommand() {
    const config = vscode.workspace.getConfiguration('comitto');
    const uiSettings = config.get('uiSettings');
    const currentTheme = uiSettings.theme || 'auto';

    const ui = require('./ui');
    const themes = [
        { label: 'Hell', value: 'light', detail: 'Helles Theme für die Extension verwenden' },
        { label: 'Dunkel', value: 'dark', detail: 'Dunkles Theme für die Extension verwenden' },
        { label: 'Automatisch', value: 'auto', detail: 'Theme automatisch an VS Code Theme anpassen' }
    ];

    const selected = await vscode.window.showQuickPick(themes, {
        placeHolder: 'Theme auswählen',
        ignoreFocusOut: true
    });

    if (selected) {
        uiSettings.theme = selected.value;
        await config.update('uiSettings', uiSettings, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Theme auf "${ui.getThemeLabel(selected.value)}" gesetzt.`);
    }
}

module.exports = {
    registerCommands
}; 