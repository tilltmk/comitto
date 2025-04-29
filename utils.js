const { exec } = require('child_process');

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
                    reject(new Error('Die Git-Ausgabe ist zu groß. Bitte reduzieren Sie die Anzahl der Änderungen oder verwenden Sie einen manuellen Commit.'));
                    return;
                }
                
                console.error(`Git-Befehl fehlgeschlagen: ${command}`, errorMessage);
                reject(new Error(errorMessage));
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

module.exports = {
    executeGitCommand,
    getStatusText
}; 