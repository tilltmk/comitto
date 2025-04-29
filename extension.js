const vscode = require('vscode');
const axios = require('axios');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const ignore = require('ignore');
const ui = require('./ui');
const commands = require('./commands');

/**
 * @type {vscode.StatusBarItem}
 */
let statusBarItem;

/**
 * @type {vscode.FileSystemWatcher}
 */
let fileWatcher;

/**
 * @type {Set<string>}
 */
let changedFiles = new Set();

/**
 * @type {boolean}
 */
let isCommitInProgress = false;

/**
 * @type {Date|null}
 */
let lastCommitTime = null;

/**
 * @type {Object}
 */
let gitignoreObj = null;

/**
 * @type {Object}
 */
let uiProviders = null;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('Die Erweiterung "comitto" wurde aktiviert.');

    // Sicherstellen, dass das Seitenleisten-Icon aus den Ressourcen geladen wird
    const iconPath = path.join(context.extensionPath, 'resources', 'sidebar-icon.svg');
    if (!fs.existsSync(iconPath)) {
        console.error('Seitenleisten-Icon konnte nicht gefunden werden:', iconPath);
    }

    // UI-Komponenten registrieren
    uiProviders = ui.registerUI(context);

    // Befehle registrieren
    commands.registerCommands(context, uiProviders);

    // Statusleistenelement erstellen
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = "$(git-commit) Comitto: Inaktiv";
    statusBarItem.tooltip = "Automatisches Commit mit KI";
    statusBarItem.command = "comitto.toggleAutoCommit";
    context.subscriptions.push(statusBarItem);
    statusBarItem.show();

    // Explizit die Seitenleiste zur Activity Bar hinzufügen
    // (Sollte bereits über package.json eingebunden sein, aber zur Sicherheit)
    vscode.commands.executeCommand('setContext', 'workspaceHasGit', true);

    // Seitenleiste fokussieren, um sicherzustellen, dass sie angezeigt wird
    vscode.commands.executeCommand('comitto-sidebar.focus');

    // Alle Befehle registrieren
    // Befehl zum Öffnen der Einstellungen
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.openSettings', () => {
            vscode.commands.executeCommand('workbench.action.openSettings', 'comitto');
        })
    );

    // Befehl zum Aktualisieren der Einstellungsansicht
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.refreshSettings', () => {
            if (uiProviders) {
                uiProviders.statusProvider.refresh();
                uiProviders.settingsProvider.refresh();
                uiProviders.quickActionsProvider.refresh();
            }
            vscode.window.showInformationMessage('Comitto-Einstellungen wurden aktualisiert.');
        })
    );

    // Befehl zum Aktivieren/Deaktivieren der automatischen Commits
    let toggleCmd = vscode.commands.registerCommand('comitto.toggleAutoCommit', () => {
        const config = vscode.workspace.getConfiguration('comitto');
        const isEnabled = !config.get('autoCommitEnabled');
        config.update('autoCommitEnabled', isEnabled, vscode.ConfigurationTarget.Global);
        
        if (isEnabled) {
            setupFileWatcher(context);
            statusBarItem.text = "$(sync~spin) Comitto: Aktiv";
        } else {
            disableFileWatcher();
            statusBarItem.text = "$(git-commit) Comitto: Inaktiv";
        }
        
        // UI aktualisieren
        if (uiProviders) {
            uiProviders.statusProvider.refresh();
            uiProviders.quickActionsProvider.refresh();
        }
        
        const uiSettings = config.get('uiSettings');
        if (uiSettings && uiSettings.showNotifications) {
            vscode.window.showInformationMessage(`Automatische Commits sind ${isEnabled ? 'aktiviert' : 'deaktiviert'}.`);
        }
    });

    // Befehle zum Aktivieren/Deaktivieren der automatischen Commits
    let enableCmd = vscode.commands.registerCommand('comitto.enableAutoCommit', () => {
        vscode.workspace.getConfiguration('comitto').update('autoCommitEnabled', true, vscode.ConfigurationTarget.Global);
        setupFileWatcher(context);
        statusBarItem.text = "$(sync~spin) Comitto: Aktiv";
        
        // UI aktualisieren
        if (uiProviders) {
            uiProviders.statusProvider.refresh();
            uiProviders.quickActionsProvider.refresh();
        }
        
        const config = vscode.workspace.getConfiguration('comitto');
        const uiSettings = config.get('uiSettings');
        if (uiSettings && uiSettings.showNotifications) {
            vscode.window.showInformationMessage('Automatische Commits sind aktiviert.');
        }
    });

    let disableCmd = vscode.commands.registerCommand('comitto.disableAutoCommit', () => {
        vscode.workspace.getConfiguration('comitto').update('autoCommitEnabled', false, vscode.ConfigurationTarget.Global);
        disableFileWatcher();
        statusBarItem.text = "$(git-commit) Comitto: Inaktiv";
        
        // UI aktualisieren
        if (uiProviders) {
            uiProviders.statusProvider.refresh();
            uiProviders.quickActionsProvider.refresh();
        }
        
        const config = vscode.workspace.getConfiguration('comitto');
        const uiSettings = config.get('uiSettings');
        if (uiSettings && uiSettings.showNotifications) {
            vscode.window.showInformationMessage('Automatische Commits sind deaktiviert.');
        }
    });

    // Befehl zum manuellen Ausführen eines KI-generierten Commits
    let manualCommitCmd = vscode.commands.registerCommand('comitto.performManualCommit', async () => {
        try {
            const config = vscode.workspace.getConfiguration('comitto');
            const uiSettings = config.get('uiSettings');
            
            // Optional Bestätigung anfordern
            let shouldProceed = true;
            if (uiSettings && uiSettings.confirmBeforeCommit) {
                shouldProceed = await vscode.window.showInformationMessage(
                    'Möchten Sie einen manuellen KI-Commit durchführen?',
                    'Ja', 'Abbrechen'
                ) === 'Ja';
            }
            
            if (shouldProceed) {
                await performAutoCommit(true);
                if (uiSettings && uiSettings.showNotifications) {
                    vscode.window.showInformationMessage('Manueller KI-Commit wurde erfolgreich durchgeführt.');
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Fehler beim manuellen Commit: ${error.message}`);
        }
    });

    context.subscriptions.push(toggleCmd, enableCmd, disableCmd, manualCommitCmd);

    // .gitignore einlesen, wenn vorhanden
    loadGitignore();

    // FileSystemWatcher initialisieren, wenn automatische Commits aktiviert sind
    if (vscode.workspace.getConfiguration('comitto').get('autoCommitEnabled')) {
        setupFileWatcher(context);
        statusBarItem.text = "$(sync~spin) Comitto: Aktiv";
    }

    // Konfigurationsänderungen überwachen
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('comitto')) {
            if (vscode.workspace.getConfiguration('comitto').get('autoCommitEnabled')) {
                setupFileWatcher(context);
            } else {
                disableFileWatcher();
            }
            
            if (event.affectsConfiguration('comitto.gitSettings.useGitignore')) {
                loadGitignore();
            }
            
            // UI aktualisieren
            if (uiProviders) {
                uiProviders.statusProvider.refresh();
                uiProviders.settingsProvider.refresh();
                uiProviders.quickActionsProvider.refresh();
            }
        }
    }));
    
    // Nach der Aktivierung einen kurzen Verzögerungstimer setzen, um sicherzustellen,
    // dass die Seitenleiste korrekt initialisiert wird
    setTimeout(() => {
        if (uiProviders) {
            uiProviders.statusProvider.refresh();
            uiProviders.settingsProvider.refresh();
            uiProviders.quickActionsProvider.refresh();
        }
    }, 1000);

    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.openai.selectModel', async () => {
            await commands.handleCommand('openai', context);
        })
    );
    
    context.subscriptions.push(
        vscode.commands.registerCommand('comitto.selectCommitMessageLanguage', async () => {
            await commands.handleCommitMessageLanguageCommand();
        })
    );
}

/**
 * .gitignore-Datei laden und Parser erstellen
 */
function loadGitignore() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const gitSettings = vscode.workspace.getConfiguration('comitto').get('gitSettings');
    if (!gitSettings.useGitignore) {
        gitignoreObj = null;
        return;
    }

    const repoPath = gitSettings.repositoryPath || workspaceFolders[0].uri.fsPath;
    const gitignorePath = path.join(repoPath, '.gitignore');
    
    try {
        if (fs.existsSync(gitignorePath)) {
            const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
            gitignoreObj = ignore().add(gitignoreContent);
        } else {
            gitignoreObj = null;
        }
    } catch (error) {
        console.error('Fehler beim Laden der .gitignore-Datei:', error);
        gitignoreObj = null;
    }
}

/**
 * FileSystemWatcher konfigurieren
 * @param {vscode.ExtensionContext} context
 */
function setupFileWatcher(context) {
    // Vorhandenen Watcher deaktivieren
    disableFileWatcher();

    // Neuen Watcher erstellen
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('Comitto: Kein Workspace gefunden.');
        return;
    }

    const config = vscode.workspace.getConfiguration('comitto');
    const triggerRules = config.get('triggerRules');
    const filePatterns = triggerRules.filePatterns || ['**/*'];

    fileWatcher = vscode.workspace.createFileSystemWatcher(filePatterns.length === 1 ? filePatterns[0] : '{' + filePatterns.join(',') + '}');
    
    // Auf Dateiereignisse reagieren
    fileWatcher.onDidChange(uri => {
        if (!isFileIgnored(uri.fsPath)) {
            changedFiles.add(uri.fsPath);
            checkCommitTrigger();
        }
    });
    
    fileWatcher.onDidCreate(uri => {
        if (!isFileIgnored(uri.fsPath)) {
            changedFiles.add(uri.fsPath);
            checkCommitTrigger();
        }
    });
    
    fileWatcher.onDidDelete(uri => {
        if (!isFileIgnored(uri.fsPath)) {
            changedFiles.add(uri.fsPath);
            checkCommitTrigger();
        }
    });

    context.subscriptions.push(fileWatcher);
}

/**
 * FileSystemWatcher deaktivieren
 */
function disableFileWatcher() {
    if (fileWatcher) {
        fileWatcher.dispose();
        fileWatcher = null;
    }
    changedFiles.clear();
}

/**
 * Überprüft, ob eine Datei ignoriert werden soll
 * @param {string} filePath Dateipfad
 * @returns {boolean}
 */
function isFileIgnored(filePath) {
    // Standardmäßig node_modules und .git ausschließen
    if (filePath.includes('node_modules') || filePath.includes('.git')) {
        return true;
    }

    // .gitignore-Regeln prüfen, wenn verfügbar
    if (gitignoreObj) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            const relativePath = path.relative(workspaceFolders[0].uri.fsPath, filePath)
                .replace(/\\/g, '/');  // Pfadtrennzeichen normalisieren
            
            return gitignoreObj.ignores(relativePath);
        }
    }

    return false;
}

/**
 * Prüft, ob die Bedingungen für ein Auto-Commit erfüllt sind
 */
function checkCommitTrigger() {
    // Wenn bereits ein Commit-Vorgang läuft, abbrechen
    if (isCommitInProgress) {
        return;
    }

    const config = vscode.workspace.getConfiguration('comitto');
    const rules = config.get('triggerRules');

    // Prüfen, ob bestimmte Dateien geändert wurden
    const specificFiles = rules.specificFiles || [];
    const hasSpecificFileChanged = specificFiles.length > 0 && 
        specificFiles.some(file => [...changedFiles].some(changed => changed.includes(file)));

    // Prüfen, ob die Mindestanzahl an Änderungen erreicht wurde
    const hasMinChanges = changedFiles.size >= (rules.minChangeCount || 10);

    // Prüfen, ob die Anzahl der geänderten Dateien den Schwellwert überschreitet
    const hasFileThreshold = changedFiles.size >= (rules.fileCountThreshold || 3);

    // Prüfen, ob genug Zeit seit dem letzten Commit vergangen ist
    const timeThresholdMinutes = rules.timeThresholdMinutes || 30;
    const timeThresholdMs = timeThresholdMinutes * 60 * 1000;
    const hasTimeThresholdPassed = !lastCommitTime || 
        (Date.now() - lastCommitTime.getTime() >= timeThresholdMs);

    // Commit auslösen, wenn die Bedingungen erfüllt sind
    if (hasTimeThresholdPassed && (hasSpecificFileChanged || hasMinChanges || hasFileThreshold)) {
        performAutoCommit();
    }
}

/**
 * Führt den automatischen Commit-Prozess durch
 * @param {boolean} isManualTrigger Gibt an, ob der Commit manuell ausgelöst wurde
 */
async function performAutoCommit(isManualTrigger = false) {
    try {
        isCommitInProgress = true;
        statusBarItem.text = "$(sync~spin) Comitto: Commit wird vorbereitet...";

        // Git-Repository-Pfad bestimmen
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            throw new Error('Kein Workspace gefunden.');
        }

        const config = vscode.workspace.getConfiguration('comitto');
        const gitSettings = config.get('gitSettings');
        const repoPath = gitSettings.repositoryPath || workspaceFolders[0].uri.fsPath;
        
        try {
            // git add für alle geänderten Dateien ausführen
            await executeGitCommand('git add .', repoPath);
            
            // git status ausführen, um Änderungen zu erhalten
            const gitStatus = await executeGitCommand('git status --porcelain', repoPath);
            
            if (!gitStatus.trim() && !isManualTrigger) {
                isCommitInProgress = false;
                statusBarItem.text = "$(sync~spin) Comitto: Aktiv";
                changedFiles.clear();
                return;
            } else if (!gitStatus.trim() && isManualTrigger) {
                throw new Error('Keine Änderungen zum Committen gefunden.');
            }

            // Änderungen abrufen
            const diffOutput = await executeGitCommand('git diff --cached', repoPath);
            
            // Commit-Nachricht mit ausgewähltem KI-Modell generieren
            const commitMessage = await generateCommitMessage(gitStatus, diffOutput);
            
            // Verzweigen, falls ein bestimmter Branch konfiguriert ist
            if (gitSettings.branch) {
                try {
                    // Prüfen, ob der Branch existiert
                    const branches = await executeGitCommand('git branch', repoPath);
                    if (!branches.includes(gitSettings.branch)) {
                        await executeGitCommand(`git checkout -b ${gitSettings.branch}`, repoPath);
                        showNotification(`Branch '${gitSettings.branch}' erstellt und ausgecheckt.`, 'info');
                    } else {
                        await executeGitCommand(`git checkout ${gitSettings.branch}`, repoPath);
                    }
                } catch (error) {
                    console.error('Fehler beim Branch-Wechsel:', error);
                    showNotification(`Fehler beim Branch-Wechsel: ${error.message}. Fortfahren mit aktuellem Branch.`, 'warning');
                    // Fortfahren mit dem aktuellen Branch
                }
            }
            
            // git commit ausführen
            await executeGitCommand(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, repoPath);
            
            // Git push falls konfiguriert
            if (gitSettings.autoPush) {
                try {
                    const currentBranch = (await executeGitCommand('git rev-parse --abbrev-ref HEAD', repoPath)).trim();
                    await executeGitCommand(`git push origin ${currentBranch}`, repoPath);
                    showNotification(`Änderungen wurden zu origin/${currentBranch} gepusht.`, 'info');
                } catch (error) {
                    console.error('Push fehlgeschlagen:', error);
                    showNotification(`Push fehlgeschlagen: ${error.message}`, 'error');
                }
            }
            
            // Statusleiste aktualisieren und Änderungen zurücksetzen
            lastCommitTime = new Date();
            statusBarItem.text = "$(sync~spin) Comitto: Aktiv";
            changedFiles.clear();
            
            if (!isManualTrigger) {
                showNotification(`Automatischer Commit durchgeführt: ${commitMessage}`, 'info');
            } else {
                showNotification(`Manueller Commit durchgeführt: ${commitMessage}`, 'info');
            }
        } catch (error) {
            console.error('Git-Befehl fehlgeschlagen:', error);
            showNotification(`Git-Befehl fehlgeschlagen: ${error.message}`, 'error');
            throw error;
        }
    } catch (error) {
        console.error('Comitto Fehler:', error);
        showNotification(`Comitto Fehler: ${error.message}`, 'error');
        statusBarItem.text = "$(sync~spin) Comitto: Aktiv";
    } finally {
        isCommitInProgress = false;
    }
}

/**
 * Zeigt eine Benachrichtigung an, wenn entsprechend konfiguriert
 * @param {string} message Die anzuzeigende Nachricht
 * @param {string} type Der Typ der Nachricht (info, warning, error)
 */
function showNotification(message, type = 'info') {
    const config = vscode.workspace.getConfiguration('comitto');
    const uiSettings = config.get('uiSettings');
    
    if (uiSettings && uiSettings.showNotifications) {
        switch (type) {
            case 'info':
                vscode.window.showInformationMessage(message);
                break;
            case 'warning':
                vscode.window.showWarningMessage(message);
                break;
            case 'error':
                vscode.window.showErrorMessage(message);
                break;
            default:
                vscode.window.showInformationMessage(message);
        }
    }
    
    // Immer in die Konsole loggen
    console.log(`Comitto [${type}]: ${message}`);
}

/**
 * Führt einen Git-Befehl aus
 * @param {string} command Der auszuführende Git-Befehl
 * @param {string} cwd Arbeitsverzeichnis für den Befehl
 * @returns {Promise<string>} Ausgabe des Befehls
 */
function executeGitCommand(command, cwd) {
    return new Promise((resolve, reject) => {
        exec(command, { cwd }, (error, stdout, stderr) => {
            if (error) {
                // Detailliertere Fehlermeldung
                const errorMessage = stderr || error.message || 'Unbekannter Git-Fehler';
                console.error(`Git-Befehl fehlgeschlagen: ${command}`, errorMessage);
                reject(new Error(errorMessage));
                return;
            }
            resolve(stdout);
        });
    });
}

/**
 * Generiert eine Commit-Nachricht mit dem konfigurierten KI-Modell
 * @param {string} gitStatus Die Ausgabe von git status
 * @param {string} diffOutput Die Ausgabe von git diff
 * @returns {Promise<string>} Generierte Commit-Nachricht
 */
async function generateCommitMessage(gitStatus, diffOutput) {
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
    
    // Diff-Informationen für komplexere Abrechnungen hinzufügen
    if (diffOutput && diffOutput.length > 0) {
        // Eine gekürzte Version des Diffs anhängen, um den Kontext zu verbessern,
        // aber nicht zu viel Token zu verwenden
        const maxDiffLength = 3000; // Maximale Anzahl der Zeichen des Diffs
        const shortenedDiff = diffOutput.length > maxDiffLength 
            ? diffOutput.substring(0, maxDiffLength) + `...\n[Diff wurde gekürzt, insgesamt ${diffOutput.length} Zeichen]`
            : diffOutput;
        
        promptTemplate += `\n\nHier ist ein Ausschnitt der konkreten Änderungen:\n\n${shortenedDiff}`;
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
}

/**
 * Generiert eine Commit-Nachricht mit Ollama
 * @param {string} prompt Der zu verwendende Prompt
 * @returns {Promise<string>} Generierte Commit-Nachricht
 */
async function generateWithOllama(prompt) {
    const config = vscode.workspace.getConfiguration('comitto');
    const endpoint = config.get('ollama.endpoint');
    const model = config.get('ollama.model');
    
    try {
        const response = await axios.post(endpoint, {
            model: model,
            prompt: prompt,
            stream: false
        });
        
        if (response.data && response.data.response) {
            // Formatierung der Nachricht: Leerzeichen und Anführungszeichen entfernen
            return response.data.response.trim()
                .replace(/^["']|["']$/g, '')  // Entfernt Anführungszeichen am Anfang und Ende
                .replace(/\n/g, ' ');  // Ersetzt Zeilenumbrüche durch Leerzeichen
        } else {
            throw new Error('Unerwartetes Antwortformat von Ollama');
        }
    } catch (error) {
        console.error('Ollama API-Fehler:', error.response?.data || error.message);
        throw new Error(`Fehler bei der Kommunikation mit Ollama: ${error.message}`);
    }
}

/**
 * Generiert eine Commit-Nachricht mit OpenAI
 * @param {string} prompt Der zu verwendende Prompt
 * @returns {Promise<string>} Generierte Commit-Nachricht
 */
async function generateWithOpenAI(prompt) {
    const config = vscode.workspace.getConfiguration('comitto');
    const apiKey = config.get('openai.apiKey');
    const model = config.get('openai.model');
    
    if (!apiKey) {
        throw new Error('OpenAI API-Schlüssel nicht konfiguriert');
    }
    
    try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: model,
            messages: [
                { role: 'system', content: 'Du bist ein Assistent, der hilft, präzise Git-Commit-Nachrichten zu erstellen.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.3,
            max_tokens: 100
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.data && response.data.choices && response.data.choices[0]) {
            return response.data.choices[0].message.content.trim()
                .replace(/^["']|["']$/g, '')
                .replace(/\n/g, ' ');
        } else {
            throw new Error('Unerwartetes Antwortformat von OpenAI');
        }
    } catch (error) {
        console.error('OpenAI API-Fehler:', error.response?.data || error.message);
        throw new Error(`Fehler bei der Kommunikation mit OpenAI: ${error.message}`);
    }
}

/**
 * Generiert eine Commit-Nachricht mit Anthropic
 * @param {string} prompt Der zu verwendende Prompt
 * @returns {Promise<string>} Generierte Commit-Nachricht
 */
async function generateWithAnthropic(prompt) {
    const config = vscode.workspace.getConfiguration('comitto');
    const apiKey = config.get('anthropic.apiKey');
    const model = config.get('anthropic.model');
    
    if (!apiKey) {
        throw new Error('Anthropic API-Schlüssel nicht konfiguriert');
    }
    
    try {
        const response = await axios.post('https://api.anthropic.com/v1/messages', {
            model: model,
            max_tokens: 100,
            temperature: 0.3,
            system: 'Du bist ein Assistent, der hilft, präzise Git-Commit-Nachrichten zu erstellen.',
            messages: [
                { role: 'user', content: prompt }
            ]
        }, {
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json'
            }
        });
        
        if (response.data && response.data.content && response.data.content[0]) {
            return response.data.content[0].text.trim()
                .replace(/^["']|["']$/g, '')
                .replace(/\n/g, ' ');
        } else {
            throw new Error('Unerwartetes Antwortformat von Anthropic');
        }
    } catch (error) {
        console.error('Anthropic API-Fehler:', error.response?.data || error.message);
        throw new Error(`Fehler bei der Kommunikation mit Anthropic: ${error.message}`);
    }
}

/**
 * Gibt einen lesbaren Text für den Git-Status-Code zurück
 * @param {string} statusCode Der Git-Status-Code
 * @returns {string} Lesbarer Status
 */
function getStatusText(statusCode) {
    switch(statusCode) {
        case 'M': return 'Geändert:';
        case 'A': return 'Hinzugefügt:';
        case 'D': return 'Gelöscht:';
        case 'R': return 'Umbenannt:';
        case 'C': return 'Kopiert:';
        case 'U': return 'Unmerged:';
        case '??': return 'Unverfolgt:';
        default: return statusCode;
    }
}

function deactivate() {
    disableFileWatcher();
    if (statusBarItem) {
        statusBarItem.dispose();
    }
}

module.exports = {
    activate,
    deactivate
}; 