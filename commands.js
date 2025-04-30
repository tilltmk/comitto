const vscode = require('vscode');
const ui = require('./ui'); // Importiere UI-Modul für Hilfsfunktionen
const { executeGitCommand, getStatusText, updateStatusBarProgress } = require('./utils');
const axios = require('axios');

// Closure statt globaler Variable für die Statusleiste
let statusBarItemRef = null;

/**
 * Registriert Befehle für die Erweiterung
 * @param {vscode.ExtensionContext} context VSCode-Erweiterungskontext
 * @param {Object} providers UI-Provider-Instanzen
 * @param {vscode.StatusBarItem} statusBarItem Statusleistenelement
 * @param {Function} setupFileWatcher Funktion zum Einrichten des FileWatchers
 * @param {Function} disableFileWatcher Funktion zum Deaktivieren des FileWatchers
 * @param {Function} performAutoCommit Funktion zum Ausführen eines Auto-Commits
 * @param {Function} showNotification Funktion zum Anzeigen von Benachrichtigungen
 */
function registerCommands(context, providers, statusBarItem, setupFileWatcher, disableFileWatcher, performAutoCommit, showNotification) {
    // Statusleiste in Closure speichern statt global
    statusBarItemRef = statusBarItem;
    
    // Auto-Commit ein-/ausschalten
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.enableAutoCommit', async () => {
            try {
                // Konfiguration abrufen und ändern
                const config = vscode.workspace.getConfiguration('comitto');
                await config.update('autoCommitEnabled', true, vscode.ConfigurationTarget.Global);
                
                // FileWatcher einrichten
                setupFileWatcher(context);
                
                // Statusleiste aktualisieren
                updateStatusBarProgress(statusBarItem, 'Aktiv', 100, 'Automatische Commits aktiviert');
                showNotification('Automatische Commits aktiviert', 'info');
                // Logge den Status der automatischen Commits in der Konsole
                console.log('Automatische Commits wurden aktiviert');
                // UI-Provider aktualisieren
                if (providers) {
                    providers.statusProvider.refresh();
                    providers.settingsProvider.refresh();
                    providers.quickActionsProvider.refresh();
                }
            } catch (error) {
                handleError(error, "Fehler beim Aktivieren des Auto-Commits", true);
            }
        })
    );
    
    // Auto-Commit deaktivieren
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.disableAutoCommit', async () => {
            try {
                // Konfiguration abrufen und ändern
                const config = vscode.workspace.getConfiguration('comitto');
                await config.update('autoCommitEnabled', false, vscode.ConfigurationTarget.Global);
                
                // FileWatcher deaktivieren
                disableFileWatcher();
                
                // Statusleiste aktualisieren
                updateStatusBarProgress(statusBarItem, 'Inaktiv', 0, 'Automatische Commits deaktiviert');
                showNotification('Automatische Commits deaktiviert', 'info');
                
                // UI-Provider aktualisieren
                if (providers) {
                    providers.statusProvider.refresh();
                    providers.settingsProvider.refresh();
                    providers.quickActionsProvider.refresh();
                }
            } catch (error) {
                handleError(error, "Fehler beim Deaktivieren des Auto-Commits", true);
            }
        })
    );
    
    // Auto-Commit umschalten
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.toggleAutoCommit', async () => {
            try {
                const config = vscode.workspace.getConfiguration('comitto');
                const isEnabled = config.get('autoCommitEnabled');
                
                if (isEnabled) {
                    await vscode.commands.executeCommand('comitto.disableAutoCommit');
                } else {
                    await vscode.commands.executeCommand('comitto.enableAutoCommit');
                }
            } catch (error) {
                handleError(error, "Fehler beim Umschalten des Auto-Commits", true);
            }
        })
    );
    
    // Manuellen Commit ausführen
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.manualCommit', async () => {
            try {
                await performAutoCommit(true); // true = manueller Trigger
            } catch (error) {
                handleError(error, "Fehler beim manuellen Commit", true);
            }
        })
    );
    
    // Dashboard anzeigen
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.showDashboard', async () => {
            try {
                if (providers && providers.dashboardProvider) {
                    providers.dashboardProvider.show();
                } else {
                    showNotification('Dashboard konnte nicht geöffnet werden.', 'error');
                }
            } catch (error) {
                handleError(error, "Fehler beim Öffnen des Dashboards", true);
            }
        })
    );
    
    // Einfache UI anzeigen
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.showSimpleUI', async () => {
            try {
                if (providers && providers.simpleUIProvider) {
                    providers.simpleUIProvider.show();
                } else {
                    showNotification('Einfache UI konnte nicht geöffnet werden.', 'error');
                }
            } catch (error) {
                handleError(error, "Fehler beim Öffnen der einfachen UI", true);
            }
        })
    );
    
    // AI-Provider auswählen
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.selectAiProvider', async () => {
            try {
                const providers = ['ollama', 'openai', 'anthropic'];
                const selection = await vscode.window.showQuickPick(providers, {
                    placeHolder: 'Wähle einen KI-Provider für die Commit-Nachrichtengenerierung'
                });
                
                if (selection) {
                    const config = vscode.workspace.getConfiguration('comitto');
                    await config.update('aiProvider', selection, vscode.ConfigurationTarget.Global);
                    showNotification(`KI-Provider wurde auf ${selection} gesetzt.`, 'info');
                }
            } catch (error) {
                handleError(error, "Fehler bei der Auswahl des KI-Providers", true);
            }
        })
    );
    
    // Einfachen Modus umschalten
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.toggleSimpleMode', async () => {
            try {
                const config = vscode.workspace.getConfiguration('comitto');
                const uiSettings = config.get('uiSettings');
                const newValue = !uiSettings.simpleMode;
                
                await config.update('uiSettings', { ...uiSettings, simpleMode: newValue }, vscode.ConfigurationTarget.Global);
                showNotification(`Einfacher Modus wurde ${newValue ? 'aktiviert' : 'deaktiviert'}.`, 'info');
                
                // UI aktualisieren
                if (providers) {
                    providers.settingsProvider.refresh();
                }
            } catch (error) {
                handleError(error, "Fehler beim Umschalten des einfachen Modus", true);
            }
        })
    );
    
    // Theme auswählen
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.selectTheme', async () => {
            try {
                const themes = ['auto', 'hell', 'dunkel'];
                const selection = await vscode.window.showQuickPick(themes, {
                    placeHolder: 'Wähle ein Theme für Comitto'
                });
                
                if (selection) {
                    const config = vscode.workspace.getConfiguration('comitto');
                    const uiSettings = config.get('uiSettings');
                    await config.update('uiSettings', { ...uiSettings, theme: selection }, vscode.ConfigurationTarget.Global);
                    showNotification(`Theme wurde auf '${selection}' gesetzt.`, 'info');
                }
            } catch (error) {
                handleError(error, "Fehler bei der Auswahl des Themes", true);
            }
        })
    );
    
    // onSave-Trigger umschalten
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.toggleOnSave', async () => {
            try {
                const config = vscode.workspace.getConfiguration('comitto');
                const triggerRules = config.get('triggerRules');
                const newValue = !triggerRules.onSave;
                
                await config.update('triggerRules', { ...triggerRules, onSave: newValue }, vscode.ConfigurationTarget.Global);
                showNotification(`Auto-Commit beim Speichern wurde ${newValue ? 'aktiviert' : 'deaktiviert'}.`, 'info');
                
                // UI aktualisieren
                if (providers) {
                    providers.settingsProvider.refresh();
                }
            } catch (error) {
                handleError(error, "Fehler beim Umschalten des onSave-Triggers", true);
            }
        })
    );
    
    // onInterval-Trigger umschalten
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.toggleOnInterval', async () => {
            try {
                const config = vscode.workspace.getConfiguration('comitto');
                const triggerRules = config.get('triggerRules');
                const newValue = !triggerRules.onInterval;
                
                await config.update('triggerRules', { ...triggerRules, onInterval: newValue }, vscode.ConfigurationTarget.Global);
                showNotification(`Auto-Commit im Intervall wurde ${newValue ? 'aktiviert' : 'deaktiviert'}.`, 'info');
                
                // UI aktualisieren
                if (providers) {
                    providers.settingsProvider.refresh();
                }
            } catch (error) {
                handleError(error, "Fehler beim Umschalten des onInterval-Triggers", true);
            }
        })
    );
    
    // onBranchSwitch-Trigger umschalten
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.toggleOnBranchSwitch', async () => {
            try {
                const config = vscode.workspace.getConfiguration('comitto');
                const triggerRules = config.get('triggerRules');
                const newValue = !triggerRules.onBranchSwitch;
                
                await config.update('triggerRules', { ...triggerRules, onBranchSwitch: newValue }, vscode.ConfigurationTarget.Global);
                showNotification(`Auto-Commit beim Branch-Wechsel wurde ${newValue ? 'aktiviert' : 'deaktiviert'}.`, 'info');
                
                // UI aktualisieren
                if (providers) {
                    providers.settingsProvider.refresh();
                }
            } catch (error) {
                handleError(error, "Fehler beim Umschalten des onBranchSwitch-Triggers", true);
            }
        })
    );
    
    // Dateimuster bearbeiten
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.editFilePatterns', async () => {
            try {
                const config = vscode.workspace.getConfiguration('comitto');
                const triggerRules = config.get('triggerRules');
                const currentPatterns = triggerRules.filePatterns.join(', ');
                
                const newPatterns = await vscode.window.showInputBox({
                    prompt: "Dateimuster (durch Komma getrennt)",
                    value: currentPatterns,
                    placeHolder: "z.B. **/*.js, **/*.ts"
                });
                
                if (newPatterns !== undefined) {
                    const patternsArray = newPatterns.split(',').map(p => p.trim()).filter(p => p.length > 0);
                    await config.update('triggerRules', { ...triggerRules, filePatterns: patternsArray }, vscode.ConfigurationTarget.Global);
                    showNotification('Dateimuster wurden aktualisiert.', 'info');
                    
                    // UI aktualisieren
                    if (providers) {
                        providers.settingsProvider.refresh();
                    }
                }
            } catch (error) {
                handleError(error, "Fehler beim Bearbeiten der Dateimuster", true);
            }
        })
    );
    
    // Minimale Änderungsanzahl bearbeiten
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.editMinChangeCount', async () => {
            try {
                const config = vscode.workspace.getConfiguration('comitto');
                const triggerRules = config.get('triggerRules');
                const currentValue = triggerRules.minChangeCount.toString();
                
                const newValue = await vscode.window.showInputBox({
                    prompt: "Minimale Anzahl an Änderungen für Auto-Commit",
                    value: currentValue,
                    placeHolder: "z.B. 10"
                });
                
                if (newValue !== undefined) {
                    const numValue = parseInt(newValue);
                    if (!isNaN(numValue) && numValue >= 0) {
                        await config.update('triggerRules', { ...triggerRules, minChangeCount: numValue }, vscode.ConfigurationTarget.Global);
                        showNotification(`Minimale Änderungsanzahl auf ${numValue} gesetzt.`, 'info');
                        
                        // UI aktualisieren
                        if (providers) {
                            providers.settingsProvider.refresh();
                        }
                    } else {
                        showNotification('Bitte geben Sie eine gültige Zahl ein.', 'error');
                    }
                }
            } catch (error) {
                handleError(error, "Fehler beim Bearbeiten der minimalen Änderungsanzahl", true);
            }
        })
    );
    
    // Zeitschwellwert bearbeiten
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.editTimeThreshold', async () => {
            try {
                const config = vscode.workspace.getConfiguration('comitto');
                const triggerRules = config.get('triggerRules');
                const currentValue = triggerRules.timeThresholdMinutes.toString();
                
                const newValue = await vscode.window.showInputBox({
                    prompt: "Zeitschwellwert in Minuten (Zeit seit letztem Commit)",
                    value: currentValue,
                    placeHolder: "z.B. 30"
                });
                
                if (newValue !== undefined) {
                    const numValue = parseInt(newValue);
                    if (!isNaN(numValue) && numValue >= 0) {
                        await config.update('triggerRules', { ...triggerRules, timeThresholdMinutes: numValue }, vscode.ConfigurationTarget.Global);
                        showNotification(`Zeitschwellwert auf ${numValue} Minuten gesetzt.`, 'info');
                        
                        // UI aktualisieren
                        if (providers) {
                            providers.settingsProvider.refresh();
                        }
                    } else {
                        showNotification('Bitte geben Sie eine gültige Zahl ein.', 'error');
                    }
                }
            } catch (error) {
                handleError(error, "Fehler beim Bearbeiten des Zeitschwellwerts", true);
            }
        })
    );
    
    // Dateien-Schwellwert bearbeiten
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.editFileCountThreshold', async () => {
            try {
                const config = vscode.workspace.getConfiguration('comitto');
                const triggerRules = config.get('triggerRules');
                const currentValue = triggerRules.fileCountThreshold.toString();
                
                const newValue = await vscode.window.showInputBox({
                    prompt: "Dateien-Schwellwert (Anzahl der geänderten Dateien)",
                    value: currentValue,
                    placeHolder: "z.B. 3"
                });
                
                if (newValue !== undefined) {
                    const numValue = parseInt(newValue);
                    if (!isNaN(numValue) && numValue >= 0) {
                        await config.update('triggerRules', { ...triggerRules, fileCountThreshold: numValue }, vscode.ConfigurationTarget.Global);
                        showNotification(`Dateien-Schwellwert auf ${numValue} gesetzt.`, 'info');
                        
                        // UI aktualisieren
                        if (providers) {
                            providers.settingsProvider.refresh();
                        }
                    } else {
                        showNotification('Bitte geben Sie eine gültige Zahl ein.', 'error');
                    }
                }
            } catch (error) {
                handleError(error, "Fehler beim Bearbeiten des Dateien-Schwellwerts", true);
            }
        })
    );
    
    // Einstellungen aktualisieren
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.refreshSettings', async () => {
            try {
                // UI-Provider aktualisieren
                if (providers) {
                    providers.statusProvider.refresh();
                    providers.settingsProvider.refresh();
                    providers.quickActionsProvider.refresh();
                }
                showNotification('Einstellungen wurden aktualisiert.', 'info');
            } catch (error) {
                handleError(error, "Fehler beim Aktualisieren der Einstellungen", true);
            }
        })
    );
    
    // Einstellungen öffnen
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.openSettings', async () => {
            try {
                await vscode.commands.executeCommand('workbench.action.openSettings', 'comitto');
            } catch (error) {
                handleError(error, "Fehler beim Öffnen der Einstellungen", true);
            }
        })
    );
    
    // Manuellen Commit ausführen (Alias für manualCommit)
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.performManualCommit', async () => {
            try {
                await performAutoCommit(true); // true = manueller Trigger
            } catch (error) {
                handleError(error, "Fehler beim manuellen Commit", true);
            }
        })
    );
    
    // OpenAI-Modell auswählen
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.selectOpenAIModel', async () => {
            try {
                const models = [
                    { label: 'GPT-4o', value: 'gpt-4o' },
                    { label: 'GPT-4o Mini', value: 'gpt-4o-mini' },
                    { label: 'GPT-4', value: 'gpt-4' },
                    { label: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
                    { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' }
                ];
                
                const selection = await vscode.window.showQuickPick(models, {
                    placeHolder: 'Wähle ein OpenAI-Modell',
                    title: 'OpenAI-Modell auswählen'
                });
                
                if (selection) {
                    const config = vscode.workspace.getConfiguration('comitto');
                    const openaiConfig = config.get('openai') || {};
                    
                    // Aktualisiere das Modell in den Einstellungen
                    openaiConfig.model = selection.value;
                    await config.update('openai', openaiConfig, vscode.ConfigurationTarget.Global);
                    
                    showNotification(`OpenAI-Modell wurde auf ${selection.label} (${selection.value}) gesetzt.`, 'info');
                    
                    // UI aktualisieren
                    if (providers) {
                        providers.settingsProvider.refresh();
                    }
                }
            } catch (error) {
                handleError(error, "Fehler bei der Auswahl des OpenAI-Modells", true);
            }
        })
    );
    
    // OpenAI API-Schlüssel bearbeiten
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.editOpenAIKey', async () => {
            try {
                const config = vscode.workspace.getConfiguration('comitto');
                const openaiConfig = config.get('openai') || {};
                const currentKey = openaiConfig.apiKey || '';
                
                // Maske für den Schlüssel erstellen, falls einer existiert
                const maskedKey = currentKey ? '********' + currentKey.slice(-4) : '';
                
                const input = await vscode.window.showInputBox({
                    prompt: 'OpenAI API-Schlüssel eingeben',
                    placeHolder: 'sk-...',
                    value: maskedKey,
                    password: true // Eingabe als Passwort maskieren
                });
                
                if (input !== undefined) {
                    // Wenn der Benutzer nicht die maskierte Version gelassen hat
                    if (input !== maskedKey) {
                        // Schlüssel aktualisieren
                        openaiConfig.apiKey = input;
                        await config.update('openai', openaiConfig, vscode.ConfigurationTarget.Global);
                        showNotification('OpenAI API-Schlüssel wurde aktualisiert.', 'info');
                    }
                    
                    // UI aktualisieren
                    if (providers) {
                        providers.settingsProvider.refresh();
                    }
                }
            } catch (error) {
                handleError(error, "Fehler beim Bearbeiten des OpenAI API-Schlüssels", true);
            }
        })
    );
    
    // Und auch einen Befehl für Anthropic, da dieser ebenfalls in der UI referenziert wird
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.editAnthropicKey', async () => {
            try {
                const config = vscode.workspace.getConfiguration('comitto');
                const anthropicConfig = config.get('anthropic') || {};
                const currentKey = anthropicConfig.apiKey || '';
                
                // Maske für den Schlüssel erstellen, falls einer existiert
                const maskedKey = currentKey ? '********' + currentKey.slice(-4) : '';
                
                const input = await vscode.window.showInputBox({
                    prompt: 'Anthropic API-Schlüssel eingeben',
                    placeHolder: 'sk-...',
                    value: maskedKey,
                    password: true // Eingabe als Passwort maskieren
                });
                
                if (input !== undefined) {
                    // Wenn der Benutzer nicht die maskierte Version gelassen hat
                    if (input !== maskedKey) {
                        // Schlüssel aktualisieren
                        anthropicConfig.apiKey = input;
                        await config.update('anthropic', anthropicConfig, vscode.ConfigurationTarget.Global);
                        showNotification('Anthropic API-Schlüssel wurde aktualisiert.', 'info');
                    }
                    
                    // UI aktualisieren
                    if (providers) {
                        providers.settingsProvider.refresh();
                    }
                }
            } catch (error) {
                handleError(error, "Fehler beim Bearbeiten des Anthropic API-Schlüssels", true);
            }
        })
    );
    
    // Und auch einen Befehl für die Bearbeitung der Prompt-Vorlage
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.editPromptTemplate', async () => {
            try {
                const config = vscode.workspace.getConfiguration('comitto');
                const currentTemplate = config.get('promptTemplate') || 'Generiere eine Commit-Nachricht für diese Änderungen: {changes}';
                
                // Multi-line Text Editor verwenden, um die Vorlage zu bearbeiten
                const document = await vscode.workspace.openTextDocument({
                    content: currentTemplate,
                    language: 'markdown'
                });
                
                const editor = await vscode.window.showTextDocument(document);
                
                // Event-Listener für das Speichern registrieren
                const disposable = vscode.workspace.onDidSaveTextDocument(async (doc) => {
                    if (doc === document) {
                        const newTemplate = doc.getText();
                        await config.update('promptTemplate', newTemplate, vscode.ConfigurationTarget.Global);
                        showNotification('Prompt-Vorlage wurde aktualisiert.', 'info');
                        
                        // Event-Listener und temporäres Dokument entfernen
                        disposable.dispose();
                        setTimeout(() => {
                            vscode.commands.executeCommand('workbench.action.closeActiveEditor');
                        }, 500);
                    }
                });
                
                // Info-Meldung anzeigen
                vscode.window.showInformationMessage('Bearbeiten Sie die Prompt-Vorlage und speichern Sie die Datei (STRG+S), um die Änderungen zu übernehmen.');
            } catch (error) {
                handleError(error, "Fehler beim Bearbeiten der Prompt-Vorlage", true);
            }
        })
    );
    
    // Alle Änderungen stagen
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.stageAll', async () => {
            try {
                const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
                if (gitExtension) {
                    const git = gitExtension.getAPI(1);
                    if (git.repositories && git.repositories.length > 0) {
                        await git.repositories[0].add([]);
                        showNotification('Alle Änderungen wurden gestagt.', 'info');
                    } else {
                        showNotification('Kein Git-Repository gefunden.', 'error');
                    }
                } else {
                    // Fallback auf git add -A
                    const workspaceFolders = vscode.workspace.workspaceFolders;
                    if (workspaceFolders && workspaceFolders.length > 0) {
                        const path = workspaceFolders[0].uri.fsPath;
                        await executeGitCommand(path, ['add', '-A']);
                        showNotification('Alle Änderungen wurden gestagt.', 'info');
                    } else {
                        showNotification('Kein Arbeitsbereich geöffnet.', 'error');
                    }
                }
            } catch (error) {
                handleError(error, "Fehler beim Stagen aller Änderungen", true);
            }
        })
    );
}

