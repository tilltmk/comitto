const vscode = require('vscode');
const ui = require('./ui'); // Importiere UI-Modul für Hilfsfunktionen
const { executeGitCommand, getStatusText, updateStatusBarProgress } = require('./utils');
const axios = require('axios');
const path = require('path');
const settings = require('./settings');

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
                await settings.update('autoCommitEnabled', true);
                
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
    
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.configureGuardian', async () => {
            try {
                const currentGuardian = settings.get('guardian');
                const guardianSettings = {
                    ...currentGuardian,
                    quietHours: [...(currentGuardian.quietHours || [])],
                    protectedBranches: [...(currentGuardian.protectedBranches || [])],
                    keywordsRequiringConfirmation: [...(currentGuardian.keywordsRequiringConfirmation || [])]
                };
                
                const options = [
                    { label: `${guardianSettings.smartCommitProtection ? '✓' : '✗'} Schutz aktiv`, value: 'smartCommitProtection' },
                    { label: `${guardianSettings.blockOnDirtyWorkspace ? '✓' : '✗'} Ungespeicherte Dateien blockieren`, value: 'blockOnDirtyWorkspace' },
                    { label: `${guardianSettings.skipWhenDebugging ? '✓' : '✗'} Während Debugging pausieren`, value: 'skipWhenDebugging' },
                    { label: `Cooldown: ${guardianSettings.coolDownMinutes} Minute(n)`, value: 'coolDownMinutes' },
                    { label: `Max Dateien ohne Bestätigung: ${guardianSettings.maxFilesWithoutPrompt}`, value: 'maxFilesWithoutPrompt' },
                    { label: `${guardianSettings.confirmOnLargeChanges ? '✓' : '✗'} Große Diffs bestätigen (${guardianSettings.maxDiffSizeKb} KB)`, value: 'confirmOnLargeChanges' },
                    { label: `Ruhige Zeiten (${guardianSettings.quietHours.length})`, value: 'quietHours' },
                    { label: `Geschützte Branches (${guardianSettings.protectedBranches.length})`, value: 'protectedBranches' },
                    { label: `Schlüsselwörter (${guardianSettings.keywordsRequiringConfirmation.length})`, value: 'keywordsRequiringConfirmation' }
                ];
                
                const selection = await vscode.window.showQuickPick(options, {
                    placeHolder: 'Guardian-Einstellung auswählen'
                });
                
                if (!selection) return;
                
                switch (selection.value) {
                    case 'smartCommitProtection':
                        guardianSettings.smartCommitProtection = !guardianSettings.smartCommitProtection;
                        showNotification(`Commit Guardian ${guardianSettings.smartCommitProtection ? 'aktiviert' : 'deaktiviert'}`, 'info');
                        break;
                    case 'blockOnDirtyWorkspace':
                        guardianSettings.blockOnDirtyWorkspace = !guardianSettings.blockOnDirtyWorkspace;
                        showNotification(`Schutz bei ungespeicherten Dateien ${guardianSettings.blockOnDirtyWorkspace ? 'aktiviert' : 'deaktiviert'}`, 'info');
                        break;
                    case 'skipWhenDebugging':
                        guardianSettings.skipWhenDebugging = !guardianSettings.skipWhenDebugging;
                        showNotification(`Pause während Debugging ${guardianSettings.skipWhenDebugging ? 'aktiviert' : 'deaktiviert'}`, 'info');
                        break;
                    case 'coolDownMinutes': {
                        const value = await vscode.window.showInputBox({
                            prompt: 'Cooldown in Minuten',
                            value: guardianSettings.coolDownMinutes.toString(),
                            placeHolder: 'z.B. 5'
                        });
                        if (value !== undefined) {
                            const parsed = parseInt(value, 10);
                            if (!isNaN(parsed) && parsed >= 0) {
                                guardianSettings.coolDownMinutes = parsed;
                                showNotification(`Cooldown auf ${parsed} Minute(n) gesetzt`, 'info');
                            } else {
                                showNotification('Bitte eine gültige Zahl >= 0 eingeben.', 'warning');
                                return;
                            }
                        } else {
                            return;
                        }
                        break;
                    }
                    case 'maxFilesWithoutPrompt': {
                        const value = await vscode.window.showInputBox({
                            prompt: 'Maximale Anzahl Dateien ohne Bestätigung',
                            value: guardianSettings.maxFilesWithoutPrompt.toString(),
                            placeHolder: 'z.B. 8'
                        });
                        if (value !== undefined) {
                            const parsed = parseInt(value, 10);
                            if (!isNaN(parsed) && parsed >= 0) {
                                guardianSettings.maxFilesWithoutPrompt = parsed;
                                showNotification(`Dateischwelle auf ${parsed} gesetzt`, 'info');
                            } else {
                                showNotification('Bitte eine gültige Zahl >= 0 eingeben.', 'warning');
                                return;
                            }
                        } else {
                            return;
                        }
                        break;
                    }
                    case 'confirmOnLargeChanges':
                        guardianSettings.confirmOnLargeChanges = !guardianSettings.confirmOnLargeChanges;
                        showNotification(`Bestätigung bei großen Diffs ${guardianSettings.confirmOnLargeChanges ? 'aktiviert' : 'deaktiviert'}`, 'info');
                        if (guardianSettings.confirmOnLargeChanges) {
                            const value = await vscode.window.showInputBox({
                                prompt: 'Schwellwert für Diff-Größe (Kilobyte)',
                                value: guardianSettings.maxDiffSizeKb.toString(),
                                placeHolder: 'z.B. 512'
                            });
                            if (value !== undefined) {
                                const parsed = parseInt(value, 10);
                                if (!isNaN(parsed) && parsed >= 32) {
                                    guardianSettings.maxDiffSizeKb = parsed;
                                } else {
                                    showNotification('Bitte eine gültige Zahl >= 32 eingeben.', 'warning');
                                    return;
                                }
                            }
                        }
                        break;
                    case 'quietHours': {
                        const value = await vscode.window.showInputBox({
                            prompt: 'Ruhige Zeiten (Format HH:MM-HH:MM, Kommagetrennt)',
                            value: guardianSettings.quietHours.join(', '),
                            placeHolder: 'z.B. 22:00-07:00,12:00-13:00'
                        });
                        if (value !== undefined) {
                            const ranges = value.split(',').map(entry => entry.trim()).filter(Boolean);
                            guardianSettings.quietHours = ranges;
                            showNotification('Ruhige Zeiten aktualisiert.', 'info');
                        } else {
                            return;
                        }
                        break;
                    }
                    case 'protectedBranches': {
                        const value = await vscode.window.showInputBox({
                            prompt: 'Geschützte Branches (Kommagetrennt, * als Wildcard)',
                            value: guardianSettings.protectedBranches.join(', '),
                            placeHolder: 'z.B. main, master, release/*'
                        });
                        if (value !== undefined) {
                            const branches = value.split(',').map(entry => entry.trim()).filter(Boolean);
                            guardianSettings.protectedBranches = branches;
                            showNotification('Geschützte Branches aktualisiert.', 'info');
                        } else {
                            return;
                        }
                        break;
                    }
                    case 'keywordsRequiringConfirmation': {
                        const value = await vscode.window.showInputBox({
                            prompt: 'Schlüsselwörter für Bestätigung (Kommagetrennt)',
                            value: guardianSettings.keywordsRequiringConfirmation.join(', '),
                            placeHolder: 'z.B. WIP,DO-NOT-COMMIT'
                        });
                        if (value !== undefined) {
                            const keywords = value.split(',').map(entry => entry.trim()).filter(Boolean);
                            guardianSettings.keywordsRequiringConfirmation = keywords;
                            showNotification('Schlüsselwörter aktualisiert.', 'info');
                        } else {
                            return;
                        }
                        break;
                    }
                    default:
                        return;
                }
                
                await settings.update('guardian', guardianSettings);
            } catch (error) {
                handleError(error, "Fehler bei der Konfiguration des Guardians", true);
            }
        })
    );
    
    // Auto-Commit deaktivieren
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.disableAutoCommit', async () => {
            try {
                await settings.update('autoCommitEnabled', false);
                
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
                const isEnabled = settings.get('autoCommitEnabled');
                
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
                    await settings.update('aiProvider', selection);
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
                const uiSettings = settings.get('uiSettings');
                const newValue = !uiSettings.simpleMode;
                
                await settings.update('uiSettings', { ...uiSettings, simpleMode: newValue });
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
                    const uiSettings = settings.get('uiSettings');
                    await settings.update('uiSettings', { ...uiSettings, theme: selection });
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
                const triggerRules = settings.get('triggerRules');
                const newValue = !triggerRules.onSave;
                
                await settings.update('triggerRules', { ...triggerRules, onSave: newValue });
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
                const triggerRules = settings.get('triggerRules');
                const newValue = !triggerRules.onInterval;
                
                await settings.update('triggerRules', { ...triggerRules, onInterval: newValue });
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
                const triggerRules = settings.get('triggerRules');
                const newValue = !triggerRules.onBranchSwitch;
                
                await settings.update('triggerRules', { ...triggerRules, onBranchSwitch: newValue });
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
                const triggerRules = settings.get('triggerRules');
                const currentPatterns = triggerRules.filePatterns.join(', ');
                
                const newPatterns = await vscode.window.showInputBox({
                    prompt: "Dateimuster (durch Komma getrennt)",
                    value: currentPatterns,
                    placeHolder: "z.B. **/*.js, **/*.ts"
                });
                
                if (newPatterns !== undefined) {
                    const patternsArray = newPatterns.split(',').map(p => p.trim()).filter(p => p.length > 0);
                    await settings.update('triggerRules', { ...triggerRules, filePatterns: patternsArray });
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
                const triggerRules = settings.get('triggerRules');
                const currentValue = triggerRules.minChangeCount.toString();
                
                const newValue = await vscode.window.showInputBox({
                    prompt: "Minimale Anzahl an Änderungen für Auto-Commit",
                    value: currentValue,
                    placeHolder: "z.B. 10"
                });
                
                if (newValue !== undefined) {
                    const numValue = parseInt(newValue);
                    if (!isNaN(numValue) && numValue >= 0) {
                        await settings.update('triggerRules', { ...triggerRules, minChangeCount: numValue });
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
                const triggerRules = settings.get('triggerRules');
                const currentValue = triggerRules.timeThresholdMinutes.toString();
                
                const newValue = await vscode.window.showInputBox({
                    prompt: "Zeitschwellwert in Minuten (Zeit seit letztem Commit)",
                    value: currentValue,
                    placeHolder: "z.B. 30"
                });
                
                if (newValue !== undefined) {
                    const numValue = parseInt(newValue);
                    if (!isNaN(numValue) && numValue >= 0) {
                        await settings.update('triggerRules', { ...triggerRules, timeThresholdMinutes: numValue });
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
                const triggerRules = settings.get('triggerRules');
                const currentValue = triggerRules.fileCountThreshold.toString();
                
                const newValue = await vscode.window.showInputBox({
                    prompt: "Dateien-Schwellwert (Anzahl der geänderten Dateien)",
                    value: currentValue,
                    placeHolder: "z.B. 3"
                });
                
                if (newValue !== undefined) {
                    const numValue = parseInt(newValue);
                    if (!isNaN(numValue) && numValue >= 0) {
                        await settings.update('triggerRules', { ...triggerRules, fileCountThreshold: numValue });
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
                    const openaiConfig = { ...settings.get('openai') };
                    
                    // Aktualisiere das Modell in den Einstellungen
                    openaiConfig.model = selection.value;
                    await settings.update('openai', openaiConfig);
                    
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
                const openaiConfig = { ...settings.get('openai') };
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
                        await settings.update('openai', openaiConfig);
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
    
    // Anthropic-Modell auswählen
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.selectAnthropicModel', async () => {
            try {
                const models = [
                    { label: 'Claude 3 Opus', value: 'claude-3-opus-20240229' },
                    { label: 'Claude 3 Sonnet', value: 'claude-3-sonnet-20240229' },
                    { label: 'Claude 3 Haiku', value: 'claude-3-haiku-20240307' },
                    { label: 'Claude 2', value: 'claude-2' },
                    { label: 'Claude 2.1', value: 'claude-2.1' },
                    { label: 'Claude Instant', value: 'claude-instant-1' }
                ];
                
                const selection = await vscode.window.showQuickPick(models, {
                    placeHolder: 'Wähle ein Anthropic-Modell',
                    title: 'Anthropic-Modell auswählen'
                });
                
                if (selection) {
                    const anthropicConfig = { ...settings.get('anthropic') };
                    
                    // Aktualisiere das Modell in den Einstellungen
                    anthropicConfig.model = selection.value;
                    await settings.update('anthropic', anthropicConfig);
                    
                    showNotification(`Anthropic-Modell wurde auf ${selection.label} (${selection.value}) gesetzt.`, 'info');
                    
                    // UI aktualisieren
                    if (providers) {
                        providers.settingsProvider.refresh();
                    }
                }
            } catch (error) {
                handleError(error, "Fehler bei der Auswahl des Anthropic-Modells", true);
            }
        })
    );
    
    // Und auch einen Befehl für Anthropic, da dieser ebenfalls in der UI referenziert wird
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.editAnthropicKey', async () => {
            try {
                const anthropicConfig = { ...settings.get('anthropic') };
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
                        await settings.update('anthropic', anthropicConfig);
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
                const currentTemplate = settings.get('promptTemplate') || 'Generiere eine Commit-Nachricht für diese Änderungen: {changes}';
                
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
                        await settings.update('promptTemplate', newTemplate);
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
    
    // Auto-Push ein-/ausschalten
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.toggleAutoPush', async () => {
            try {
                const gitSettings = { ...settings.get('gitSettings') };
                const currentValue = gitSettings.autoPush || false;
                
                gitSettings.autoPush = !currentValue;
                await settings.update('gitSettings', gitSettings);
                
                showNotification(`Auto-Push ${!currentValue ? 'aktiviert' : 'deaktiviert'}`, 'info');
                
                // UI-Provider aktualisieren
                if (providers) {
                    providers.statusProvider.refresh();
                    providers.settingsProvider.refresh();
                    providers.quickActionsProvider.refresh();
                }
            } catch (error) {
                handleError(error, "Fehler beim Umschalten des Auto-Push", true);
            }
        })
    );
    
    // Branch bearbeiten
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.editBranch', async () => {
            try {
                const gitSettings = { ...settings.get('gitSettings') };
                const currentBranch = gitSettings.branch || '';
                
                const input = await vscode.window.showInputBox({
                    prompt: 'Branch-Name eingeben (leer für aktuellen Branch)',
                    value: currentBranch,
                    placeHolder: 'z.B. main oder feature/new-feature'
                });
                
                if (input !== undefined) {
                    gitSettings.branch = input;
                    await settings.update('gitSettings', gitSettings);
                    showNotification(`Branch auf "${input || 'aktueller Branch'}" gesetzt`, 'info');
                    
                    // UI-Provider aktualisieren
                    if (providers) {
                        providers.statusProvider.refresh();
                        providers.settingsProvider.refresh();
                        providers.quickActionsProvider.refresh();
                    }
                }
            } catch (error) {
                handleError(error, "Fehler beim Bearbeiten des Branch", true);
            }
        })
    );
    
    // Commit-Stil auswählen
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.selectCommitStyle', async () => {
            try {
                const styles = [
                    { label: 'Conventional Commits', value: 'conventional', description: 'feat:, fix:, docs:, style:, etc.' },
                    { label: 'Gitmoji', value: 'gitmoji', description: '🎉, 🐛, 📚, 💄, etc.' },
                    { label: 'Einfach', value: 'simple', description: 'Einfache beschreibende Nachrichten' },
                    { label: 'Angular', value: 'angular', description: 'Angular Commit Convention' },
                    { label: 'Atom', value: 'atom', description: 'Atom Editor Style' }
                ];
                
                const selected = await vscode.window.showQuickPick(styles, {
                    placeHolder: 'Commit-Stil auswählen'
                });
                
                if (selected) {
                    const gitSettings = { ...settings.get('gitSettings') };
                    gitSettings.commitMessageStyle = selected.value;
                    await settings.update('gitSettings', gitSettings);
                    showNotification(`Commit-Stil auf "${selected.label}" gesetzt`, 'info');
                    
                    // UI-Provider aktualisieren
                    if (providers) {
                        providers.statusProvider.refresh();
                        providers.settingsProvider.refresh();
                        providers.quickActionsProvider.refresh();
                    }
                }
            } catch (error) {
                handleError(error, "Fehler beim Auswählen des Commit-Stils", true);
            }
        })
    );
    
    // Commit-Sprache auswählen
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.selectCommitLanguage', async () => {
            try {
                const languages = [
                    { label: 'Deutsch', value: 'de' },
                    { label: 'English', value: 'en' },
                    { label: 'Français', value: 'fr' },
                    { label: 'Español', value: 'es' },
                    { label: 'Italiano', value: 'it' },
                    { label: '日本語', value: 'ja' },
                    { label: '中文', value: 'zh' }
                ];
                
                const selected = await vscode.window.showQuickPick(languages, {
                    placeHolder: 'Sprache für Commit-Nachrichten auswählen'
                });
                
                if (selected) {
                    const gitSettings = { ...settings.get('gitSettings') };
                    gitSettings.commitMessageLanguage = selected.value;
                    await settings.update('gitSettings', gitSettings);
                    showNotification(`Commit-Sprache auf "${selected.label}" gesetzt`, 'info');
                    
                    // UI-Provider aktualisieren
                    if (providers) {
                        providers.statusProvider.refresh();
                        providers.settingsProvider.refresh();
                        providers.quickActionsProvider.refresh();
                    }
                }
            } catch (error) {
                handleError(error, "Fehler beim Auswählen der Commit-Sprache", true);
            }
        })
    );
    
    // Trigger konfigurieren
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.configureTriggers', async () => {
            try {
                const triggerRules = { ...settings.get('triggerRules') };
                
                const options = [
                    { label: `${triggerRules.onSave ? '✓' : '✗'} Bei Speichern`, value: 'onSave' },
                    { label: `${triggerRules.onInterval ? '✓' : '✗'} Intervall-basiert`, value: 'onInterval' },
                    { label: `${triggerRules.onBranchSwitch ? '✓' : '✗'} Bei Branch-Wechsel`, value: 'onBranchSwitch' },
                    { label: 'Datei-Anzahl-Schwellwert bearbeiten', value: 'fileCountThreshold' },
                    { label: 'Zeit-Schwellwert bearbeiten', value: 'timeThreshold' },
                    { label: 'Mindest-Änderungs-Anzahl bearbeiten', value: 'minChangeCount' },
                    { label: 'Datei-Muster bearbeiten', value: 'filePatterns' }
                ];
                
                const selected = await vscode.window.showQuickPick(options, {
                    placeHolder: 'Trigger-Einstellung auswählen'
                });
                
                if (selected) {
                    switch (selected.value) {
                        case 'onSave':
                        case 'onInterval':
                        case 'onBranchSwitch':
                            triggerRules[selected.value] = !triggerRules[selected.value];
                            await settings.update('triggerRules', triggerRules);
                            showNotification(`${selected.label} ${triggerRules[selected.value] ? 'aktiviert' : 'deaktiviert'}`, 'info');
                            break;
                        case 'fileCountThreshold':
                            await vscode.commands.executeCommand('comitto.editFileCountThreshold');
                            break;
                        case 'timeThreshold':
                            await vscode.commands.executeCommand('comitto.editTimeThreshold');
                            break;
                        case 'minChangeCount':
                            await vscode.commands.executeCommand('comitto.editMinChangeCount');
                            break;
                        case 'filePatterns':
                            await vscode.commands.executeCommand('comitto.editFilePatterns');
                            break;
                    }
                    
                    // UI-Provider aktualisieren
                    if (providers) {
                        providers.statusProvider.refresh();
                        providers.settingsProvider.refresh();
                        providers.quickActionsProvider.refresh();
                    }
                }
            } catch (error) {
                handleError(error, "Fehler beim Konfigurieren der Trigger", true);
            }
        })
    );
    
    // .gitignore ein-/ausschalten
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.toggleUseGitignore', async () => {
            try {
                const gitSettings = { ...settings.get('gitSettings') };
                const currentValue = gitSettings.useGitignore !== false;
                
                gitSettings.useGitignore = !currentValue;
                await settings.update('gitSettings', gitSettings);
                
                showNotification(`Gitignore ${!currentValue ? 'aktiviert' : 'deaktiviert'}`, 'info');
                
                // UI-Provider aktualisieren
                if (providers) {
                    providers.statusProvider.refresh();
                    providers.settingsProvider.refresh();
                    providers.quickActionsProvider.refresh();
                }
            } catch (error) {
                handleError(error, "Fehler beim Umschalten der Gitignore-Nutzung", true);
            }
        })
    );
    
    // KI-Provider konfigurieren
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.configureAIProvider', async () => {
            try {
                const currentProvider = settings.get('aiProvider');
                
                const providers = [
                    { label: 'OpenAI', value: 'openai', description: 'ChatGPT, GPT-4, etc.' },
                    { label: 'Anthropic', value: 'anthropic', description: 'Claude Models' },
                    { label: 'Ollama', value: 'ollama', description: 'Lokale AI-Modelle' }
                ];
                
                const selected = await vscode.window.showQuickPick(providers, {
                    placeHolder: `Aktuell: ${currentProvider}. Neuen KI-Provider auswählen`
                });
                
                if (selected && selected.value !== currentProvider) {
                    await settings.update('aiProvider', selected.value);
                    showNotification(`KI-Provider auf "${selected.label}" gesetzt`, 'info');
                    
                    // Je nach Provider weitere Konfiguration anbieten
                    switch (selected.value) {
                        case 'openai':
                            const configureOpenAI = await vscode.window.showInformationMessage(
                                'OpenAI ausgewählt. Möchten Sie den API-Schlüssel konfigurieren?',
                                'Ja', 'Nein'
                            );
                            if (configureOpenAI === 'Ja') {
                                await vscode.commands.executeCommand('comitto.editOpenAIKey');
                            }
                            break;
                        case 'anthropic':
                            const configureAnthropic = await vscode.window.showInformationMessage(
                                'Anthropic ausgewählt. Möchten Sie den API-Schlüssel konfigurieren?',
                                'Ja', 'Nein'
                            );
                            if (configureAnthropic === 'Ja') {
                                await vscode.commands.executeCommand('comitto.editAnthropicKey');
                            }
                            break;
                        case 'ollama':
                            const configureOllama = await vscode.window.showInformationMessage(
                                'Ollama ausgewählt. Stellen Sie sicher, dass Ollama lokal läuft.',
                                'OK'
                            );
                            break;
                    }
                    
                    // UI-Provider aktualisieren
                    if (providers) {
                        providers.statusProvider.refresh();
                        providers.settingsProvider.refresh();
                        providers.quickActionsProvider.refresh();
                    }
                }
            } catch (error) {
                handleError(error, "Fehler beim Konfigurieren des KI-Providers", true);
            }
        })
    );
    
    // Ausgewählte Dateien stagen
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.stageSelected', async () => {
            try {
                const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
                if (gitExtension) {
                    const git = gitExtension.getAPI(1);
                    if (git.repositories && git.repositories.length > 0) {
                        const repository = git.repositories[0];
                        
                        // Geänderte Dateien auflisten
                        const changes = repository.state.workingTreeChanges;
                        if (changes.length === 0) {
                            showNotification('Keine Änderungen zum Stagen vorhanden.', 'info');
                            return;
                        }
                        
                        // Dateien zum Auswählen anbieten
                        const options = changes.map(change => ({
                            label: path.basename(change.uri.fsPath),
                            description: change.uri.fsPath,
                            value: change.uri
                        }));
                        
                        const selectedFiles = await vscode.window.showQuickPick(options, {
                            canPickMany: true,
                            placeHolder: 'Dateien zum Stagen auswählen'
                        });
                        
                        if (selectedFiles && selectedFiles.length > 0) {
                            const fileUris = selectedFiles.map(file => file.value);
                            await repository.add(fileUris);
                            showNotification(`${selectedFiles.length} Datei(en) gestagt.`, 'info');
                        }
                    } else {
                        showNotification('Kein Git-Repository gefunden.', 'error');
                    }
                } else {
                    showNotification('Git-Erweiterung nicht verfügbar.', 'error');
                }
            } catch (error) {
                handleError(error, "Fehler beim Stagen ausgewählter Dateien", true);
            }
        })
    );
    
    // Stage-Modus auswählen
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.selectStageMode', async () => {
            try {
                const gitSettings = { ...settings.get('gitSettings') };
                
                const stageModes = [
                    { 
                        label: 'Alle Dateien stagen', 
                        value: 'all',
                        description: 'Automatisch alle geänderten Dateien stagen'
                    },
                    { 
                        label: 'Spezifische Dateien stagen', 
                        value: 'specific',
                        description: 'Nur Dateien mit bestimmten Mustern stagen'
                    },
                    { 
                        label: 'Nachfragen', 
                        value: 'ask',
                        description: 'Vor jedem Commit nach Dateien fragen'
                    }
                ];
                
                const selected = await vscode.window.showQuickPick(stageModes, {
                    placeHolder: 'Stage-Modus auswählen'
                });
                
                if (selected) {
                    gitSettings.stageMode = selected.value;
                    await settings.update('gitSettings', gitSettings);
                    showNotification(`Stage-Modus auf "${selected.label}" gesetzt`, 'info');
                    
                    // UI-Provider aktualisieren
                    if (providers) {
                        providers.statusProvider.refresh();
                        providers.settingsProvider.refresh();
                        providers.quickActionsProvider.refresh();
                    }
                }
            } catch (error) {
                handleError(error, "Fehler beim Auswählen des Stage-Modus", true);
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
        const aiProvider = settings.get('aiProvider');
        const gitSettings = settings.get('gitSettings');
        
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
        let promptTemplate = settings.get('promptTemplate') || 'Generiere eine Commit-Nachricht basierend auf folgenden Änderungen:';
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
        } else if (style === 'gitmoji' && !promptTemplate.includes('gitmoji')) {
            promptTemplate += `\nVerwende Gitmoji-Emojis am Anfang der Commit-Nachricht (🎉, 🐛, 📚, 💄, etc.).`;
        } else if (style === 'angular' && !promptTemplate.includes('angular')) {
            promptTemplate += `\nVerwende das Angular Commit Convention Format mit type(scope): description.`;
        } else if (style === 'atom' && !promptTemplate.includes('atom')) {
            promptTemplate += `\nVerwende das Atom Editor Commit Format: :emoji: description.`;
        } else if (style === 'simple' && !promptTemplate.includes('simple')) {
            promptTemplate += `\nVerwende einfache, beschreibende Commit-Nachrichten ohne spezifisches Format.`;
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
        let template = settings.get('promptTemplate') || 'Generiere eine Commit-Nachricht basierend auf folgenden Änderungen:';
        
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
            const gitSettings = settings.get('gitSettings');
            
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
            const isEnabled = settings.get('autoCommitEnabled');
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