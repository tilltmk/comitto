const vscode = require('vscode');
const axios = require('axios');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const ignore = require('ignore');
const ui = require('./ui');
const commands = require('./commands');
const { executeGitCommand, getStatusText } = require('./utils'); // Nur executeGitCommand und getStatusText importieren

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
 * @type {NodeJS.Timeout}
 */
let intervalTimer = null;

/**
 * Hauptaktivierungsfunktion der Erweiterung.
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
    console.log('Die Erweiterung "comitto" wird aktiviert.');

    // Sicherstellen, dass das Ressourcenverzeichnis existiert
    ensureResourceDirs(context);

    // UI-Komponenten registrieren
    uiProviders = ui.registerUI(context);

    // Statusleistenelement erstellen
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = "$(git-commit) Comitto: Initialisiere...";
    statusBarItem.tooltip = "Comitto: Klicke zum Aktivieren/Deaktivieren oder manuellen Commit";
    statusBarItem.command = "comitto.toggleAutoCommit"; // Standardaktion
    context.subscriptions.push(statusBarItem);
    statusBarItem.show();

    // Git-Status prüfen und Kontext setzen
    const hasGit = await checkGitRepository(context);
    vscode.commands.executeCommand('setContext', 'workspaceHasGit', hasGit);

    // Befehle zentral registrieren und Abhängigkeiten übergeben
    commands.registerCommands(
        context,
        uiProviders,
        statusBarItem,
        setupFileWatcher,       // Funktion übergeben
        disableFileWatcher,     // Funktion übergeben
        performAutoCommit,      // Funktion übergeben
        showNotification        // Funktion übergeben
    );
    
    // .gitignore einlesen, wenn vorhanden und konfiguriert
    loadGitignore();

    // Initialen Status setzen und FileSystemWatcher/Timer ggf. starten
    const config = vscode.workspace.getConfiguration('comitto');
    if (config.get('autoCommitEnabled') && hasGit) {
        setupFileWatcher(context);
        statusBarItem.text = "$(sync~spin) Comitto: Aktiv";
    } else if (!hasGit) {
        statusBarItem.text = "$(warning) Comitto: Kein Git-Repo";
        statusBarItem.tooltip = "Kein Git-Repository im aktuellen Workspace gefunden";
        statusBarItem.command = undefined; // Keine Aktion bei Klick
    } else {
        statusBarItem.text = "$(git-commit) Comitto: Inaktiv";
    }

    // Konfigurationsänderungen überwachen
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async event => {
        if (event.affectsConfiguration('comitto')) {
            console.log('Comitto-Konfiguration geändert.');
            const currentConfig = vscode.workspace.getConfiguration('comitto');
            const gitAvailable = await checkGitRepository(context); // Erneut prüfen

            if (event.affectsConfiguration('comitto.autoCommitEnabled') || event.affectsConfiguration('comitto.triggerRules')) {
                if (currentConfig.get('autoCommitEnabled') && gitAvailable) {
                    setupFileWatcher(context); // Re-setup mit neuer Konfig
                     if (statusBarItem) statusBarItem.text = "$(sync~spin) Comitto: Aktiv";
                } else {
                    disableFileWatcher(); // Stoppt Watcher und Timer
                     if (statusBarItem) {
                          statusBarItem.text = gitAvailable ? "$(git-commit) Comitto: Inaktiv" : "$(warning) Comitto: Kein Git-Repo";
                          statusBarItem.command = gitAvailable ? "comitto.toggleAutoCommit" : undefined;
                     }
                }
            }
            
            if (event.affectsConfiguration('comitto.gitSettings.useGitignore')) {
                loadGitignore(); // .gitignore neu laden
            }
            
            // UI immer aktualisieren bei Comitto-Änderungen
            if (uiProviders) {
                uiProviders.statusProvider.refresh();
                uiProviders.settingsProvider.refresh();
                uiProviders.quickActionsProvider.refresh();
            }

            // Dashboard aktualisieren, falls offen
            let dashboardPanel = context.globalState.get('comittoDashboardPanel');
            if (dashboardPanel && dashboardPanel.visible) {
                 dashboardPanel.webview.html = commands.generateDashboardHTML(context); // HTML neu generieren
            }
             let simpleUIPanel = context.globalState.get('comittoSimpleUIPanel');
             if (simpleUIPanel && simpleUIPanel.visible) {
                 const newEnabled = currentConfig.get('autoCommitEnabled');
                 const newProvider = currentConfig.get('aiProvider');
                 simpleUIPanel.webview.html = commands.generateSimpleUIHTML(newEnabled, ui.getProviderDisplayName(newProvider), context);
             }
        }
    }));
    
    // Eventuell kurze Verzögerung für initiale UI-Aktualisierung
    setTimeout(() => {
        if (uiProviders) {
            uiProviders.statusProvider.refresh();
            uiProviders.settingsProvider.refresh();
            uiProviders.quickActionsProvider.refresh();
        }
    }, 1500);

    // Willkommensnachricht anzeigen (einmalig)
    showWelcomeNotification(context);

    console.log('Comitto-Aktivierung abgeschlossen.');
}

/**
 * Prüft, ob im Workspace ein Git-Repository vorhanden ist.
 * @param {vscode.ExtensionContext} context
 * @returns {Promise<boolean>}
 */
