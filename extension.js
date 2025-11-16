const vscode = require('vscode');
const axios = require('axios');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const ignore = require('ignore');
const ui = require('./ui');
const commands = require('./commands');
const settings = require('./settings');
const { executeGitCommand, getStatusText, ComittoError, ErrorTypes, logError, getErrorLogs, withRetry, getDiagnosticInfo, updateStatusBarProgress } = require('./utils');
const os = require('os');
const { WebviewPanel } = require('vscode');

/**
 * @type {vscode.OutputChannel}
 */
let outputChannel;

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

// Globale Variable für Debug-Logs
let debugLogs = [];
const MAX_DEBUG_LOGS = 100;

/**
 * Fügt einen Eintrag zum Debug-Log hinzu
 * @param {string} message Die Nachricht
 * @param {string} type Der Typ des Logs (info, warning, error)
 */
function addDebugLog(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, message, type };
    
    debugLogs.unshift(logEntry); // Am Anfang einfügen
    
    // Maximale Größe einhalten
    if (debugLogs.length > MAX_DEBUG_LOGS) {
        debugLogs = debugLogs.slice(0, MAX_DEBUG_LOGS);
    }
    
    // In die Konsole schreiben
    const consoleMethod = type === 'error' ? console.error : 
                         type === 'warning' ? console.warn : 
                         console.log;
    consoleMethod(`[Comitto Debug] ${message}`);
    
    // An LogsViewProvider weiterleiten, falls verfügbar
    if (uiProviders && uiProviders.logsProvider) {
        uiProviders.logsProvider.addLog(message, type);
    }
    
    // Auf Webview-Updates verzichten, da dies Fehler verursacht
    // Stattdessen werden wir die Debug-Logs beim Öffnen des Dashboards aktualisieren
}

/**
 * Verbesserte Debug-Protokollierungsfunktion
 */
function debugLog(message, category = 'allgemein', level = 'info') {
    const debugSettings = settings.get('debug');
    if (!debugSettings.enabled && !debugSettings.extendedLogging && level !== 'error') {
        return;
    }
    
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${category}] [${level}] ${message}`;
    
    console.log(formattedMessage);
    
    // Debug-Ausgabe in Ausgabekanal
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel('Comitto Debug');
    }
    
    outputChannel.appendLine(formattedMessage);
    
    // Bei Fehlern das Debug-Panel anzeigen
    if (level === 'error') {
        outputChannel.show(true);
    }
    
    // Optional: In Datei protokollieren
    try {
        const logDir = path.join(process.env.HOME || process.env.USERPROFILE, '.comitto', 'logs');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        
        const logFile = path.join(logDir, `debug_${new Date().toISOString().split('T')[0]}.log`);
        fs.appendFileSync(logFile, formattedMessage + '\n');
    } catch (e) {
        console.error('Fehler beim Schreiben des Debug-Protokolls:', e);
    }
}

/**
 * Fehlerbehandlungsfunktion für die Erweiterung
 * @param {Error|ComittoError} error - Der aufgetretene Fehler
 * @param {string} contextMessage - Kontextbezogene Nachricht
 * @param {boolean} showToUser - Ob der Fehler dem Benutzer angezeigt werden soll
 */
async function handleError(error, contextMessage = '', showToUser = true) {
    // Sicherstellen, dass wir mit einem ComittoError arbeiten
    const comittoError = error instanceof ComittoError ? error :
        new ComittoError(
            error.message || 'Unbekannter Fehler',
            ErrorTypes.UNKNOWN,
            error,
            { context: contextMessage }
        );

    // Fehler protokollieren
    logError(comittoError);

    // Debug-Ausgabe
    debugLog(
        `Fehler: ${comittoError.message}${contextMessage ? ' - ' + contextMessage : ''}`,
        'fehler',
        'error'
    );

    // Detaillierte Informationen in die Konsole schreiben
    console.error('Detaillierter Fehler:', comittoError.toJSON());

    // Benutzerbenachrichtigung im Output Channel (keine Pop-Ups mehr)
    if (showToUser) {
        if (!outputChannel) {
            outputChannel = vscode.window.createOutputChannel('Comitto');
        }

        const messagePrefix = contextMessage ? `${contextMessage}: ` : '';
        const timestamp = new Date().toLocaleTimeString('de-DE');

        outputChannel.appendLine('');
        outputChannel.appendLine(`[${timestamp}] ❌ FEHLER: ${messagePrefix}${comittoError.message}`);
        outputChannel.appendLine(`    Typ: ${comittoError.type}`);
        if (comittoError.context && Object.keys(comittoError.context).length > 0) {
            outputChannel.appendLine(`    Kontext: ${JSON.stringify(comittoError.context)}`);
        }
        outputChannel.appendLine(`    Details: Verwenden Sie 'Comitto: Fehlerprotokolle anzeigen' für mehr Informationen`);
        outputChannel.appendLine('');

        // Output Channel automatisch anzeigen bei Fehlern
        outputChannel.show(true);

        // Status Bar aktualisieren
        if (statusBarItem) {
            const originalText = statusBarItem.text;
            const originalTooltip = statusBarItem.tooltip;
            statusBarItem.text = '$(error) Comitto: Fehler';
            statusBarItem.tooltip = `${messagePrefix}${comittoError.message} - Klicken für Details`;

            // Nach 10 Sekunden zurücksetzen
            setTimeout(() => {
                if (statusBarItem) {
                    statusBarItem.text = originalText;
                    statusBarItem.tooltip = originalTooltip;
                }
            }, 10000);
        }
    }
}

/**
 * Zeigt detaillierte Fehlerinformationen in einem Webview-Panel an
 * @param {ComittoError} error - Der anzuzeigende Fehler
 */
function showErrorDetails(error) {
    const panel = vscode.window.createWebviewPanel(
        'comittoErrorDetails',
        'Comitto Fehlerdetails',
        vscode.ViewColumn.One,
        {
            enableScripts: true
        }
    );
    
    const diagnosticInfo = getDiagnosticInfo();
    
    panel.webview.html = `
        <!DOCTYPE html>
        <html lang="de">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Comitto Fehlerdetails</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    padding: 20px;
                    color: var(--vscode-foreground);
                }
                h2 {
                    margin-top: 20px;
                    margin-bottom: 10px;
                    border-bottom: 1px solid var(--vscode-editor-lineHighlightBorder);
                    padding-bottom: 5px;
                }
                pre {
                    background-color: var(--vscode-editor-background);
                    padding: 15px;
                    border-radius: 4px;
                    overflow: auto;
                }
                .error-section {
                    margin-bottom: 20px;
                }
                .label {
                    font-weight: bold;
                    margin-right: 10px;
                }
                .actions {
                    margin-top: 20px;
                }
                button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    margin-right: 10px;
                }
                button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
            </style>
        </head>
        <body>
            <h1>Fehlerdetails</h1>
            
            <div class="error-section">
                <h2>Fehlerinformationen</h2>
                <div><span class="label">Typ:</span> ${error.type}</div>
                <div><span class="label">Nachricht:</span> ${error.message}</div>
                <div><span class="label">Zeitstempel:</span> ${error.timestamp.toISOString()}</div>
            </div>
            
            <div class="error-section">
                <h2>Fehlerkontext</h2>
                <pre>${JSON.stringify(error.context, null, 2)}</pre>
            </div>
            
            ${error.originalError ? `
                <div class="error-section">
                    <h2>Ursprünglicher Fehler</h2>
                    <div><span class="label">Typ:</span> ${error.originalError.name}</div>
                    <div><span class="label">Nachricht:</span> ${error.originalError.message}</div>
                </div>
            ` : ''}
            
            <div class="error-section">
                <h2>Stack-Trace</h2>
                <pre>${error.stack}</pre>
            </div>
            
            <div class="error-section">
                <h2>Diagnostische Informationen</h2>
                <pre>${JSON.stringify(diagnosticInfo, null, 2)}</pre>
            </div>
            
            <div class="actions">
                <button id="copyDetails">Details kopieren</button>
                <button id="reportIssue">Problem melden</button>
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                
                document.getElementById('copyDetails').addEventListener('click', () => {
                    const errorDetails = ${JSON.stringify(JSON.stringify({
                        error: error.toJSON(),
                        diagnosticInfo
                    }, null, 2))};
                    vscode.postMessage({
                        command: 'copyToClipboard',
                        text: errorDetails
                    });
                });
                
                document.getElementById('reportIssue').addEventListener('click', () => {
                    vscode.postMessage({
                        command: 'reportIssue',
                        error: ${JSON.stringify(error.toJSON())}
                    });
                });
            </script>
        </body>
        </html>
    `;
    
    panel.webview.onDidReceiveMessage(
        message => {
            switch (message.command) {
                case 'copyToClipboard':
                    vscode.env.clipboard.writeText(message.text);
                    showNotification('Fehlerdetails wurden in die Zwischenablage kopiert', 'info');
                    break;
                case 'reportIssue':
                    const issueBody = encodeURIComponent(
                        `## Fehlerbeschreibung\n${error.message}\n\n` +
                        `## Fehlerdetails\n\`\`\`json\n${JSON.stringify(error.toJSON(), null, 2)}\n\`\`\`\n\n` +
                        `## Diagnostische Informationen\n\`\`\`json\n${JSON.stringify(diagnosticInfo, null, 2)}\n\`\`\`\n\n` +
                        `## Schritte zur Reproduktion\n\n` +
                        `## Erwartetes Verhalten\n\n` +
                        `## VSCode-Version\n${vscode.version}\n\n` +
                        `## Comitto-Version\n${vscode.extensions.getExtension('publisher.comitto').packageJSON.version || 'Unbekannt'}`
                    );
                    
                    vscode.env.openExternal(
                        vscode.Uri.parse(`https://github.com/publisher/comitto/issues/new?body=${issueBody}&title=Fehler: ${encodeURIComponent(error.message)}`)
                    );
                    break;
            }
        },
        undefined,
        undefined
    );
}

