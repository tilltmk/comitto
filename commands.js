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
        const models = ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'];
        
        const selected = await vscode.window.showQuickPick(
            models.map(name => ({ label: name })),
            { placeHolder: 'OpenAI-Modell auswählen' }
        );
        
        if (selected) {
            await vscode.workspace.getConfiguration('comitto').update('openai.model', selected.label, vscode.ConfigurationTarget.Global);
            providers.settingsProvider.refresh();
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
        const languages = ['de', 'en', 'fr', 'es', 'it'];
        const displayNames = ['Deutsch', 'Englisch', 'Französisch', 'Spanisch', 'Italienisch'];
        
        const selected = await vscode.window.showQuickPick(
            displayNames.map((name, index) => ({ label: name, id: languages[index] })),
            { placeHolder: 'Commit-Nachrichtensprache auswählen' }
        );
        
        if (selected) {
            const gitSettings = vscode.workspace.getConfiguration('comitto').get('gitSettings');
            gitSettings.commitMessageLanguage = selected.id;
            await vscode.workspace.getConfiguration('comitto').update('gitSettings', gitSettings, vscode.ConfigurationTarget.Global);
            providers.settingsProvider.refresh();
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
                    break;
                    
                case 'openai':
                    const openaiModels = ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'];
                    const openaiModel = await vscode.window.showQuickPick(
                        openaiModels.map(name => ({ label: name })),
                        { 
                            placeHolder: 'OpenAI-Modell auswählen',
                            title: 'OpenAI-Modell konfigurieren'
                        }
                    );
                    
                    if (openaiModel) {
                        await vscode.workspace.getConfiguration('comitto').update('openai.model', openaiModel.label, vscode.ConfigurationTarget.Global);
                        
                        const hasKey = !!vscode.workspace.getConfiguration('comitto').get('openai.apiKey');
                        if (!hasKey) {
                            const shouldConfigureKey = await vscode.window.showInformationMessage(
                                'OpenAI API-Schlüssel ist nicht konfiguriert. Möchten Sie ihn jetzt konfigurieren?',
                                'Ja', 'Nein'
                            );
                            
                            if (shouldConfigureKey === 'Ja') {
                                vscode.commands.executeCommand('comitto.editOpenAIKey');
                            }
                        }
                    }
                    break;
                    
                case 'anthropic':
                    const anthropicModels = ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229'];
                    const anthropicModel = await vscode.window.showQuickPick(
                        anthropicModels.map(name => ({ label: name })),
                        { 
                            placeHolder: 'Claude-Modell auswählen',
                            title: 'Claude-Modell konfigurieren'
                        }
                    );
                    
                    if (anthropicModel) {
                        await vscode.workspace.getConfiguration('comitto').update('anthropic.model', anthropicModel.label, vscode.ConfigurationTarget.Global);
                        
                        const hasKey = !!vscode.workspace.getConfiguration('comitto').get('anthropic.apiKey');
                        if (!hasKey) {
                            const shouldConfigureKey = await vscode.window.showInformationMessage(
                                'Anthropic API-Schlüssel ist nicht konfiguriert. Möchten Sie ihn jetzt konfigurieren?',
                                'Ja', 'Nein'
                            );
                            
                            if (shouldConfigureKey === 'Ja') {
                                vscode.commands.executeCommand('comitto.editAnthropicKey');
                            }
                        }
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

module.exports = {
    registerCommands
}; 