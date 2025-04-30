const vscode = require('vscode');
const ui = require('./ui'); // Importiere UI-Modul für Hilfsfunktionen
const { executeGitCommand, getStatusText, updateStatusBarProgress } = require('./utils');
const { generateWithOllama, generateWithOpenAI, generateWithAnthropic } = require('./extension');
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
                const currentPatterns = triggerRules.filePatterns.join('\n');
                
                const input = await vscode.window.showInputBox({
                    prompt: 'Geben Sie Dateimuster ein (durch Zeilenumbrüche getrennt)',
                    value: currentPatterns,
                    multiline: true
                });
                
                if (input !== undefined) {
                    const newPatterns = input.split('\n').filter(p => p.trim().length > 0);
                    await config.update('triggerRules', { ...triggerRules, filePatterns: newPatterns }, vscode.ConfigurationTarget.Global);
                    showNotification('Dateimuster wurden aktualisiert.', 'info');
                }
                
                // UI aktualisieren
                if (providers) {
                    providers.settingsProvider.refresh();
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
                
                const input = await vscode.window.showInputBox({
                    prompt: 'Minimale Anzahl von Änderungen für Auto-Commit',
                    value: triggerRules.minChangeCount.toString(),
                    validateInput: (value) => {
                        const num = parseInt(value);
                        return isNaN(num) || num < 0 ? 'Bitte geben Sie eine positive Zahl ein' : null;
                    }
                });
                
                if (input !== undefined) {
                    const newValue = parseInt(input);
                    await config.update('triggerRules', { ...triggerRules, minChangeCount: newValue }, vscode.ConfigurationTarget.Global);
                    showNotification(`Minimale Änderungsanzahl wurde auf ${newValue} gesetzt.`, 'info');
                }
                
                // UI aktualisieren
                if (providers) {
                    providers.settingsProvider.refresh();
                }
            } catch (error) {
                handleError(error, "Fehler beim Bearbeiten der minimalen Änderungsanzahl", true);
            }
        })
    );
    
    // Zeitschwellenwert bearbeiten
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.editTimeThreshold', async () => {
            try {
                const config = vscode.workspace.getConfiguration('comitto');
                const triggerRules = config.get('triggerRules');
                
                const input = await vscode.window.showInputBox({
                    prompt: 'Zeitschwellenwert in Minuten für Auto-Commit',
                    value: triggerRules.timeThresholdMinutes.toString(),
                    validateInput: (value) => {
                        const num = parseInt(value);
                        return isNaN(num) || num < 1 ? 'Bitte geben Sie eine positive Zahl größer als 0 ein' : null;
                    }
                });
                
                if (input !== undefined) {
                    const newValue = parseInt(input);
                    await config.update('triggerRules', { ...triggerRules, timeThresholdMinutes: newValue }, vscode.ConfigurationTarget.Global);
                    showNotification(`Zeitschwellenwert wurde auf ${newValue} Minuten gesetzt.`, 'info');
                }
                
                // UI aktualisieren
                if (providers) {
                    providers.settingsProvider.refresh();
                }
            } catch (error) {
                handleError(error, "Fehler beim Bearbeiten des Zeitschwellenwerts", true);
            }
        })
    );
    
    // Dateianzahlschwellenwert bearbeiten
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.editFileCountThreshold', async () => {
            try {
                const config = vscode.workspace.getConfiguration('comitto');
                const triggerRules = config.get('triggerRules');
                
                const input = await vscode.window.showInputBox({
                    prompt: 'Dateianzahlschwellenwert für Auto-Commit',
                    value: triggerRules.fileCountThreshold.toString(),
                    validateInput: (value) => {
                        const num = parseInt(value);
                        return isNaN(num) || num < 1 ? 'Bitte geben Sie eine positive Zahl größer als 0 ein' : null;
                    }
                });
                
                if (input !== undefined) {
                    const newValue = parseInt(input);
                    await config.update('triggerRules', { ...triggerRules, fileCountThreshold: newValue }, vscode.ConfigurationTarget.Global);
                    showNotification(`Dateianzahlschwellenwert wurde auf ${newValue} gesetzt.`, 'info');
                }
                
                // UI aktualisieren
                if (providers) {
                    providers.settingsProvider.refresh();
                }
            } catch (error) {
                handleError(error, "Fehler beim Bearbeiten des Dateianzahlschwellenwerts", true);
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
    
    // Manuellen Commit durchführen
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.performManualCommit', async () => {
            try {
                await performAutoCommit(true); // true = manueller Trigger
            } catch (error) {
                handleError(error, "Fehler beim manuellen Commit", true);
            }
        })
    );
    
    // Alle Änderungen stagen
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.stageAll', async () => {
            try {
                const gitCmd = await executeGitCommand('add -A');
                showNotification('Alle Änderungen wurden zum Staging-Bereich hinzugefügt.', 'info');
                
                // UI aktualisieren
                if (providers) {
                    providers.statusProvider.refresh();
                }
            } catch (error) {
                handleError(error, "Fehler beim Hinzufügen aller Änderungen zum Staging-Bereich", true);
            }
        })
    );
}

/**
 * Generiert eine Commit-Nachricht basierend auf Git-Status und Diff
 * @param {string} gitStatus Git-Status-Ausgabe
 * @param {string} diffOutput Git-Diff-Ausgabe
 * @returns {Promise<string>} Generierte Commit-Nachricht
 */
async function generateCommitMessage(gitStatus, diffOutput) {
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
        let promptTemplate = config.get('promptTemplate');
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
                return await generateWithOllama(promptTemplate);
            case 'openai':
                return await generateWithOpenAI(promptTemplate);
            case 'anthropic':
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