/**
 * Zeigt eine Liste der neuesten Fehlerprotokolle an
 */
function showErrorLogs() {
    const logs = getErrorLogs();
    
    const panel = vscode.window.createWebviewPanel(
        'comittoErrorLogs',
        'Comitto Fehlerprotokolle',
        vscode.ViewColumn.One,
        {
            enableScripts: true
        }
    );
    
    panel.webview.html = `
        <!DOCTYPE html>
        <html lang="de">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Comitto Fehlerprotokolle</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    padding: 20px;
                    color: var(--vscode-foreground);
                }
                h1 {
                    margin-bottom: 20px;
                }
                .log-entry {
                    margin-bottom: 20px;
                    padding: 15px;
                    background-color: var(--vscode-editor-background);
                    border-radius: 4px;
                    border-left: 4px solid #e74c3c;
                }
                .log-entry-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 10px;
                }
                .log-type {
                    font-weight: bold;
                    color: #e74c3c;
                }
                .log-timestamp {
                    color: var(--vscode-descriptionForeground);
                }
                .log-message {
                    margin-bottom: 10px;
                }
                .log-details-button {
                    background: none;
                    border: 1px solid var(--vscode-button-background);
                    color: var(--vscode-button-background);
                    padding: 4px 8px;
                    border-radius: 4px;
                    cursor: pointer;
                }
                .log-details {
                    display: none;
                    margin-top: 10px;
                    padding: 10px;
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                    border-radius: 4px;
                }
                .log-details pre {
                    white-space: pre-wrap;
                    word-break: break-all;
                }
                .actions {
                    margin-top: 20px;
                }
                button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    margin-right: 10px;
                }
                button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                .no-logs {
                    margin: 30px 0;
                    text-align: center;
                    font-style: italic;
                    color: var(--vscode-descriptionForeground);
                }
            </style>
        </head>
        <body>
            <h1>Fehlerprotokolle</h1>
            
            ${logs.length === 0 ? 
                '<div class="no-logs">Keine Fehlerprotokolle vorhanden</div>' : 
                logs.map((log, index) => `
                    <div class="log-entry">
                        <div class="log-entry-header">
                            <span class="log-type">${log.type}</span>
                            <span class="log-timestamp">${log.timestamp}</span>
                        </div>
                        <div class="log-message">${log.message}</div>
                        <button class="log-details-button" onclick="toggleDetails(${index})">Details anzeigen</button>
                        <div id="details-${index}" class="log-details">
                            <pre>${JSON.stringify(log, null, 2)}</pre>
                        </div>
                    </div>
                `).join('')
            }
            
            <div class="actions">
                <button id="clearLogs">Protokolle löschen</button>
                <button id="exportLogs">Protokolle exportieren</button>
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                
                function toggleDetails(index) {
                    const details = document.getElementById('details-' + index);
                    const button = details.previousElementSibling;
                    
                    if (details.style.display === 'block') {
                        details.style.display = 'none';
                        button.textContent = 'Details anzeigen';
                    } else {
                        details.style.display = 'block';
                        button.textContent = 'Details ausblenden';
                    }
                }
                
                document.getElementById('clearLogs').addEventListener('click', () => {
                    vscode.postMessage({
                        command: 'clearLogs'
                    });
                });
                
                document.getElementById('exportLogs').addEventListener('click', () => {
                    vscode.postMessage({
                        command: 'exportLogs',
                        logs: ${JSON.stringify(logs)}
                    });
                });
            </script>
        </body>
        </html>
    `;
    
    panel.webview.onDidReceiveMessage(
        message => {
            switch (message.command) {
                case 'clearLogs':
                    clearErrorLogs();
                    showNotification('Fehlerprotokolle wurden gelöscht', 'info');
                    panel.dispose();
                    break;
                case 'exportLogs':
                    vscode.window.showSaveDialog({
                        defaultUri: vscode.Uri.file(path.join(os.homedir(), 'comitto_error_logs.json')),
                        filters: {
                            'JSON-Dateien': ['json']
                        }
                    }).then(fileUri => {
                        if (fileUri) {
                            fs.writeFileSync(fileUri.fsPath, JSON.stringify(message.logs, null, 2));
                            showNotification(`Fehlerprotokolle wurden nach ${fileUri.fsPath} exportiert`, 'info');
                        }
                    });
                    break;
            }
        },
        undefined,
        undefined
    );
}

