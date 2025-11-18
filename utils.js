const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Fehlertypen für die Anwendung
 * @enum {string}
 */
const ErrorTypes = {
    GIT: 'git',
    CONFIG: 'config',
    FILE_SYSTEM: 'filesystem',
    NETWORK: 'network',
    AI_SERVICE: 'ai_service',
    INTERNAL: 'internal',
    UNKNOWN: 'unknown'
};

/**
 * Fehlerklasse für bessere Diagnose
 */
class ComittoError extends Error {
    /**
     * Erzeugt einen neuen Comitto-Fehler
     * @param {string} message - Fehlermeldung
     * @param {string} type - Fehlertyp aus ErrorTypes
     * @param {Error|null} originalError - Originaler Fehler, falls vorhanden
     * @param {Object} context - Zusätzliche Kontextinformationen
     */
    constructor(message, type = ErrorTypes.UNKNOWN, originalError = null, context = {}) {
        super(message);
        this.name = 'ComittoError';
        this.type = type;
        this.originalError = originalError;
        this.context = context;
        this.timestamp = new Date();
        
        // Stack-Trace beibehalten
        if (originalError && originalError.stack) {
            this.stack = `${this.stack}\nVerursacht durch: ${originalError.stack}`;
        }
    }
    
    /**
     * Gibt Fehlerinformationen als Objekt zurück
     * @returns {Object} Fehlerinformationen
     */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            type: this.type,
            timestamp: this.timestamp.toISOString(),
            context: this.context,
            originalError: this.originalError ? {
                name: this.originalError.name,
                message: this.originalError.message,
                stack: this.originalError.stack
            } : null,
            stack: this.stack
        };
    }
}

/**
 * Fehlerprotokolle speichern
 * @type {Array<Object>}
 */
const errorLogs = [];
const MAX_ERROR_LOGS = 100;

/**
 * Speichert einen Fehler im Protokoll
 * @param {ComittoError|Error} error - Der zu protokollierende Fehler
 */
function logError(error) {
    const errorEntry = error instanceof ComittoError ? error.toJSON() : {
        name: error.name,
        message: error.message,
        type: ErrorTypes.UNKNOWN,
        timestamp: new Date().toISOString(),
        stack: error.stack
    };
    
    // Am Anfang einfügen für chronologische Sortierung (neueste zuerst)
    errorLogs.unshift(errorEntry);
    
    // Maximale Größe einhalten
    if (errorLogs.length > MAX_ERROR_LOGS) {
        errorLogs.pop();
    }
    
    // In Konsole schreiben
    console.error(`[Comitto Fehler] ${error.message}`);
    
    // Optional: In Datei schreiben
    try {
        const logDir = path.join(os.homedir(), '.comitto', 'logs');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        
        const logFile = path.join(logDir, `error_${new Date().toISOString().split('T')[0]}.log`);
        const logMessage = `[${new Date().toISOString()}] ${JSON.stringify(errorEntry)}\n`;
        
        fs.appendFileSync(logFile, logMessage);
    } catch (e) {
        console.error('Fehler beim Schreiben des Fehlerprotokolls:', e);
    }
}

/**
 * Fehlerprotokolle abrufen
 * @param {number} limit - Maximale Anzahl der zurückzugebenden Protokolle
 * @returns {Array<Object>} Fehlerprotokolle
 */
function getErrorLogs(limit = MAX_ERROR_LOGS) {
    return errorLogs.slice(0, limit);
}

/**
 * Fehlerprotokolle löschen
 */
function clearErrorLogs() {
    errorLogs.length = 0;
}

/**
 * Prüft, ob ein Fehler auf ein index.lock Problem hinweist
 * @param {Error} error Der zu prüfende Fehler
 * @returns {boolean} true wenn der Fehler mit index.lock zusammenhängt
 */
function isIndexLockError(error) {
    const errorMessage = (error.message || '').toLowerCase();
    const stderrMessage = (error.stderr || '').toLowerCase();
    const combinedMessage = errorMessage + ' ' + stderrMessage;

    return combinedMessage.includes('index.lock') ||
           combinedMessage.includes('unable to create') ||
           combinedMessage.includes('file exists') && combinedMessage.includes('.git/index') ||
           combinedMessage.includes('another git process') ||
           combinedMessage.includes('lock file');
}