/**
 * Generiert eine Commit-Nachricht basierend auf Git-Status und Diff
 * @param {string} gitStatus Git-Status-Ausgabe
 * @param {string} diffOutput Git-Diff-Ausgabe
 * @param {Function} generateWithOllama Funktion zur Generierung einer Commit-Nachricht mit Ollama
 * @param {Function} generateWithOpenAI Funktion zur Generierung einer Commit-Nachricht mit OpenAI
 * @param {Function} generateWithAnthropic Funktion zur Generierung einer Commit-Nachricht mit Anthropic
 * @returns {Promise<string>} Generierte Commit-Nachricht
 */
async function generateCommitMessage(gitStatus, diffOutput, generateWithOllama, generateWithOpenAI, generateWithAnthropic) {
    try {
        const config = vscode.workspace.getConfiguration('comitto');
        const aiProvider = config.get('aiProvider');
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
        let promptTemplate = config.get('promptTemplate') || 'Generiere eine Commit-Nachricht basierend auf folgenden Änderungen:';
        promptTemplate = promptTemplate.replace('{changes}', changes);
        
        // Sprache für die Commit-Nachricht einfügen
        const language = gitSettings.commitMessageLanguage || 'de';
        if (!promptTemplate.includes(language)) {
            promptTemplate += `\nDie Commit-Nachricht soll auf ${language.toUpperCase()} sein.`;
        }
        
        // Commit-Stil einfügen
        const style = gitSettings.commitMessageStyle || 'conventional';
        if (style === 'conventional' && !promptTemplate.includes('conventional')) {
            promptTemplate += `\nVerwende das Conventional Commits Format (feat, fix, docs, style, etc.).`;
        }
        
        // Verschiedene KI-Provider unterstützen
        switch (aiProvider) {
            case 'ollama':
                if (typeof generateWithOllama !== 'function') {
                    throw new Error('generateWithOllama ist nicht definiert');
                }
                return await generateWithOllama(promptTemplate);
            case 'openai':
                if (typeof generateWithOpenAI !== 'function') {
                    throw new Error('generateWithOpenAI ist nicht definiert');
                }
                return await generateWithOpenAI(promptTemplate);
            case 'anthropic':
                if (typeof generateWithAnthropic !== 'function') {
                    throw new Error('generateWithAnthropic ist nicht definiert');
                }
                return await generateWithAnthropic(promptTemplate);
            default:
                throw new Error(`Unbekannter KI-Provider: ${aiProvider}`);
        }
    } catch (error) {
        handleError(error, "Fehler bei der Generierung der Commit-Nachricht");
        // Fallback-Nachricht bei Fehler zurückgeben
        return "chore: auto commit (Fehler bei der Nachrichtengenerierung)";
    }
}