async function checkGitRepository(context) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return false;
    }
    const repoPath = workspaceFolders[0].uri.fsPath;
    try {
        await executeGitCommand('git rev-parse --is-inside-work-tree', repoPath);
        console.log('Git-Repository gefunden.');
        return true;
    } catch (error) {
        console.log('Kein Git-Repository gefunden oder Git nicht verfügbar.');
        return false;
    }
}

/**
 * Stellt sicher, dass die notwendigen Ressourcenverzeichnisse existieren.
 * @param {vscode.ExtensionContext} context 
 */
function ensureResourceDirs(context) {
    const dirsToEnsure = ['resources', 'resources/ui'];
    dirsToEnsure.forEach(dir => {
        const dirPath = vscode.Uri.joinPath(context.extensionUri, dir).fsPath;
        if (!fs.existsSync(dirPath)) {
            try {
                fs.mkdirSync(dirPath, { recursive: true });
                console.log(`Verzeichnis erstellt: ${dirPath}`);
            } catch (error) {
                console.error(`Fehler beim Erstellen des Verzeichnisses ${dirPath}:`, error);
            }
        }
    });
}

/**
 * Zeigt eine Willkommensnachricht beim ersten Start nach einer Installation/Update.
 * @param {vscode.ExtensionContext} context
 */
function showWelcomeNotification(context) {
    const currentVersion = context.extension.packageJSON.version;
    const previousVersion = context.globalState.get('comitto.version');

    if (previousVersion !== currentVersion) {
        // Nach erstem Start oder Update anzeigen
        vscode.window.showInformationMessage(
            `Comitto v${currentVersion} wurde aktiviert! Konfigurieren Sie es über die Seitenleiste.`,
            'Seitenleiste öffnen', 'Changelog anzeigen'
        ).then(selection => {
            if (selection === 'Seitenleiste öffnen') {
                vscode.commands.executeCommand('workbench.view.extension.comitto-sidebar');
            } else if (selection === 'Changelog anzeigen') {
                // Prüfen, ob die Nachricht bereits angezeigt wurde
                const hasShownWelcome = context.globalState.get('comitto.hasShownWelcome', false);
                if (!hasShownWelcome) {
                    vscode.window.showInformationMessage(
                        'Comitto wurde aktiviert! Öffnen Sie die Comitto-Seitenleiste über das Icon in der Activity Bar.',
                        'Öffnen', 'Nicht mehr anzeigen'
                    ).then(selection => {
                        if (selection === 'Öffnen') {
                            vscode.commands.executeCommand('comitto-sidebar.focus');
                        } else if (selection === 'Nicht mehr anzeigen') {
                            context.globalState.update('comitto.hasShownWelcome', true);
                        }
                    });
                }
            }
        });
        // Version speichern
        context.globalState.update('comitto.version', currentVersion);
    }

    // Status der UI anzeigen
    const config = vscode.workspace.getConfiguration('comitto');
    const uiSettings = config.get('uiSettings');
    
    if (uiSettings.showNotifications) {
        setTimeout(() => {
            if (vscode.window.activeTextEditor) {
                vscode.window.showInformationMessage(
                    'Comitto ist bereit! Verwenden Sie die Seitenleiste oder das $(git-commit) Symbol in der Statusleiste.',
                    'Einstellungen öffnen', 'Dashboard anzeigen'
                ).then(selection => {
                    if (selection === 'Einstellungen öffnen') {
                        vscode.commands.executeCommand('comitto.openSettings');
                    } else if (selection === 'Dashboard anzeigen') {
                        vscode.commands.executeCommand('comitto.showDashboard');
                    }
                });
            }
        }, 2000);
    }
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

    // Interval-Timer einrichten, falls aktiviert
    if (triggerRules.onInterval) {
        setupIntervalTrigger(triggerRules.intervalMinutes);
    }
}