/**
 * Löscht die index.lock Datei im angegebenen Repository
 * @param {string} repoPath Pfad zum Git Repository
 * @returns {boolean} true wenn die Datei gelöscht wurde oder nicht existierte
 */
function deleteIndexLock(repoPath) {
    try {
        const indexLockPath = path.join(repoPath, '.git', 'index.lock');

        if (fs.existsSync(indexLockPath)) {
            fs.unlinkSync(indexLockPath);
            console.log('index.lock erfolgreich gelöscht:', indexLockPath);
            return true;
        } else {
            console.log('index.lock existiert nicht:', indexLockPath);
            return false;
        }
    } catch (deleteError) {
        console.error('Fehler beim Löschen von index.lock:', deleteError);
        return false;
    }
}

/**
 * Führt einen Git-Befehl aus
 * @param {string} command Der auszuführende Git-Befehl
 * @param {string} cwd Arbeitsverzeichnis für den Befehl
 * @returns {Promise<string>} Ausgabe des Befehls
 */
function executeGitCommand(command, cwd) {
    return new Promise((resolve, reject) => {
        // Erhöhe maxBuffer auf 50 MB (50 * 1024 * 1024), um große Ausgaben zu unterstützen
        exec(command, { cwd, maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                // Detailliertere Fehlermeldung mit spezifischer Behandlung von Pufferüberlauf
                const errorMessage = stderr || error.message || 'Unbekannter Git-Fehler';
                
                // Spezifische Behandlung für Pufferüberlauf
                if (errorMessage.includes('maxBuffer length exceeded') ||
                    error.code === 'ERR_CHILD_PROCESS_STDOUT_MAXBUFFER') {
                    console.error(`Git-Befehl mit Pufferüberlauf: ${command}`);
                    const bufferError = new ComittoError(
                        'Die Git-Ausgabe ist zu groß. Bitte reduzieren Sie die Anzahl der Änderungen oder verwenden Sie einen manuellen Commit.',
                        ErrorTypes.GIT,
                        error,
                        { command, cwd }
                    );
                    logError(bufferError);
                    reject(bufferError);
                    return;
                }

                // Spezifische Behandlung für index.lock Probleme
                error.stderr = stderr;  // stderr zum error-Objekt hinzufügen für isIndexLockError
                if (isIndexLockError(error)) {
                    console.warn('index.lock Problem erkannt, versuche automatische Lösung...');
                    const lockDeleted = deleteIndexLock(cwd);

                    if (lockDeleted) {
                        console.log('index.lock gelöscht, wiederhole Git-Befehl:', command);
                        // Befehl nach kurzer Verzögerung wiederholen
                        setTimeout(() => {
                            exec(command, { cwd, maxBuffer: 50 * 1024 * 1024 }, (retryError, retryStdout, retryStderr) => {
                                if (retryError) {
                                    console.error('Wiederholter Versuch nach index.lock Löschung fehlgeschlagen:', retryError);
                                    const gitError = new ComittoError(
                                        retryStderr || retryError.message || 'Git-Fehler nach index.lock Löschung',
                                        ErrorTypes.GIT,
                                        retryError,
                                        { command, cwd, stderr: retryStderr }
                                    );
                                    logError(gitError);
                                    reject(gitError);
                                } else {
                                    console.log('Git-Befehl nach index.lock Löschung erfolgreich');
                                    resolve(retryStdout);
                                }
                            });
                        }, 500);  // 500ms Verzögerung vor Wiederholung
                        return;
                    }
                }

                console.error(`Git-Befehl fehlgeschlagen: ${command}`, errorMessage);
                const gitError = new ComittoError(
                    errorMessage,
                    ErrorTypes.GIT,
                    error,
                    { command, cwd, stderr }
                );
                logError(gitError);
                reject(gitError);
                return;
            }
            resolve(stdout);
        });
    });
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