/**
 * Bereitet eine Prompt-Vorlage mit Git-Status- und Diff-Informationen vor
 * @param {string} gitStatus Git-Status-Ausgabe
 * @param {string} diffOutput Git-Diff-Ausgabe
 * @returns {string} Vorbereiteter Prompt
 */
function preparePromptTemplate(gitStatus, diffOutput) {
    try {
        const config = vscode.workspace.getConfiguration('comitto');
        let template = config.get('promptTemplate') || 'Generiere eine Commit-Nachricht basierend auf folgenden Änderungen:';
        
        // Status-Informationen hinzufügen
        template = template.replace('{changes}', gitStatus || 'Keine Status-Informationen verfügbar.');
        
        // Gekürzte Diff-Informationen hinzufügen, wenn verfügbar
        if (diffOutput && diffOutput.length > 0) {
            // Diff auf sinnvolle Größe beschränken (max. 2000 Zeichen)
            const maxLength = 2000;
            const truncatedDiff = diffOutput.length > maxLength
                ? diffOutput.substring(0, maxLength) + '...(gekürzt)'
                : diffOutput;
                
            template += `\n\nHier sind einige der Änderungen im Detail:\n${truncatedDiff}`;
        }
        
        return template;
    } catch (error) {
        handleError(error, "Fehler bei der Vorbereitung des Prompts");
        return 'Generiere eine Commit-Nachricht basierend auf den letzten Änderungen.';
    }
}