/**
 * Hauptaktivierungsfunktion der Erweiterung.
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
    try {
        debugLog('Comitto-Erweiterung wird aktiviert', 'aktivierung', 'info');
        
        addDebugLog('Die Erweiterung "comitto" wird aktiviert.', 'info');

        // Sicherstellen, dass das Ressourcenverzeichnis existiert
        ensureResourceDirs(context);

        // UI-Komponenten registrieren
        const mainViewProvider = new ui.MainViewProvider(context);
        const logsViewProvider = new ui.LogsViewProvider(context);
        const dashboardProvider = new ui.DashboardProvider(context);
        const simpleUIProvider = new ui.SimpleUIProvider(context);
        
        // Tree Views registrieren
        const mainTreeView = vscode.window.createTreeView('comitto-main', {
            treeDataProvider: mainViewProvider,
            showCollapseAll: true
        });
        
        const logsTreeView = vscode.window.createTreeView('comitto-logs', {
            treeDataProvider: logsViewProvider,
            showCollapseAll: false
        });
        
        context.subscriptions.push(mainTreeView, logsTreeView);
        
        // UI-Provider-Objekt für die Befehle
        uiProviders = {
            mainProvider: mainViewProvider,
            logsProvider: logsViewProvider,
            dashboardProvider: dashboardProvider,
            simpleUIProvider: simpleUIProvider,
            // Für Kompatibilität mit bestehenden Befehlen
            statusProvider: mainViewProvider,
            settingsProvider: mainViewProvider,
            quickActionsProvider: mainViewProvider
        };

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
        
        if (hasGit) {
            addDebugLog('Git-Repository gefunden.', 'info');
        } else {
            addDebugLog('Kein Git-Repository gefunden. Einige Funktionen sind deaktiviert.', 'warning');
        }

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
        
        // clearLogs Command registrieren
        context.subscriptions.push(
            vscode.commands.registerCommand('comitto.clearLogs', () => {
                uiProviders.logsProvider.clearLogs();
                showNotification('Debug-Logs gelöscht', 'info');
            })
        );
        
        // .gitignore einlesen, wenn vorhanden und konfiguriert
        loadGitignore();

        // Initialen Status setzen und FileSystemWatcher/Timer ggf. starten
        const initialSettings = settings.getAll();
        if (initialSettings.autoCommitEnabled && hasGit) {
            setupFileWatcher(context, initialSettings);
            statusBarItem.text = "$(sync~spin) Comitto: Aktiv";
            addDebugLog('Comitto wurde automatisch aktiviert.', 'info');
        } else if (!hasGit) {
            statusBarItem.text = "$(warning) Comitto: Kein Git-Repo";
            statusBarItem.tooltip = "Kein Git-Repository im aktuellen Workspace gefunden";
            statusBarItem.command = undefined; // Keine Aktion bei Klick
        } else {
            statusBarItem.text = "$(git-commit) Comitto: Inaktiv";
        }

        // Debugging-Befehle registrieren
        context.subscriptions.push(
            vscode.commands.registerCommand('comitto.showErrorLogs', showErrorLogs),
            vscode.commands.registerCommand('comitto.openDebugConsole', () => {
                if (!outputChannel) {
                    outputChannel = vscode.window.createOutputChannel('Comitto Debug');
                }
                outputChannel.show();
            }),
            vscode.commands.registerCommand('comitto.diagnosticInfo', async () => {
                const info = getDiagnosticInfo();
                const panel = vscode.window.createWebviewPanel(
                    'comittoDiagnostics',
                    'Comitto Diagnose',
                    vscode.ViewColumn.One,
                    { enableScripts: true }
                );
                
                panel.webview.html = `
                    <!DOCTYPE html>
                    <html lang="de">
                    <head>
                        <meta charset="UTF-8">
                        <title>Comitto Diagnose</title>
                        <style>
                            body { padding: 20px; font-family: var(--vscode-font-family); }
                            pre { background-color: var(--vscode-editor-background); padding: 15px; }
                            button {
                                background-color: var(--vscode-button-background);
                                color: var(--vscode-button-foreground);
                                border: none;
                                padding: 8px 16px;
                                border-radius: 4px;
                                cursor: pointer;
                                margin-right: 10px;
                            }
                        </style>
                    </head>
                    <body>
                        <h1>Comitto Diagnose</h1>
                        <pre>${JSON.stringify(info, null, 2)}</pre>
                        <button id="copyBtn">In Zwischenablage kopieren</button>
                        
                        <script>
                            const vscode = acquireVsCodeApi();
                            document.getElementById('copyBtn').addEventListener('click', () => {
                                vscode.postMessage({ command: 'copy', data: ${JSON.stringify(JSON.stringify(info, null, 2))} });
                            });
                        </script>
                    </body>
                    </html>
                `;
                
                panel.webview.onDidReceiveMessage(message => {
                    if (message.command === 'copy') {
                        vscode.env.clipboard.writeText(message.data);
                        showNotification('Diagnostische Informationen in die Zwischenablage kopiert', 'info');
                    }
                });
            })
        );
        
        // Automatische Hintergrundüberwachung einrichten
        setupAutoBackgroundMonitoring(context);

        const settingsChangeDisposable = settings.onDidChange((updatedSettings) => {
            handleSettingsUpdated(context, updatedSettings);
        });
        context.subscriptions.push(settingsChangeDisposable);

        // Automatisches Cleanup von alten Log-Dateien beim Start
        cleanupOldLogFiles(7); // Dateien älter als 7 Tage löschen

        // Eventuell kurze Verzögerung für initiale UI-Aktualisierung
        setTimeout(() => {
            if (uiProviders) {
                uiProviders.statusProvider.refresh();
                uiProviders.settingsProvider.refresh();
                uiProviders.quickActionsProvider.refresh();
            }
        }, 1500);

        // Willkommensnachricht anzeigen (ohne Pop-Up, nur im Output Channel)
        showWelcomeNotification(context);

        debugLog('Comitto-Erweiterung erfolgreich aktiviert', 'aktivierung', 'info');
    } catch (error) {
        handleError(error, 'Fehler beim Aktivieren der Erweiterung', true);
    }
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
        // Nach erstem Start oder Update im Output Channel anzeigen (keine Pop-Ups)
        if (!outputChannel) {
            outputChannel = vscode.window.createOutputChannel('Comitto');
        }

        outputChannel.appendLine('═══════════════════════════════════════════════════════');
        outputChannel.appendLine(`  Comitto v${currentVersion} wurde aktiviert!`);
        outputChannel.appendLine('═══════════════════════════════════════════════════════');
        outputChannel.appendLine('');
        outputChannel.appendLine('• Konfigurieren Sie Comitto über die Seitenleiste');
        outputChannel.appendLine('• Klicken Sie auf das Comitto-Icon in der Activity Bar');
        outputChannel.appendLine('• Oder verwenden Sie das $(git-commit) Symbol in der Statusleiste');
        outputChannel.appendLine('');

        debugLog(`Comitto v${currentVersion} wurde aktiviert (vorherige Version: ${previousVersion || 'keine'})`, 'willkommen', 'info');

        // Version speichern
        context.globalState.update('comitto.version', currentVersion);
    }

    // Status im Output Channel anzeigen (keine Pop-Ups)
    const uiSettings = settings.get('uiSettings');

    if (uiSettings && uiSettings.showNotifications) {
        if (!outputChannel) {
            outputChannel = vscode.window.createOutputChannel('Comitto');
        }
        outputChannel.appendLine(`[${new Date().toLocaleTimeString('de-DE')}] ℹ️ Comitto ist bereit! Verwenden Sie die Seitenleiste oder das Symbol in der Statusleiste.`);
    }
}

/**
 * .gitignore-Datei laden und Parser erstellen
 */
function loadGitignore(settingsSnapshot = settings.getAll()) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const gitSettings = settingsSnapshot?.gitSettings || settings.get('gitSettings');
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
function setupFileWatcher(context, settingsSnapshot = settings.getAll()) {
    // Vorhandenen Watcher deaktivieren
    disableFileWatcher();

    // Neuen Watcher erstellen
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        showNotification('Comitto: Kein Workspace gefunden.', 'error');
        return;
    }

    const triggerRules = settingsSnapshot?.triggerRules || settings.get('triggerRules');
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
            const latestSettings = settings.getAll();
            if (latestSettings.autoCommitEnabled && changedFiles.size > 0) {
                const notificationSettings = latestSettings.notifications;
                if (notificationSettings.onTriggerFired) {
                    showNotification('Intervall-Trigger aktiviert. Prüfe auf ausstehende Commits...', 'info');
                }
                checkCommitTrigger();
            }
        }, intervalMs);
    }
}