/**
 * Führt einen asynchronen Prozess mit Wiederholungsversuchen aus
 * @param {Function} asyncFn - Die auszuführende asynchrone Funktion
 * @param {Object} options - Optionen für die Wiederholungsversuche
 * @param {number} options.maxRetries - Maximale Anzahl der Wiederholungsversuche
 * @param {number} options.retryDelay - Verzögerung zwischen Versuchen in ms
 * @param {Function} options.shouldRetry - Funktion, die bestimmt, ob erneut versucht werden soll
 * @returns {Promise<any>} Das Ergebnis der asynchronen Funktion
 */
async function withRetry(asyncFn, options = {}) {
    const { 
        maxRetries = 3, 
        retryDelay = 1000, 
        shouldRetry = (error) => true 
    } = options;
    
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await asyncFn(attempt);
        } catch (error) {
            lastError = error;
            
            // Prüfen, ob ein erneuter Versuch unternommen werden soll
            if (attempt < maxRetries && shouldRetry(error)) {
                // Exponentielles Backoff
                const delay = retryDelay * Math.pow(2, attempt);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            
            // Alle Versuche erschöpft oder kein Wiederholungsversuch gewünscht
            if (!(error instanceof ComittoError)) {
                // Fehler in ComittoError umwandeln, falls nötig
                error = new ComittoError(
                    error.message || 'Unbekannter Fehler',
                    ErrorTypes.UNKNOWN,
                    error,
                    { attempts: attempt + 1, maxRetries }
                );
                logError(error);
            }
            throw error;
        }
    }
}

/**
 * Sammelt diagnostische Informationen über die Umgebung
 * @returns {Object} Diagnostische Informationen
 */
function getDiagnosticInfo() {
    return {
        platform: process.platform,
        nodeVersion: process.version,
        arch: process.arch,
        cpus: os.cpus().length,
        totalmem: os.totalmem(),
        freemem: os.freemem(),
        uptime: os.uptime(),
        errorLogs: getErrorLogs(10) // Letzte 10 Fehler
    };
}

/**
 * Aktualisiert die Statusleiste mit einem Fortschrittsbalken
 * @param {object} statusBarItem Das StatusBarItem-Objekt
 * @param {string} action Die aktuelle Aktion
 * @param {number} progress Fortschritt (0-100, -1 für Fehler)
 * @param {string} details Zusätzliche Details (optional)
 */
function updateStatusBarProgress(statusBarItem, action, progress, details = '') {
    if (!statusBarItem) return;
    
    // Fortschrittsbalken erstellen
    let progressBar = '';
    let progressIcon = '$(sync~spin)';
    
    if (progress >= 0 && progress <= 100) {
        // Visuellen Fortschrittsbalken erstellen
        const barLength = 10;
        const filledCount = Math.floor(progress / 100 * barLength);
        const remainingCount = barLength - filledCount;
        
        // Unicode-Zeichen für Balken
        const filledChar = '█';
        const emptyChar = '░';
        
        progressBar = filledChar.repeat(filledCount) + emptyChar.repeat(remainingCount);
        
        // Icon basierend auf Fortschritt
        if (progress === 100) {
            progressIcon = '$(check)';
        }
    } else if (progress === -1) {
        // Fehler anzeigen
        progressIcon = '$(error)';
    }
    
    // Formatierte Statusnachricht
    let statusText = `${progressIcon} Comitto: ${action}`;
    
    // Fortschrittsbalken hinzufügen, wenn relevant
    if (progress >= 0 && progress < 100) {
        statusText += ` [${progressBar}]`;
    }
    
    // Details hinzufügen, wenn vorhanden
    if (details) {
        statusText += ` (${details})`;
    }
    
    statusBarItem.text = statusText;
    
    // Nach erfolgreicher Beendigung den Status zurücksetzen
    if (progress === 100) {
        setTimeout(() => {
            if (statusBarItem && statusBarItem.text === statusText) {
                statusBarItem.text = "$(sync) Comitto: Aktiv";
            }
        }, 3000);
    }
}

module.exports = {
    executeGitCommand,
    getStatusText,
    ComittoError,
    ErrorTypes,
    logError,
    getErrorLogs,
    clearErrorLogs,
    withRetry,
    getDiagnosticInfo,
    updateStatusBarProgress,
    isIndexLockError,
    deleteIndexLock
}; 