/**
 * Verarbeitet die Daten aus dem Git-Diff für den Prompt
 * @param {string} diffOutput Git-Diff-Ausgabe
 * @returns {string} Verarbeitete Diff-Daten
 */
function processDiffForPrompt(diffOutput) {
    try {
        if (!diffOutput || diffOutput.trim().length === 0) {
            return '';
        }
        
        // Sehr große Diffs kürzen
        const maxDiffLength = 2000;
        if (diffOutput.length > maxDiffLength) {
            // Nur die wichtigsten Teile behalten
            const lines = diffOutput.split('\n');
            const fileHeaderLines = lines.filter(line => line.startsWith('diff --git') || line.startsWith('+++') || line.startsWith('---'));
            const changedLines = lines.filter(line => line.startsWith('+') || line.startsWith('-'));
            
            // Kombination aus Header und einigen geänderten Zeilen
            let result = fileHeaderLines.join('\n') + '\n';
            result += '...\n';
            result += changedLines.slice(0, 30).join('\n'); // Begrenzen auf 30 Zeilen
            
            if (changedLines.length > 30) {
                result += '\n...(weitere Änderungen gekürzt)';
            }
            
            return result;
        }
        
        return diffOutput;
    } catch (error) {
        handleError(error, "Fehler bei der Verarbeitung der Diff-Daten");
        return diffOutput || '';
    }
}

