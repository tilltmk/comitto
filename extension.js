const vscode = require('vscode');
const axios = require('axios');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const ignore = require('ignore');
const ui = require('./ui');
const commands = require('./commands');
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
    const config = vscode.workspace.getConfiguration('comitto');
    if (!config.get('debug')) return;
    
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
    
    // Benutzerbenachrichtigung, falls erforderlich
    if (showToUser) {
        const viewDetailsButton = 'Details anzeigen';
        const reportButton = 'Problem melden';
        
        const messagePrefix = contextMessage ? `${contextMessage}: ` : '';
        const userMessage = await vscode.window.showErrorMessage(
            `${messagePrefix}${comittoError.message}`, 
            viewDetailsButton,
            reportButton
        );
        
        if (userMessage === viewDetailsButton) {
            // Details in neuem Fenster anzeigen
            showErrorDetails(comittoError);
        } else if (userMessage === reportButton) {
            // Öffne GitHub Issues oder sende Fehlerbericht
            const issueBody = encodeURIComponent(
                `## Fehlerbeschreibung\n${comittoError.message}\n\n` +
                `## Kontext\n${contextMessage || 'Nicht angegeben'}\n\n` +
                `## Fehlerdetails\n\`\`\`json\n${JSON.stringify(comittoError.toJSON(), null, 2)}\n\`\`\`\n\n` +
                `## Diagnostische Informationen\n\`\`\`json\n${JSON.stringify(getDiagnosticInfo(), null, 2)}\n\`\`\`\n\n` +
                `## Schritte zur Reproduktion\n\n` +
                `## Erwartetes Verhalten\n\n` +
                `## VSCode-Version\n${vscode.version}\n\n` +
                `## Comitto-Version\n${vscode.extensions.getExtension('publisher.comitto').packageJSON.version || 'Unbekannt'}`
            );
            
            vscode.env.openExternal(
                vscode.Uri.parse(`https://github.com/publisher/comitto/issues/new?body=${issueBody}&title=Fehler: ${encodeURIComponent(comittoError.message)}`)
            );
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
                    vscode.window.showInformationMessage('Fehlerdetails wurden in die Zwischenablage kopiert');
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
                    vscode.window.showInformationMessage('Fehlerprotokolle wurden gelöscht');
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
                            vscode.window.showInformationMessage(`Fehlerprotokolle wurden nach ${fileUri.fsPath} exportiert`);
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
        const config = vscode.workspace.getConfiguration('comitto');
        if (config.get('autoCommitEnabled') && hasGit) {
            setupFileWatcher(context);
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
                        vscode.window.showInformationMessage('Diagnostische Informationen in die Zwischenablage kopiert');
                    }
                });
            })
        );
        
        // Automatische Hintergrundüberwachung einrichten
        setupAutoBackgroundMonitoring(context);
        
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

        const config = vscode.workspace.getConfiguration('comitto');
        const gitSettings = config.get('gitSettings');
        const repoPath = gitSettings.repositoryPath || workspaceFolders[0].uri.fsPath;
        
        try {
            // Prüfen, ob Git initialisiert ist
            try {
                await executeGitCommand('git rev-parse --is-inside-work-tree', repoPath);
                updateStatusBarProgress(statusBarItem, 'Commit vorbereiten', 10, 'Git-Repo geprüft');
            } catch (error) {
                throw new Error('Kein Git-Repository gefunden. Bitte initialisieren Sie zuerst ein Git-Repository.');
            }
            
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
                
                const gitSettings = config.get('gitSettings');
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
                    
                    // Aktuelle Branch bestimmen
                    const currentBranch = (await executeGitCommand('git rev-parse --abbrev-ref HEAD', repoPath)).trim();
                    
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
                const notificationSettings = config.get('notifications');
                
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
            const notificationSettings = config.get('notifications');
            if (notificationSettings.onError) {
                showNotification(`Git-Befehl fehlgeschlagen: ${errorMessage}`, 'error');
            }
            
            throw error;
        }
    } catch (error) {
        console.error('Comitto Fehler:', error);
        updateStatusBarProgress(statusBarItem, 'Fehler', -1);
        
        // Benachrichtigung anzeigen
        const notificationSettings = vscode.workspace.getConfiguration('comitto').get('notifications');
        if (notificationSettings.onError) {
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
    const config = vscode.workspace.getConfiguration('comitto');
    const notificationSettings = config.get('notifications');
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
    const gitSettings = config.get('gitSettings');
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
 * Zeigt eine Benachrichtigung an, wenn entsprechend konfiguriert,
 * und fügt sie immer zum Debug-Log hinzu
 * @param {string} message Die anzuzeigende Nachricht
 * @param {string} type Der Typ der Nachricht (info, warning, error)
 */
function showNotification(message, type = 'info') {
    const config = vscode.workspace.getConfiguration('comitto');
    const uiSettings = config.get('uiSettings');
    const debug = config.get('debug');
    
    // Zum Debug-Log hinzufügen
    addDebugLog(message, type);
    
    // Benachrichtigung anzeigen, wenn aktiviert
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
    
    // Status in der Statusleiste aktualisieren
    if (type === 'error' && statusBarItem) {
        const originalText = statusBarItem.text;
        statusBarItem.text = "$(error) Comitto: Fehler";
        
        // Nach 3 Sekunden zurücksetzen
        setTimeout(() => {
            if (statusBarItem) {
                statusBarItem.text = originalText;
            }
        }, 3000);
    }
}

/**
 * @param {string} gitStatus Die Ausgabe von git status
 * @param {string} diffOutput Die Ausgabe von git diff
 * @returns {Promise<string>} Generierte Commit-Nachricht
 */
async function generateCommitMessage(gitStatus, diffOutput) {
    const config = vscode.workspace.getConfiguration('comitto');
    const aiProvider = config.get('aiProvider');
    const gitSettings = config.get('gitSettings');
    
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
    let promptTemplate = config.get('promptTemplate') || 
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
            const config = vscode.workspace.getConfiguration('comitto');
            if (!config.get('autoCommitEnabled')) return;
            
            const debugSettings = config.get('debug') || {};
            
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
                if (config.get('autoCommitEnabled')) {
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
            const config = vscode.workspace.getConfiguration('comitto');
            if (!config.get('autoCommitEnabled')) return;
            
            const debugSettings = config.get('debug') || {};
            
            // Prüfen, ob der Watcher noch aktiv ist
            if (!fileWatcher && config.get('autoCommitEnabled')) {
                addDebugLog('Gesundheitscheck: FileWatcher ist nicht aktiv. Starte neu...', 'warning');
                setupFileWatcher(context);
            }
            
            // Prüfen, ob der Interval-Timer noch aktiv ist
            const triggerRules = config.get('triggerRules');
            if (triggerRules.onInterval && !intervalTimer && config.get('autoCommitEnabled')) {
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
    // Implementierung bleibt unverändert
    const config = vscode.workspace.getConfiguration('comitto');
    const endpoint = config.get('ollama').endpoint || 'http://localhost:11434/api/generate';
    
    // Backward-Kompatibilität für ollama-model Konfiguration
    let ollamaConfig = config.get('ollama') || {};
    let model = ollamaConfig.model;
    const ollamaModelOld = config.get('ollama-model');
    
    if (!model && ollamaModelOld) {
        model = ollamaModelOld;
        ollamaConfig.model = ollamaModelOld;
        await config.update('ollama', ollamaConfig, vscode.ConfigurationTarget.Global);
        await config.update('ollama-model', undefined, vscode.ConfigurationTarget.Global);
        
        showNotification('Korrektur der Ollama-Modell-Konfiguration durchgeführt.', 'info');
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
    const config = vscode.workspace.getConfiguration('comitto');
    const apiKey = config.get('openai.apiKey');
    const model = config.get('openai.model') || 'gpt-3.5-turbo';
    
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
    const config = vscode.workspace.getConfiguration('comitto');
    const apiKey = config.get('anthropic.apiKey');
    const model = config.get('anthropic.model') || 'claude-2';
    
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