function handleSettingsUpdated(context, newSettings) {
    try {
        addDebugLog('Einstellungen aktualisiert – synchronisiere Comitto.', 'info');
        loadGitignore(newSettings);

        if (newSettings.autoCommitEnabled) {
            setupFileWatcher(context, newSettings);
            if (statusBarItem) {
                statusBarItem.text = "$(sync) Comitto: Aktiv";
                statusBarItem.command = "comitto.toggleAutoCommit";
                statusBarItem.tooltip = "Comitto: Klicke zum Deaktivieren oder manuellen Commit";
            }
        } else {
            disableFileWatcher();
            if (statusBarItem) {
                statusBarItem.text = "$(git-commit) Comitto: Inaktiv";
                statusBarItem.tooltip = "Comitto ist deaktiviert";
            }
        }

        if (uiProviders) {
            uiProviders.statusProvider.refresh();
            uiProviders.settingsProvider.refresh();
            uiProviders.quickActionsProvider.refresh();
        }
    } catch (error) {
        console.error('Fehler beim Anwenden der neuen Einstellungen:', error);
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

    const rules = settings.get('triggerRules');

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

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesBranchPattern(branch, pattern) {
    if (!pattern || !branch) return false;
    if (pattern.includes('*')) {
        const regex = new RegExp(`^${pattern.split('*').map(part => escapeRegex(part)).join('.*')}$`);
        return regex.test(branch);
    }
    return branch === pattern;
}

function parseQuietRange(range) {
    if (typeof range !== 'string' || !range.includes('-')) {
        return null;
    }
    const [start, end] = range.split('-').map(part => part.trim());
    const toMinutes = (time) => {
        const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(time);
        if (!match) return null;
        return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
    };
    const startMinutes = toMinutes(start);
    const endMinutes = toMinutes(end);
    if (startMinutes === null || endMinutes === null) {
        return null;
    }
    return { start: startMinutes, end: endMinutes };
}

function isWithinQuietHours(quietHours) {
    if (!Array.isArray(quietHours) || quietHours.length === 0) {
        return false;
    }
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return quietHours.some(range => {
        const parsed = parseQuietRange(range);
        if (!parsed) return false;
        if (parsed.start <= parsed.end) {
            return currentMinutes >= parsed.start && currentMinutes <= parsed.end;
        }
        // Bereich über Mitternacht
        return currentMinutes >= parsed.start || currentMinutes <= parsed.end;
    });
}

async function evaluateGuardianPreconditions({ guardianSettings, isManualTrigger, repoPath, changedFilesSnapshot }) {
    if (!guardianSettings.smartCommitProtection || isManualTrigger) {
        return { allow: true };
    }

    if (guardianSettings.blockOnDirtyWorkspace) {
        const hasDirty = vscode.workspace.textDocuments.some(doc => doc.isDirty);
        if (hasDirty) {
            return {
                allow: false,
                message: 'Automatischer Commit abgebrochen: Es gibt ungespeicherte Dateien.',
                severity: 'warning'
            };
        }
    }

    if (guardianSettings.skipWhenDebugging && vscode.debug?.activeDebugSession) {
        return {
            allow: false,
            message: 'Automatischer Commit pausiert: Aktive Debug-Sitzung erkannt.',
            severity: 'info'
        };
    }

    if (guardianSettings.coolDownMinutes > 0 && lastCommitTime) {
        const elapsed = (Date.now() - lastCommitTime.getTime()) / 60000;
        if (elapsed < guardianSettings.coolDownMinutes) {
            const remaining = Math.max(guardianSettings.coolDownMinutes - elapsed, 0).toFixed(1);
            return {
                allow: false,
                message: `Automatischer Commit pausiert: Cooldown (${remaining} Minuten verbleibend).`,
                severity: 'info'
            };
        }
    }

    if (guardianSettings.quietHours.length > 0 && isWithinQuietHours(guardianSettings.quietHours)) {
        return {
            allow: false,
            message: 'Automatischer Commit pausiert: Ruhezeit laut Guardian-Einstellungen.',
            severity: 'info'
        };
    }

    let currentBranch = '';
    try {
        currentBranch = (await executeGitCommand('git rev-parse --abbrev-ref HEAD', repoPath)).trim();
    } catch (error) {
        console.warn('Branch konnte für Guardian-Prüfung nicht ermittelt werden:', error);
    }

    if (guardianSettings.protectedBranches.some(pattern => matchesBranchPattern(currentBranch, pattern))) {
        const proceed = await vscode.window.showWarningMessage(
            `Automatischer Commit auf geschütztem Branch '${currentBranch}'. Trotzdem ausführen?`,
            { modal: true },
            'Trotzdem committen',
            'Abbrechen'
        );
        if (proceed !== 'Trotzdem committen') {
            return {
                allow: false,
                message: `Commit auf geschütztem Branch '${currentBranch}' wurde abgebrochen.`,
                severity: 'warning'
            };
        }
    }

    if (guardianSettings.maxFilesWithoutPrompt > 0 && changedFilesSnapshot.length >= guardianSettings.maxFilesWithoutPrompt) {
        const confirmation = await vscode.window.showInformationMessage(
            `Es sind ${changedFilesSnapshot.length} Dateien geändert. Automatischen Commit wirklich ausführen?`,
            { modal: true },
            'Ja, Commit ausführen',
            'Abbrechen'
        );
        if (confirmation !== 'Ja, Commit ausführen') {
            return {
                allow: false,
                message: 'Automatischer Commit wurde aufgrund vieler Änderungen abgebrochen.',
                severity: 'warning'
            };
        }
    }

    return { allow: true, branch: currentBranch };
}

async function enforceGuardianPostDiff({ guardianSettings, isManualTrigger, diffOutput, gitStatus }) {
    if (!guardianSettings.smartCommitProtection || isManualTrigger) {
        return { allow: true };
    }

    const diffByteLength = Buffer.byteLength(diffOutput || '', 'utf8');
    const diffSizeKb = diffByteLength / 1024;

    if (guardianSettings.confirmOnLargeChanges && diffSizeKb > guardianSettings.maxDiffSizeKb) {
        const confirmation = await vscode.window.showWarningMessage(
            `Diff umfasst ca. ${diffSizeKb.toFixed(1)} KB. Automatischen Commit trotzdem durchführen?`,
            { modal: true },
            'Großen Commit bestätigen',
            'Abbrechen'
        );
        if (confirmation !== 'Großen Commit bestätigen') {
            return {
                allow: false,
                message: 'Commit abgebrochen: Diff-Größe überschreitet den Guardian-Schwellwert.',
                severity: 'warning'
            };
        }
    }

    if (guardianSettings.keywordsRequiringConfirmation.length > 0) {
        const haystack = `${diffOutput || ''}\n${gitStatus || ''}`.toLowerCase();
        const matchedKeyword = guardianSettings.keywordsRequiringConfirmation
            .map(keyword => keyword.toLowerCase())
            .find(keyword => keyword && haystack.includes(keyword));
        if (matchedKeyword) {
            const answer = await vscode.window.showWarningMessage(
                `Die Änderungen enthalten das Schlüsselwort "${matchedKeyword}". Automatischen Commit wirklich durchführen?`,
                { modal: true },
                'Ja, committen',
                'Abbrechen'
            );
            if (answer !== 'Ja, committen') {
                return {
                    allow: false,
                    message: `Commit abgebrochen: Schlüsselwort "${matchedKeyword}" erfordert Bestätigung.`,
                    severity: 'warning'
                };
            }
        }
    }

    return { allow: true };
}

/**
 * Führt den automatischen Commit-Prozess durch
 * @param {boolean} isManualTrigger Gibt an, ob der Commit manuell ausgelöst wurde
 * @param {number} retryCount Anzahl der bisherigen Versuche (für Retry-Logik)
 */
async function performAutoCommit(isManualTrigger = false, retryCount = 0) {
    // Maximale Anzahl an Wiederholungsversuchen
    const MAX_RETRIES = 3;
    
    try {
        isCommitInProgress = true;
        updateStatusBarProgress(statusBarItem, 'Commit vorbereiten', 5, 'Starte Prozess');

        // Git-Repository-Pfad bestimmen
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            throw new Error('Kein Workspace gefunden.');
        }

        const currentSettings = settings.getAll();
        const gitSettings = currentSettings.gitSettings;
        const guardianSettings = currentSettings.guardian;
        const notificationSettings = currentSettings.notifications;
        const repoPath = gitSettings.repositoryPath || workspaceFolders[0].uri.fsPath;
        
        try {
            // Prüfen, ob Git initialisiert ist
            try {
                await executeGitCommand('git rev-parse --is-inside-work-tree', repoPath);
                updateStatusBarProgress(statusBarItem, 'Commit vorbereiten', 10, 'Git-Repo geprüft');
            } catch (error) {
                throw new Error('Kein Git-Repository gefunden. Bitte initialisieren Sie zuerst ein Git-Repository.');
            }

            const changedFilesSnapshot = Array.from(changedFiles);
            let currentBranch = '';
            const guardianPreflight = await evaluateGuardianPreconditions({
                guardianSettings,
                isManualTrigger,
                repoPath,
                changedFilesSnapshot
            });

            if (!guardianPreflight.allow) {
                if (guardianPreflight.message) {
                    showNotification(guardianPreflight.message, guardianPreflight.severity || 'info');
                }
                updateStatusBarProgress(statusBarItem, 'Überwacht', 100, 'Guardian aktiv');
                isCommitInProgress = false;
                return;
            }

            currentBranch = guardianPreflight.branch || '';
            
            // Dateien zum Staging hinzufügen
            try {
                updateStatusBarProgress(statusBarItem, 'Änderungen stagen', 20, gitSettings.stageMode);
                await stageChanges(gitSettings.stageMode);
                updateStatusBarProgress(statusBarItem, 'Staging abgeschlossen', 30);
            } catch (stageError) {
                console.error('Fehler beim Stagen der Änderungen:', stageError);
                showNotification(`Fehler beim Stagen: ${stageError.message}. Versuche Fallback-Methode...`, 'warning');
                
                // Fallback: Alle Änderungen stagen
                await executeGitCommand('git add .', repoPath);
                updateStatusBarProgress(statusBarItem, 'Staging (Fallback)', 30);
            }
            
            // git status ausführen, um Änderungen zu erhalten
            let gitStatus = '';
            try {
                updateStatusBarProgress(statusBarItem, 'Status abrufen', 35);
                gitStatus = await executeGitCommand('git status --porcelain', repoPath);
            } catch (statusError) {
                // Wenn git status fehlschlägt, versuchen wir es trotzdem weiter
                console.warn('Fehler bei git status, versuche trotzdem fortzufahren:', statusError);
                gitStatus = "Fehler beim Abrufen des Status. Commit wird trotzdem versucht.";
            }
            
            if (!gitStatus.trim() && !isManualTrigger) {
                isCommitInProgress = false;
                updateStatusBarProgress(statusBarItem, 'Keine Änderungen', 100);
                changedFiles.clear();
                return;
            } else if (!gitStatus.trim() && isManualTrigger) {
                throw new Error('Keine Änderungen zum Committen gefunden.');
            }

            // Änderungen abrufen für KI-Commit-Nachricht
            let diffOutput = '';
            try {
                updateStatusBarProgress(statusBarItem, 'Diff berechnen', 40);
                diffOutput = await executeGitCommand('git diff --cached', repoPath);
                updateStatusBarProgress(statusBarItem, 'Diff berechnet', 50);
            } catch (diffError) {
                // Bei Pufferüberlauf oder anderen Diff-Fehlern trotzdem weitermachen
                console.warn('Fehler beim Abrufen des Diffs, versuche alternative Methode:', diffError);
                
                try {
                    // Nur Liste der geänderten Dateien abrufen
                    updateStatusBarProgress(statusBarItem, 'Diff (Alternative)', 45);
                    const fileList = await executeGitCommand('git diff --cached --name-status', repoPath);
                    diffOutput = 'Diff konnte nicht vollständig abgerufen werden.\nGeänderte Dateien:\n' + fileList;
                    updateStatusBarProgress(statusBarItem, 'Diff (Alternativ) berechnet', 50);
                } catch (fileListError) {
                    console.error('Auch die Dateiliste konnte nicht abgerufen werden:', fileListError);
                    diffOutput = 'Diff-Inhalt konnte nicht abgerufen werden. Commit wird trotzdem versucht.';
                }
            }

            const guardianPostCheck = await enforceGuardianPostDiff({
                guardianSettings,
                isManualTrigger,
                diffOutput,
                gitStatus
            });

            if (!guardianPostCheck.allow) {
                if (guardianPostCheck.message) {
                    showNotification(guardianPostCheck.message, guardianPostCheck.severity || 'info');
                }
                updateStatusBarProgress(statusBarItem, 'Überwacht', 100, 'Guardian aktiv');
                isCommitInProgress = false;
                return;
            }
            
            // Commit-Nachricht generieren
            let commitMessage = '';
            updateStatusBarProgress(statusBarItem, 'Generiere Commit-Nachricht', 50);
            
            try {
                // KI-Funktionen übergeben
                commitMessage = await commands.generateCommitMessage(gitStatus, diffOutput, 
                    generateWithOllama, generateWithOpenAI, generateWithAnthropic);
                updateStatusBarProgress(statusBarItem, 'Commit-Nachricht generiert', 75);
            } catch (messageError) {
                console.error('Fehler bei der Commit-Nachricht-Generierung:', messageError);
                updateStatusBarProgress(statusBarItem, 'Fallback-Nachricht', 70);
                
                // Fallback-Nachricht mit Datum
                const now = new Date();
                const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                
                const language = gitSettings.commitMessageLanguage || 'en';
                const style = gitSettings.commitMessageStyle || 'conventional';
                
                if (language === 'de') {
                    commitMessage = style === 'conventional' ? 
                        `chore: Automatischer Commit vom ${dateStr} ${timeStr}` : 
                        `💾 Automatischer Commit vom ${dateStr} ${timeStr}`;
                } else {
                    commitMessage = style === 'conventional' ? 
                        `chore: automatic commit ${dateStr} ${timeStr}` : 
                        `💾 Automatic commit ${dateStr} ${timeStr}`;
                }
            }
            
            if (!commitMessage || commitMessage.trim().length === 0) {
                commitMessage = "chore: auto commit";
            }
            
            // Branch-Handling
            try {
                if (gitSettings.branch) {
                    updateStatusBarProgress(statusBarItem, 'Branch prüfen', 80);
                    
                    // Aktuellen Branch bestimmen (ggf. aus Guardian-Check wiederverwenden)
                    if (!currentBranch) {
                        currentBranch = (await executeGitCommand('git rev-parse --abbrev-ref HEAD', repoPath)).trim();
                    }
                    
                    // Nur wechseln, wenn nicht bereits auf dem Ziel-Branch
                    if (currentBranch !== gitSettings.branch) {
                        // Prüfen, ob der Branch existiert
                        const branches = await executeGitCommand('git branch', repoPath);
                        const branchExists = branches.includes(gitSettings.branch);
                        
                        if (branchExists) {
                            // Zu existierendem Branch wechseln
                            try {
                                updateStatusBarProgress(statusBarItem, `Wechsle zu ${gitSettings.branch}`, 82);
                                await executeGitCommand(`git checkout ${gitSettings.branch}`, repoPath);
                                showNotification(`Zu Branch '${gitSettings.branch}' gewechselt.`, 'info');
                            } catch (checkoutError) {
                                // Fehler beim Checkout - möglicherweise ungespeicherte Änderungen
                                updateStatusBarProgress(statusBarItem, 'Branch-Wechsel fehlgeschlagen', -1);
                                showNotification(`Fehler beim Wechseln zu Branch '${gitSettings.branch}': ${checkoutError.message}. Fortfahren mit aktuellem Branch.`, 'warning');
                            }
                        } else {
                            // Neuen Branch erstellen und wechseln
                            try {
                                updateStatusBarProgress(statusBarItem, `Erstelle Branch ${gitSettings.branch}`, 82);
                                await executeGitCommand(`git checkout -b ${gitSettings.branch}`, repoPath);
                                showNotification(`Branch '${gitSettings.branch}' erstellt und ausgecheckt.`, 'info');
                            } catch (createBranchError) {
                                updateStatusBarProgress(statusBarItem, 'Branch-Erstellung fehlgeschlagen', -1);
                                showNotification(`Fehler beim Erstellen des Branches '${gitSettings.branch}': ${createBranchError.message}. Fortfahren mit aktuellem Branch.`, 'warning');
                            }
                        }
                    }
                }
            } catch (branchError) {
                console.error('Fehler beim Branch-Handling:', branchError);
                showNotification(`Fehler bei der Branch-Verwaltung: ${branchError.message}. Fortfahren mit aktuellem Branch.`, 'warning');
            }
            
            // Git Commit durchführen
            updateStatusBarProgress(statusBarItem, 'Führe Commit aus', 90);
            
            try {
                // Escapte Anführungszeichen für Shell
                const escapedMessage = commitMessage.replace(/"/g, '\\"').replace(/`/g, "'");
                await executeGitCommand(`git commit -m "${escapedMessage}"`, repoPath);
                updateStatusBarProgress(statusBarItem, 'Commit abgeschlossen', 95);
                
                // Benachrichtigungen anzeigen basierend auf den Einstellungen
                if (!isManualTrigger && notificationSettings.onCommit) {
                    showNotification(`Automatischer Commit durchgeführt: ${commitMessage}`, 'info');
                } else if (isManualTrigger) {
                    showNotification(`Manueller Commit durchgeführt: ${commitMessage}`, 'info');
                }
                
                // Reset der Änderungsverfolgung
                lastCommitTime = new Date();
                changedFiles.clear();
            } catch (commitError) {
                console.error('Commit fehlgeschlagen:', commitError);
                
                // Wenn nichts zum Committen da ist, ist das kein echter Fehler
                if (commitError.message.includes('nothing to commit')) {
                    updateStatusBarProgress(statusBarItem, 'Keine Änderungen', 100);
                    showNotification('Keine Änderungen zum Committen gefunden.', 'info');
                    isCommitInProgress = false;
                    changedFiles.clear();
                    return;
                }
                
                // Bei anderen Fehlern versuchen, es noch einmal
                if (retryCount < MAX_RETRIES) {
                    updateStatusBarProgress(statusBarItem, 'Commit fehlgeschlagen, neuer Versuch', 85);
                    showNotification(`Commit fehlgeschlagen: ${commitError.message}. Versuche es erneut...`, 'warning');
                    setTimeout(() => {
                        performAutoCommit(isManualTrigger, retryCount + 1);
                    }, 2000); // 2 Sekunden Verzögerung vor dem Retry
                    return;
                } else {
                    updateStatusBarProgress(statusBarItem, 'Commit endgültig fehlgeschlagen', -1);
                    throw new Error(`Commit fehlgeschlagen nach ${MAX_RETRIES} Versuchen: ${commitError.message}`);
                }
            }
            
            // Automatischen Push ausführen, wenn konfiguriert
            if (gitSettings.autoPush) {
                try {
                    updateStatusBarProgress(statusBarItem, 'Push ausführen', 97);
                    await performAutoPush(repoPath);
                    updateStatusBarProgress(statusBarItem, 'Push abgeschlossen', 100);
                } catch (pushError) {
                    console.error('Push fehlgeschlagen:', pushError);
                    updateStatusBarProgress(statusBarItem, 'Push fehlgeschlagen', -1);
                    showNotification(`Push fehlgeschlagen: ${pushError.message}`, 'error');
                }
            } else {
                updateStatusBarProgress(statusBarItem, 'Vorgang abgeschlossen', 100);
            }
        } catch (error) {
            console.error('Git-Befehl fehlgeschlagen:', error);
            updateStatusBarProgress(statusBarItem, 'Git-Fehler', -1);
            
            // Fehlerbehandlung verbessern
            let errorMessage = error.message;
            if (errorMessage.includes('fatal: not a git repository')) {
                errorMessage = 'Dieses Verzeichnis ist kein Git-Repository. Bitte initialisieren Sie zuerst ein Git-Repository.';
            } else if (errorMessage.includes('fatal: unable to access')) {
                errorMessage = 'Fehler beim Zugriff auf das Remote-Repository. Bitte prüfen Sie Ihre Netzwerkverbindung und Zugangsrechte.';
            } else if (errorMessage.includes('maxBuffer') || errorMessage.includes('zu groß')) {
                errorMessage = 'Zu viele oder zu große Änderungen für die automatische Verarbeitung. Bitte führen Sie einen manuellen Commit durch oder reduzieren Sie die Anzahl der Änderungen.';
            }
            
            // Benachrichtigung anzeigen
            if (notificationSettings.onError) {
                showNotification(`Git-Befehl fehlgeschlagen: ${errorMessage}`, 'error');
            }
            
            throw error;
        }
    } catch (error) {
        console.error('Comitto Fehler:', error);
        updateStatusBarProgress(statusBarItem, 'Fehler', -1);
        
        // Benachrichtigung anzeigen
        const fallbackNotifications = settings.get('notifications');
        if (fallbackNotifications.onError) {
            showNotification(`Comitto Fehler: ${error.message}`, 'error');
        }
    } finally {
        isCommitInProgress = false;
    }
}

/**
 * Führt einen automatischen Push durch
 * @param {string} repoPath Der Pfad zum Git-Repository
 */
async function performAutoPush(repoPath) {
    const currentSettings = settings.getAll();
    const notificationSettings = currentSettings.notifications;
    const MAX_PUSH_RETRIES = 2;
    
    statusBarItem.text = "$(sync~spin) Comitto: Pushe Änderungen...";
    
    // Aktuelle Branch bestimmen
    let currentBranch;
    try {
        currentBranch = (await executeGitCommand('git rev-parse --abbrev-ref HEAD', repoPath)).trim();
    } catch (error) {
        throw new Error(`Fehler beim Ermitteln des aktuellen Branches: ${error.message}`);
    }
    
    // Push-Optionen basierend auf Einstellungen
    const gitSettings = currentSettings.gitSettings;
    const pushOptions = gitSettings.pushOptions || '';
    const pushCommand = `git push origin ${currentBranch} ${pushOptions}`.trim();
    
    let pushSuccess = false;
    let pushError = null;
    
    // Versuche es mehrfach mit Push
    for (let i = 0; i <= MAX_PUSH_RETRIES; i++) {
        try {
            await executeGitCommand(pushCommand, repoPath);
            pushSuccess = true;
            break;
        } catch (error) {
            pushError = error;
            console.warn(`Push-Versuch ${i+1} fehlgeschlagen:`, error);
            
            // Bei bestimmten Fehlern erneut versuchen
            if (error.message.includes('Connection timed out') || 
                error.message.includes('Could not resolve host') ||
                error.message.includes('failed to push some refs')) {
                
                // Kurze Pause vor dem nächsten Versuch
                if (i < MAX_PUSH_RETRIES) {
                    await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
                    continue;
                }
            }
            
            // Bei anderen Fehlern oder nach allen Versuchen abbrechen
            break;
        }
    }
    
    // Ergebnis verarbeiten
    if (pushSuccess) {
        if (notificationSettings.onPush) {
            showNotification(`Änderungen wurden zu origin/${currentBranch} gepusht.`, 'info');
        }
    } else if (pushError) {
        // Versuche ein Pull bei bestimmten Fehlern
        if (pushError.message.includes('failed to push some refs') || 
            pushError.message.includes('rejected') ||
            pushError.message.includes('non-fast-forward')) {
            
            try {
                showNotification('Push fehlgeschlagen. Versuche Pull...', 'warning');
                await executeGitCommand(`git pull origin ${currentBranch}`, repoPath);
                
                // Erneut versuchen zu pushen
                await executeGitCommand(pushCommand, repoPath);
                
                if (notificationSettings.onPush) {
                    showNotification(`Pull & Push erfolgreich: Änderungen wurden zu origin/${currentBranch} gepusht.`, 'info');
                }
            } catch (pullError) {
                throw new Error(`Push fehlgeschlagen und Pull konnte nicht ausgeführt werden: ${pullError.message}`);
            }
        } else {
            throw pushError;
        }
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
    
    const gitSettings = settings.get('gitSettings');
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
 * Zeigt eine Benachrichtigung an, wenn entsprechend konfiguriert,
 * und fügt sie immer zum Debug-Log hinzu
 * @param {string} message Die anzuzeigende Nachricht
 * @param {string} type Der Typ der Nachricht (info, warning, error)
 */
function showNotification(message, type = 'info') {
    const uiSettings = settings.get('uiSettings');

    // Zum Debug-Log hinzufügen
    addDebugLog(message, type);

    // Benachrichtigung im Output Channel anzeigen (keine Pop-Ups mehr)
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel('Comitto');
    }

    const timestamp = new Date().toLocaleTimeString('de-DE');
    const typeIcon = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
    outputChannel.appendLine(`[${timestamp}] ${typeIcon} ${message}`);

    // Bei Fehlern Output Channel automatisch anzeigen
    if (type === 'error') {
        outputChannel.show(true);
    }

    // Status Bar kurz aktualisieren für wichtige Nachrichten
    if (statusBarItem && (type === 'error' || type === 'warning')) {
        const originalText = statusBarItem.text;
        const originalTooltip = statusBarItem.tooltip;
        statusBarItem.text = type === 'error' ? '$(error) Comitto: Fehler' : '$(warning) Comitto: Warnung';
        statusBarItem.tooltip = message;

        // Nach 5 Sekunden zurücksetzen
        setTimeout(() => {
            if (statusBarItem) {
                statusBarItem.text = originalText;
                statusBarItem.tooltip = originalTooltip;
            }
        }, 5000);
    }

}

/**
 * Bereinigt alte Log-Dateien und benachrichtigt den User im Output Channel
 * @param {number} maxAgeDays - Maximales Alter der Log-Dateien in Tagen (Standard: 7)
 */
function cleanupOldLogFiles(maxAgeDays = 7) {
    try {
        const logDir = path.join(os.homedir(), '.comitto', 'logs');

        if (!fs.existsSync(logDir)) {
            debugLog('Log-Verzeichnis existiert nicht, kein Cleanup erforderlich', 'cleanup', 'info');
            return;
        }

        const files = fs.readdirSync(logDir);
        const now = Date.now();
        const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
        let deletedCount = 0;
        const deletedFiles = [];

        for (const file of files) {
            if (file.endsWith('.log')) {
                const filePath = path.join(logDir, file);
                const stats = fs.statSync(filePath);
                const fileAge = now - stats.mtimeMs;

                if (fileAge > maxAgeMs) {
                    fs.unlinkSync(filePath);
                    deletedFiles.push(file);
                    deletedCount++;
                    debugLog(`Alte Log-Datei gelöscht: ${file} (Alter: ${Math.floor(fileAge / (24 * 60 * 60 * 1000))} Tage)`, 'cleanup', 'info');
                }
            }
        }

        if (deletedCount > 0) {
            const message = `${deletedCount} alte Log-Datei(en) automatisch gelöscht: ${deletedFiles.join(', ')}`;
            debugLog(message, 'cleanup', 'info');
            showNotification(message, 'info');
        } else {
            debugLog('Keine alten Log-Dateien zum Löschen gefunden', 'cleanup', 'info');
        }
    } catch (error) {
        debugLog(`Fehler beim Bereinigen der Log-Dateien: ${error.message}`, 'cleanup', 'error');
        console.error('Log-Cleanup-Fehler:', error);
    }
}

/**
 * @param {string} gitStatus Die Ausgabe von git status
 * @param {string} diffOutput Die Ausgabe von git diff
 * @returns {Promise<string>} Generierte Commit-Nachricht
 */
async function generateCommitMessage(gitStatus, diffOutput) {
    const aiProvider = settings.get('aiProvider');
    const gitSettings = settings.get('gitSettings');
    
    // SCHRITT 1: Dateiliste mit Status erstellen (IMMER verfügbar für die KI)
    let fileList = '';
    let fileCount = 0;
    
    if (gitStatus && gitStatus.trim()) {
        const statusLines = gitStatus.split('\n').filter(line => line.trim().length > 0);
        fileCount = statusLines.length;
        
        fileList = statusLines.map(line => {
            const status = line.substring(0, 2).trim();
            const filePath = line.substring(3).trim();
            
            // Status in lesbaren Text umwandeln
            let statusText = '';
            const firstChar = status.charAt(0);
            const secondChar = status.charAt(1);
            
            if (firstChar === 'M' || secondChar === 'M') statusText = 'Geändert';
            else if (firstChar === 'A') statusText = 'Neu hinzugefügt';
            else if (firstChar === 'D') statusText = 'Gelöscht';
            else if (firstChar === 'R') statusText = 'Umbenannt';
            else if (firstChar === 'C') statusText = 'Kopiert';
            else if (status === '??') statusText = 'Neue Datei (untracked)';
            else statusText = `Status: ${status}`;
            
            return `${statusText}: ${filePath}`;
        }).join('\n');
    }
    
    // SCHRITT 2: Basis-Prompt mit Dateiliste erstellen
    let promptTemplate = settings.get('promptTemplate') || 
        'Generiere eine aussagekräftige Commit-Nachricht basierend auf den folgenden Änderungen.\n\n{changes}';
    
    // Dateiliste in den Prompt einfügen
    const changesSection = fileList || 'Keine spezifischen Dateiänderungen erkannt.';
    promptTemplate = promptTemplate.replace('{changes}', changesSection);
    
    // SCHRITT 3: Sprache hinzufügen
    const language = gitSettings.commitMessageLanguage || 'de';
    if (!promptTemplate.toLowerCase().includes(language)) {
        const languageInstruction = language === 'de' ? 
            '\nDie Commit-Nachricht soll auf DEUTSCH sein.' :
            language === 'en' ? '\nThe commit message should be in ENGLISH.' :
            `\nDie Commit-Nachricht soll auf ${language.toUpperCase()} sein.`;
        promptTemplate += languageInstruction;
    }
    
    // SCHRITT 4: Commit-Stil hinzufügen
    const style = gitSettings.commitMessageStyle || 'conventional';
    let styleInstruction = '';
    
    switch (style) {
        case 'conventional':
            styleInstruction = '\nVerwende das Conventional Commits Format (feat:, fix:, docs:, style:, refactor:, test:, chore:, etc.).';
            break;
        case 'gitmoji':
            styleInstruction = '\nVerwende Gitmoji-Emojis am Anfang der Commit-Nachricht (🎉 für neue Features, 🐛 für Bugfixes, 📚 für Dokumentation, 💄 für Styling, etc.).';
            break;
        case 'angular':
            styleInstruction = '\nVerwende das Angular Commit Convention Format: type(scope): description.';
            break;
        case 'atom':
            styleInstruction = '\nVerwende das Atom Editor Commit Format: :emoji: description.';
            break;
        case 'simple':
            styleInstruction = '\nVerwende einfache, klare und beschreibende Commit-Nachrichten ohne spezifisches Format.';
            break;
    }
    
    if (styleInstruction && !promptTemplate.includes(styleInstruction.toLowerCase())) {
        promptTemplate += styleInstruction;
    }
    
    // SCHRITT 5: Entscheiden, ob Diff-Inhalt hinzugefügt werden soll
    const MAX_REASONABLE_DIFF_LENGTH = 1500; // Schwellwert für "angemessene" Diff-Größe
    const MAX_DIFF_INCLUDED = 800; // Maximale Diff-Länge, die tatsächlich hinzugefügt wird
    
    let shouldIncludeDiff = false;
    let diffSnippet = '';
    
    if (diffOutput && diffOutput.trim()) {
        // Entscheidungslogik: Diff nur bei überschaubarer Größe hinzufügen
        if (diffOutput.length <= MAX_REASONABLE_DIFF_LENGTH) {
            shouldIncludeDiff = true;
            diffSnippet = diffOutput;
        } else if (fileCount <= 3) {
            // Bei wenigen Dateien: gekürzten Diff hinzufügen
            shouldIncludeDiff = true;
            diffSnippet = diffOutput.substring(0, MAX_DIFF_INCLUDED) + 
                `\n\n[Diff gekürzt - Insgesamt ${diffOutput.length} Zeichen in ${fileCount} Datei(en)]`;
        }
        // Bei vielen Dateien oder sehr großem Diff: nur Dateiliste verwenden
    }
    
    // SCHRITT 6: Diff-Inhalt hinzufügen (falls angemessen)
    if (shouldIncludeDiff && diffSnippet) {
        promptTemplate += `\n\nHier sind die konkreten Änderungen für besseren Kontext:\n\n${diffSnippet}`;
    } else if (diffOutput && diffOutput.length > MAX_REASONABLE_DIFF_LENGTH) {
        // Erklärung, warum kein Diff-Inhalt hinzugefügt wurde
        promptTemplate += `\n\nHinweis: ${fileCount} Datei(en) mit umfangreichen Änderungen (${diffOutput.length} Zeichen). ` +
            `Generiere die Commit-Nachricht basierend auf der Dateiliste und den erkennbaren Änderungsmustern.`;
    }
    
    // SCHRITT 7: Längen-Begrenzung für die Commit-Nachricht
    promptTemplate += '\n\nBitte halte die Commit-Nachricht unter 72 Zeichen und mache sie aussagekräftig und prägnant.';
    
    // SCHRITT 8: Debug-Ausgabe
    console.log(`Commit-Nachricht wird generiert für ${fileCount} Datei(en), Diff-Größe: ${diffOutput?.length || 0} Zeichen, Diff hinzugefügt: ${shouldIncludeDiff}`);
    addDebugLog(`Generiere Commit für ${fileCount} Dateien (${diffOutput?.length || 0} Zeichen Diff), Provider: ${aiProvider}`, 'info');
    
    // SCHRITT 9: KI-Provider aufrufen
    let generatedMessage = '';
    try {
        switch (aiProvider) {
            case 'ollama':
                generatedMessage = await generateWithOllama(promptTemplate);
                break;
            case 'openai':
                generatedMessage = await generateWithOpenAI(promptTemplate);
                break;
            case 'anthropic':
                generatedMessage = await generateWithAnthropic(promptTemplate);
                break;
            default:
                throw new Error(`Unbekannter KI-Provider: ${aiProvider}`);
        }
        
        // SCHRITT 10: Nachricht verarbeiten und zurückgeben
        if (typeof generatedMessage === 'string') {
            // Nachricht bereinigen
            generatedMessage = generatedMessage.trim();
            // Anführungszeichen entfernen, falls vorhanden
            generatedMessage = generatedMessage.replace(/^["']|["']$/g, '');
            // Auf die erste Zeile beschränken, wenn sinnvoll
            const firstLine = generatedMessage.split('\n')[0];
            if (firstLine && firstLine.length > 5) {
                generatedMessage = firstLine;
            }
            // Auf 72 Zeichen beschränken (Git-Konvention)
            if (generatedMessage.length > 72) {
                const truncated = generatedMessage.substring(0, 69) + '...';
                console.log(`Commit-Nachricht von ${generatedMessage.length} auf ${truncated.length} Zeichen gekürzt`);
                generatedMessage = truncated;
            }
            
            // Erfolgreiche Generierung protokollieren
            addDebugLog(`Commit-Nachricht erfolgreich generiert: "${generatedMessage}" (${generatedMessage.length} Zeichen)`, 'success');
            
            return generatedMessage;
        } else {
            throw new Error('Commit-Nachricht konnte nicht generiert werden: Ungültiges Format');
        }
    } catch (error) {
        console.error('Fehler beim Generieren der Commit-Nachricht:', error);
        addDebugLog(`Fehler bei Commit-Generierung: ${error.message}`, 'error');
        
        // FALLBACK: Intelligente Standard-Nachricht basierend auf Dateiliste
        let fallbackMessage = 'chore: update files';
        
        if (fileList) {
            const hasNewFiles = fileList.includes('Neu hinzugefügt') || fileList.includes('Neue Datei');
            const hasModifiedFiles = fileList.includes('Geändert');
            const hasDeletedFiles = fileList.includes('Gelöscht');
            
            if (hasNewFiles && !hasModifiedFiles && !hasDeletedFiles) {
                fallbackMessage = fileCount === 1 ? 'feat: add new file' : `feat: add ${fileCount} new files`;
            } else if (hasDeletedFiles && !hasModifiedFiles && !hasNewFiles) {
                fallbackMessage = fileCount === 1 ? 'chore: remove file' : `chore: remove ${fileCount} files`;
            } else if (hasModifiedFiles && !hasNewFiles && !hasDeletedFiles) {
                fallbackMessage = fileCount === 1 ? 'fix: update file' : `fix: update ${fileCount} files`;
            } else {
                fallbackMessage = `chore: update ${fileCount} files`;
            }
            
            // Sprachabhängige Fallback-Nachrichten
            if (language === 'de') {
                fallbackMessage = fallbackMessage
                    .replace('add new file', 'neue Datei hinzugefügt')
                    .replace('add', 'hinzufügen')
                    .replace('remove file', 'Datei entfernt')
                    .replace('remove', 'entfernen')
                    .replace('update file', 'Datei aktualisiert')
                    .replace('update', 'aktualisieren')
                    .replace('files', 'Dateien')
                    .replace('file', 'Datei');
            }
        }
        
        addDebugLog(`Verwende Fallback-Commit-Nachricht: "${fallbackMessage}"`, 'warning');
        return fallbackMessage;
    }
}

/**
 * Richtet eine automatische Hintergrundüberwachung ein
 * @param {vscode.ExtensionContext} context 
 */
function setupAutoBackgroundMonitoring(context) {
    // Überwachung für Git-Status (alle 10 Minuten)
    setInterval(async () => {
        try {
            const currentSettings = settings.getAll();
            if (!currentSettings.autoCommitEnabled) return;
            
            const debugSettings = currentSettings.debug || {};
            
            // Git-Repository-Status prüfen
            const hasGit = await checkGitRepository(context);
            if (!hasGit) {
                addDebugLog('Hintergrundprüfung: Kein aktives Git-Repository gefunden.', 'warning');
                return;
            }
            
            // Prüfen, ob ungespeicherte Änderungen vorliegen, die noch nicht committed wurden
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) return;
            
            const repoPath = workspaceFolders[0].uri.fsPath;
            const gitStatus = await executeGitCommand('git status --porcelain', repoPath);
            
            if (gitStatus.trim() && changedFiles.size === 0) {
                // Es gibt Änderungen, die nicht in changedFiles erfasst wurden
                addDebugLog('Hintergrundprüfung: Nicht erfasste Änderungen gefunden.', 'info');
                
                // Dateien dem Tracking hinzufügen
                gitStatus.split('\n')
                    .filter(line => line.trim().length > 0)
                    .forEach(line => {
                        const filePath = line.substring(3).trim();
                        if (filePath && !isFileIgnored(filePath)) {
                            // Relativen Pfad erstellen, sicherstellen dass dieser valide ist
                            const absolutePath = path.resolve(repoPath, filePath);
                            changedFiles.add(absolutePath);
                        }
                    });
                
                if (debugSettings.extendedLogging) {
                    addDebugLog(`Hintergrund-Synchronisierung: ${changedFiles.size} Dateien werden nun überwacht.`, 'info');
                }
                
                // Trigger-Check ausführen
                if (currentSettings.autoCommitEnabled) {
                    checkCommitTrigger();
                }
            }
        } catch (error) {
            console.error('Fehler bei der Hintergrundüberwachung:', error);
            addDebugLog(`Fehler bei der Hintergrundüberwachung: ${error.message}`, 'error');
        }
    }, 10 * 60 * 1000); // 10 Minuten
    
    // Regelmäßiger Gesundheitscheck
    setInterval(() => {
        try {
            const currentSettings = settings.getAll();
            if (!currentSettings.autoCommitEnabled) return;
            
            const debugSettings = currentSettings.debug || {};
            
            // Prüfen, ob der Watcher noch aktiv ist
            if (!fileWatcher && currentSettings.autoCommitEnabled) {
                addDebugLog('Gesundheitscheck: FileWatcher ist nicht aktiv. Starte neu...', 'warning');
                setupFileWatcher(context, currentSettings);
            }
            
            // Prüfen, ob der Interval-Timer noch aktiv ist
            const triggerRules = currentSettings.triggerRules;
            if (triggerRules.onInterval && !intervalTimer && currentSettings.autoCommitEnabled) {
                addDebugLog('Gesundheitscheck: Interval-Timer ist nicht aktiv. Starte neu...', 'warning');
                setupIntervalTrigger(triggerRules.intervalMinutes);
            }
            
            if (debugSettings.extendedLogging) {
                addDebugLog('Gesundheitscheck durchgeführt.', 'info');
            }
        } catch (error) {
            console.error('Fehler beim Gesundheitscheck:', error);
            addDebugLog(`Fehler beim Gesundheitscheck: ${error.message}`, 'error');
        }
    }, 30 * 60 * 1000); // 30 Minuten
}

function deactivate() {
    if (intervalTimer) {
        clearInterval(intervalTimer);
    }
    
    // Alle Ressourcen löschen
    if (statusBarItem) {
        statusBarItem.dispose();
    }
    
    if (fileWatcher) {
        fileWatcher.dispose();
    }
    
    if (outputChannel) {
        outputChannel.dispose();
    }
    
    return undefined;
}

/**
 * Generiert eine Commit-Nachricht mit Ollama
 * @param {string} prompt Der zu verwendende Prompt
 * @returns {Promise<string>} Generierte Commit-Nachricht
 */
async function generateWithOllama(prompt) {
    let ollamaConfig = { ...settings.get('ollama') };
    let model = ollamaConfig.model;
    const endpoint = ollamaConfig.endpoint || 'http://localhost:11434/api/generate';

    const legacyModel = settings.getLegacyValue('ollama-model');
    if (!model && legacyModel) {
        model = legacyModel;
        ollamaConfig.model = legacyModel;
        try {
            await settings.update('ollama', ollamaConfig);
            await settings.update('ollama-model', undefined);
            showNotification('Korrektur der Ollama-Modell-Konfiguration durchgeführt.', 'info');
        } catch (migrationError) {
            console.warn('Migration der Ollama-Konfiguration fehlgeschlagen:', migrationError);
        }
    }

    // Fallback, falls kein Modell konfiguriert ist
    model = model || 'granite3.3:2b';
    
    try {
        // Statusleiste aktualisieren
        updateStatusBarProgress(statusBarItem, 'Ollama generiert', 0, `Modell: ${model}`);
        showNotification(`KI-Nachricht wird mit Ollama (${model}) generiert...`, 'info', false);
        
        console.log(`Verwende Ollama-Modell: ${model} auf ${endpoint}`);
        
        // HTTP-Anfrage vorbereiten und Startzeit messen
        const requestStart = Date.now();
        
        // Prüfen, ob der Endpunkt /api/generate enthält - verschiedene API-Pfade
        const apiEndpoint = endpoint.endsWith('/api/generate') ? endpoint : 
                         (endpoint.endsWith('/') ? `${endpoint}api/generate` : `${endpoint}/api/generate`);
        
        const response = await axios.post(apiEndpoint, {
            model: model,
            prompt: prompt,
            stream: false,
            options: {
                temperature: 0.3,
                num_predict: 100
            }
        });
        
        const requestDuration = ((Date.now() - requestStart) / 1000).toFixed(2);
        updateStatusBarProgress(statusBarItem, 'Ollama generiert', 100, `Fertig in ${requestDuration}s`);
        
        if (response.data && typeof response.data.response === 'string') {
            let commitMessage = response.data.response.trim();
            
            // Debugging-Informationen
            const evalDuration = response.data.eval_duration ? 
                (response.data.eval_duration / 1000000000).toFixed(2) + 's' : 'n/a';
            const totalDuration = response.data.total_duration ? 
                (response.data.total_duration / 1000000000).toFixed(2) + 's' : requestDuration + 's';
            
            console.log(`Ollama-Antwort erhalten. Eval-Zeit: ${evalDuration}, Gesamt-Zeit: ${totalDuration}`);
            showNotification(`Commit-Nachricht mit Ollama generiert (${totalDuration}).`, 'info', false);
            
            return commitMessage;
        } else {
            throw new Error('Unerwartetes Antwortformat von Ollama');
        }
    } catch (error) {
        console.error('Ollama API-Fehler:', error.response?.data || error.message);
        
        // Statusleiste aktualisieren
        updateStatusBarProgress(statusBarItem, 'Ollama-Fehler', -1);
        
        // Detaillierte Fehlermeldung
        let errorMessage = 'Fehler bei der Kommunikation mit Ollama';
        
        if (error.code === 'ECONNREFUSED') {
            errorMessage = 'Verbindung zu Ollama fehlgeschlagen. Bitte stellen Sie sicher, dass Ollama läuft und erreichbar ist.';
        } else if (error.code === 'ETIMEDOUT' || error.code === 'TIMEOUT') {
            errorMessage = 'Zeitüberschreitung bei der Anfrage an Ollama. Bitte prüfen Sie die Verbindung oder versuchen Sie ein kleineres Modell.';
        } else if (error.response?.status === 404) {
            errorMessage = `Das Ollama-Modell "${model}" wurde nicht gefunden. Bitte stellen Sie sicher, dass das Modell installiert ist.`;
            
            // Zusätzliche Hilfe zur Installation anbieten
            showNotification(`Modell "${model}" nicht gefunden. Installieren Sie es mit: ollama pull ${model}`, 'warning');
        } else if (error.response?.data) {
            errorMessage = `Ollama-Fehler: ${error.response.data.error || JSON.stringify(error.response.data)}`;
        } else {
            errorMessage = `Ollama-Fehler: ${error.message}`;
        }
        
        showNotification(errorMessage, 'error');
        
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
    const openaiSettings = settings.get('openai');
    const apiKey = openaiSettings.apiKey;
    const model = openaiSettings.model || 'gpt-4.1-mini';
    
    if (!apiKey) {
        throw new Error('OpenAI API-Schlüssel nicht konfiguriert');
    }
    
    try {
        updateStatusBarProgress(statusBarItem, 'OpenAI generiert', 20, `Modell: ${model}`);
        showNotification(`KI-Nachricht wird mit OpenAI (${model}) generiert...`, 'info', false);
        
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
        
        updateStatusBarProgress(statusBarItem, 'OpenAI generiert', 100, 'Fertig');
        
        if (response.data && response.data.choices && response.data.choices[0]) {
            return response.data.choices[0].message.content.trim()
                .replace(/^["']|["']$/g, '')
                .replace(/\n/g, ' ');
        } else {
            throw new Error('Unerwartetes Antwortformat von OpenAI');
        }
    } catch (error) {
        updateStatusBarProgress(statusBarItem, 'OpenAI-Fehler', -1);
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
    const anthropicSettings = settings.get('anthropic');
    const apiKey = anthropicSettings.apiKey;
    const model = anthropicSettings.model || 'claude-3-haiku-20240307';
    
    if (!apiKey) {
        throw new Error('Anthropic API-Schlüssel nicht konfiguriert');
    }
    
    try {
        updateStatusBarProgress(statusBarItem, 'Anthropic generiert', 20, `Modell: ${model}`);
        showNotification(`KI-Nachricht wird mit Anthropic (${model}) generiert...`, 'info', false);
        
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
        
        updateStatusBarProgress(statusBarItem, 'Anthropic generiert', 100, 'Fertig');
        
        if (response.data && response.data.content && response.data.content[0]) {
            return response.data.content[0].text.trim()
                .replace(/^["']|["']$/g, '')
                .replace(/\n/g, ' ');
        } else {
            throw new Error('Unerwartetes Antwortformat von Anthropic');
        }
    } catch (error) {
        updateStatusBarProgress(statusBarItem, 'Anthropic-Fehler', -1);
        console.error('Anthropic API-Fehler:', error.response?.data || error.message);
        throw new Error(`Fehler bei der Kommunikation mit Anthropic: ${error.message}`);
    }
}

// Export der Funktionen der Erweiterung
module.exports = {
    activate,
    deactivate,
    generateWithOllama,
    generateWithOpenAI,
    generateWithAnthropic
}; 