/**
 * Verarbeitet eine rohe Commit-Nachricht zur besseren Darstellung
 * @param {string} rawMessage Rohe Commit-Nachricht
 * @returns {string} Verarbeitete Commit-Nachricht
 */
function processCommitMessage(rawMessage) {
    try {
        if (!rawMessage) {
            return "chore: auto commit";
        }
        
        let processedMessage = rawMessage.trim();
        
        // Entferne Markdown-Formatierung, wenn vorhanden
        processedMessage = processedMessage.replace(/^#\s+/gm, '');
        
        // Auf mehrere Zeilen prüfen und ggf. auf eine Zeile reduzieren
        const lines = processedMessage.split('\n').filter(line => line.trim().length > 0);
        if (lines.length > 1) {
            // Erste Zeile als Hauptnachricht, Rest als Beschreibung
            const config = vscode.workspace.getConfiguration('comitto');
            const gitSettings = config.get('gitSettings');
            
            // Prüfen, ob mehrzeilige Nachrichten erlaubt sind
            if (gitSettings.allowMultilineMessages) {
                // Formatiere mehrzeilige Nachricht entsprechend
                return processedMessage;
            } else {
                // Nur die erste Zeile zurückgeben
                return lines[0];
            }
        }
        
        return processedMessage;
    } catch (error) {
        handleError(error, "Fehler bei der Verarbeitung der Commit-Nachricht");
        return rawMessage ? rawMessage.trim() : "chore: auto commit";
    }
}

/**
 * Fehlerbehandlung für Commands
 * @param {Error} error Der aufgetretene Fehler
 * @param {string} context Kontext, in dem der Fehler aufgetreten ist
 * @param {boolean} showNotification Ob eine Benachrichtigung angezeigt werden soll
 */
function handleError(error, context = 'Allgemeiner Fehler', showNotification = true) {
    console.error(`Fehler in commands.js (${context}):`, error);
    
    if (showNotification) {
        vscode.window.showErrorMessage(`Comitto Fehler: ${error.message}`);
    }
    
    // Statusleiste aktualisieren
    if (statusBarItemRef) {
        updateStatusBarProgress(statusBarItemRef, 'Fehler', -1);
        
        // Nach 3 Sekunden auf normalen Status zurücksetzen
        setTimeout(() => {
            const config = vscode.workspace.getConfiguration('comitto');
            const isEnabled = config.get('autoCommitEnabled');
            updateStatusBarProgress(
                statusBarItemRef, 
                isEnabled ? 'Aktiv' : 'Inaktiv',
                isEnabled ? 100 : 0
            );
        }, 3000);
    }
    
    // Fehler für die aufrufende Funktion weitergeben
    throw error;
}

// Notwendige Exporte für externe Module
module.exports = {
    registerCommands,
    generateCommitMessage,
    handleError,
    preparePromptTemplate,
    processDiffForPrompt,
    processCommitMessage
}; 