/**
 * Richtet einen Interval-Trigger für automatische Commits ein
 * @param {number} minutes Intervall in Minuten
 */
function setupIntervalTrigger(minutes) {
    // Bestehenden Timer löschen
    if (intervalTimer) {
        clearInterval(intervalTimer);
        intervalTimer = null;
    }
    
    // Neuen Timer einrichten
    if (minutes > 0) {
        const intervalMs = minutes * 60 * 1000;
        intervalTimer = setInterval(() => {
            if (vscode.workspace.getConfiguration('comitto').get('autoCommitEnabled') && changedFiles.size > 0) {
                const notificationSettings = vscode.workspace.getConfiguration('comitto').get('notifications');
                if (notificationSettings.onTriggerFired) {
                    showNotification('Intervall-Trigger aktiviert. Prüfe auf ausstehende Commits...', 'info');
                }
                checkCommitTrigger();
            }
        }, intervalMs);
    }
}

/**
 * FileSystemWatcher deaktivieren
 */
function disableFileWatcher() {
    if (fileWatcher) {
        fileWatcher.dispose();
        fileWatcher = null;
    }
    
    // Interval-Timer deaktivieren
    if (intervalTimer) {
        clearInterval(intervalTimer);
        intervalTimer = null;
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
            // Prüfen, ob Git initialisiert ist
            try {
                await executeGitCommand('git rev-parse --is-inside-work-tree', repoPath);
            } catch (error) {
                throw new Error('Kein Git-Repository gefunden. Bitte initialisieren Sie zuerst ein Git-Repository.');
            }
            
            // Dateien zum Staging hinzufügen
            await stageChanges(gitSettings.stageMode);
            
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
            let diffOutput = '';
            try {
                statusBarItem.text = "$(sync~spin) Comitto: Diff wird berechnet...";
                diffOutput = await executeGitCommand('git diff --cached', repoPath);
            } catch (error) {
                // Bei Pufferüberlauf trotzdem weitermachen, aber mit eingeschränktem Diff
                if (error.message.includes('zu groß') || 
                    error.message.includes('maxBuffer') || 
                    error.message.includes('ERR_CHILD_PROCESS_STDOUT_MAXBUFFER')) {
                    
                    console.warn('Diff zu groß, verwende alternative Strategie');
                    diffOutput = 'Der Diff ist zu groß für die direkte Verarbeitung.\n';
                    
                    // Dateiliste anstelle des vollständigen Diffs verwenden
                    try {
                        const fileList = await executeGitCommand('git diff --cached --name-status', repoPath);
                        diffOutput += 'Geänderte Dateien:\n' + fileList;
                    } catch (innerError) {
                        console.error('Auch die Dateiliste konnte nicht abgerufen werden:', innerError);
                        diffOutput += 'Diff-Inhalt konnte nicht abgerufen werden. Zu viele oder zu große Änderungen.';
                    }
                } else {
                    // Bei anderen Fehlern den Fehler weiterreichen
                    throw error;
                }
            }
            
            statusBarItem.text = "$(sync~spin) Comitto: Generiere Commit-Nachricht...";
            
            // Commit-Nachricht mit ausgewähltem KI-Modell generieren
            const commitMessage = await generateCommitMessage(gitStatus, diffOutput);
            
            if (!commitMessage || commitMessage.trim().length === 0) {
                throw new Error('Keine gültige Commit-Nachricht generiert. Bitte versuchen Sie es erneut.');
            }
            
            // Verzweigen, falls ein bestimmter Branch konfiguriert ist
            if (gitSettings.branch) {
                try {
                    statusBarItem.text = "$(sync~spin) Comitto: Prüfe Branch...";
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
            
            statusBarItem.text = "$(sync~spin) Comitto: Führe Commit aus...";
            
            // git commit ausführen
            await executeGitCommand(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, repoPath);
            
            // Benachrichtigungen anzeigen basierend auf den Einstellungen
            const notificationSettings = vscode.workspace.getConfiguration('comitto').get('notifications');
            
            if (!isManualTrigger && notificationSettings.onCommit) {
                showNotification(`Automatischer Commit durchgeführt: ${commitMessage}`, 'info');
            } else if (isManualTrigger) {
                showNotification(`Manueller Commit durchgeführt: ${commitMessage}`, 'info');
            }
            
            // Automatischen Push ausführen, wenn konfiguriert
            if (gitSettings.autoPush) {
                try {
                    statusBarItem.text = "$(sync~spin) Comitto: Pushe Änderungen...";
                    const currentBranch = (await executeGitCommand('git rev-parse --abbrev-ref HEAD', repoPath)).trim();
                    await executeGitCommand(`git push origin ${currentBranch}`, repoPath);
                    
                    if (notificationSettings.onPush) {
                        showNotification(`Änderungen wurden zu origin/${currentBranch} gepusht.`, 'info');
                    }
                } catch (error) {
                    console.error('Push fehlgeschlagen:', error);
                    if (notificationSettings.onError) {
                        showNotification(`Push fehlgeschlagen: ${error.message}`, 'error');
                    }
                }
            }
            
            // Statusleiste aktualisieren und Änderungen zurücksetzen
            lastCommitTime = new Date();
            statusBarItem.text = "$(sync~spin) Comitto: Aktiv";
            changedFiles.clear();
        } catch (error) {
            console.error('Git-Befehl fehlgeschlagen:', error);
            const notificationSettings = vscode.workspace.getConfiguration('comitto').get('notifications');
            
            // Benutzerfreundlichere Fehlermeldung
            let errorMessage = error.message;
            if (errorMessage.includes('fatal: not a git repository')) {
                errorMessage = 'Dieses Verzeichnis ist kein Git-Repository. Bitte initialisieren Sie zuerst ein Git-Repository.';
            } else if (errorMessage.includes('fatal: unable to access')) {
                errorMessage = 'Fehler beim Zugriff auf das Remote-Repository. Bitte prüfen Sie Ihre Netzwerkverbindung und Zugangsrechte.';
            } else if (errorMessage.includes('maxBuffer') || errorMessage.includes('zu groß')) {
                errorMessage = 'Zu viele oder zu große Änderungen für die automatische Verarbeitung. Bitte führen Sie einen manuellen Commit durch oder reduzieren Sie die Anzahl der Änderungen.';
            }
            
            if (notificationSettings.onError) {
                showNotification(`Git-Befehl fehlgeschlagen: ${errorMessage}`, 'error');
            }
            
            statusBarItem.text = "$(sync~spin) Comitto: Aktiv";
            throw error;
        }
    } catch (error) {
        console.error('Comitto Fehler:', error);
        const notificationSettings = vscode.workspace.getConfiguration('comitto').get('notifications');
        if (notificationSettings.onError) {
            showNotification(`Comitto Fehler: ${error.message}`, 'error');
        }
        statusBarItem.text = "$(sync~spin) Comitto: Aktiv";
    } finally {
        isCommitInProgress = false;
    }
}

/**
 * Führt das Staging von Dateien basierend auf dem konfigurieren Modus aus
 * @param {string} mode Der Staging-Modus ('all', 'specific', 'prompt')
 * @returns {Promise<void>}
 */
async function stageChanges(mode) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        throw new Error('Kein Workspace gefunden.');
    }
    
    const config = vscode.workspace.getConfiguration('comitto');
    const gitSettings = config.get('gitSettings');
    const repoPath = gitSettings.repositoryPath || workspaceFolders[0].uri.fsPath;
    
    // Bei manuellem Modus Benutzer nach Dateien fragen
    if (mode === 'prompt') {
        // Git Status abrufen
        const gitStatusOutput = await executeGitCommand('git status --porcelain', repoPath);
        if (!gitStatusOutput.trim()) {
            throw new Error('Keine Änderungen zum Stagen gefunden.');
        }
        
        // Dateien parsen
        const changedFilesList = gitStatusOutput.split('\n')
            .filter(line => line.trim().length > 0)
            .map(line => {
                const status = line.substring(0, 2).trim();
                const filePath = line.substring(3).trim();
                return { status, filePath };
            });
        
        // Dateien zur Auswahl anbieten
        const selectedFiles = await vscode.window.showQuickPick(
            changedFilesList.map(file => ({
                label: file.filePath,
                description: ui.getStatusDescription(file.status),
                picked: true // Standardmäßig alle auswählen
            })),
            {
                canPickMany: true,
                placeHolder: 'Dateien zum Stagen auswählen'
            }
        );
        
        if (!selectedFiles || selectedFiles.length === 0) {
            throw new Error('Keine Dateien ausgewählt.');
        }
        
        // Ausgewählte Dateien stagen
        for (const file of selectedFiles) {
            await executeGitCommand(`git add "${file.label}"`, repoPath);
        }
        
        return;
    }
    
    // Spezifische Dateien basierend auf Mustern stagen
    if (mode === 'specific') {
        const patterns = gitSettings.specificStagingPatterns || ['**/*.js', '**/*.ts', '**/*.json'];
        
        for (const pattern of patterns) {
            try {
                // Bei Windows können wir Probleme mit den Pfadtrennzeichen haben,
                // daher verwenden wir ein sicheres Muster für die Ausführung
                const safePattern = pattern.replace(/\\/g, '/');
                await executeGitCommand(`git add "${safePattern}"`, repoPath);
            } catch (error) {
                console.error(`Fehler beim Stagen von Muster ${pattern}:`, error);
                // Wir werfen den Fehler nicht weiter, sondern versuchen andere Muster
            }
        }
        
        return;
    }
    
    // Standardmäßig alle Änderungen stagen
    await executeGitCommand('git add .', repoPath);
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
        // Eine aggressiv gekürzte Version des Diffs anhängen, um den Kontext zu verbessern,
        // aber nicht zu viel Token zu verwenden
        const maxDiffLength = 2000; // Maximale Anzahl der Zeichen des Diffs reduziert auf 2000
        
        // Sehr große Diffs erkennen und Warnung ausgeben
        if (diffOutput.length > 100000) {
            console.warn(`Extrem großer Diff (${diffOutput.length} Zeichen) wird stark gekürzt.`);
        }
        
        // Intelligente Kürzung: Nur die ersten Änderungen jeder Datei
        let shortenedDiff = '';
        
        try {
            // Aufteilen nach Dateiänderungen (beginnen mit 'diff --git')
            const fileChanges = diffOutput.split('diff --git');
            
            // Die ersten Änderungen für jede Datei extrahieren (maximal 5 Dateien)
            const maxFiles = 5;
            const filesToInclude = fileChanges.slice(0, maxFiles);
            
            filesToInclude.forEach((fileChange, index) => {
                if (index === 0 && !fileChange.trim()) return; // Erstes Element kann leer sein
                
                // Jede Dateiänderung auf maximal 400 Zeichen beschränken
                const maxPerFile = 400;
                const truncatedChange = fileChange.length > maxPerFile 
                    ? fileChange.substring(0, maxPerFile) + '...' 
                    : fileChange;
                
                shortenedDiff += (index > 0 ? 'diff --git' : '') + truncatedChange + '\n';
            });
            
            // Kürzen, wenn insgesamt zu lang
            if (shortenedDiff.length > maxDiffLength) {
                shortenedDiff = shortenedDiff.substring(0, maxDiffLength);
            }
            
            shortenedDiff += `\n[Diff wurde gekürzt, insgesamt ${diffOutput.length} Zeichen in ${fileChanges.length} Dateien]`;
        } catch (error) {
            console.error('Fehler beim Kürzen des Diffs:', error);
            shortenedDiff = diffOutput.substring(0, maxDiffLength) + 
                `...\n[Diff wurde einfach gekürzt, insgesamt ${diffOutput.length} Zeichen]`;
        }
        
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
    const endpoint = config.get('ollama.endpoint') || 'http://localhost:11434/api/generate';
    const model = config.get('ollama.model') || 'llama3';
    
    try {
        statusBarItem.text = "$(sync~spin) Comitto: Generiere Commit-Nachricht mit Ollama...";
        
        const response = await axios.post(endpoint, {
            model: model,
            prompt: prompt,
            stream: false
        }, {
            timeout: 30000 // 30 Sekunden Timeout für lokale Modelle
        });
        
        if (response.data && response.data.response) {
            statusBarItem.text = "$(sync~spin) Comitto: Aktiv";
            
            // Formatierung der Nachricht: Leerzeichen und Anführungszeichen entfernen
            let commitMessage = response.data.response.trim()
                .replace(/^["']|["']$/g, '')  // Entfernt Anführungszeichen am Anfang und Ende
                .replace(/\n/g, ' ');  // Ersetzt Zeilenumbrüche durch Leerzeichen
            
            // Prüfen, ob die Nachricht zu lang ist und ggf. kürzen
            if (commitMessage.length > 100) {
                commitMessage = commitMessage.substring(0, 97) + '...';
            }
            
            return commitMessage;
        } else {
            throw new Error('Unerwartetes Antwortformat von Ollama');
        }
    } catch (error) {
        console.error('Ollama API-Fehler:', error.response?.data || error.message);
        
        // Detaillierte Fehlermeldung
        let errorMessage = 'Fehler bei der Kommunikation mit Ollama';
        
        if (error.code === 'ECONNREFUSED') {
            errorMessage = 'Verbindung zu Ollama fehlgeschlagen. Bitte stellen Sie sicher, dass Ollama läuft und erreichbar ist.';
        } else if (error.code === 'ETIMEDOUT' || error.code === 'TIMEOUT') {
            errorMessage = 'Zeitüberschreitung bei der Anfrage an Ollama. Bitte prüfen Sie die Verbindung oder versuchen Sie ein kleineres Modell.';
        } else if (error.response?.status === 404) {
            errorMessage = `Das Ollama-Modell "${model}" wurde nicht gefunden. Bitte stellen Sie sicher, dass das Modell installiert ist.`;
        } else if (error.response?.data) {
            errorMessage = `Ollama-Fehler: ${error.response.data.error || JSON.stringify(error.response.data)}`;
        } else {
            errorMessage = `Ollama-Fehler: ${error.message}`;
        }
        
        statusBarItem.text = "$(sync~spin) Comitto: Aktiv";
        vscode.window.showErrorMessage(errorMessage);
        
        // Fallback: Einfache, generische Commit-Nachricht
        return "chore: Änderungen commited";
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