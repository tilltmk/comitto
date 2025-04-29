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
}

module.exports = {
    registerCommands
}; 