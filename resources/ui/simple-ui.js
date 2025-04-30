// Comitto Simple UI JavaScript

(function() {
    // VSCode API für die Kommunikation mit der Extension
    const vscode = acquireVsCodeApi();
    
    // Referenzen zu DOM-Elementen
    const statusElement = document.getElementById('status');
    const providerInfoElement = document.getElementById('provider-info');
    const btnToggle = document.getElementById('btn-toggle');
    const btnManualCommit = document.getElementById('btn-manual-commit');
    const btnStageAll = document.getElementById('btn-stage-all');
    const btnShowDashboard = document.getElementById('btn-show-dashboard');
    
    // Status-Update anfordern
    requestRefresh();
    
    // Event-Listener für Buttons registrieren
    btnToggle.addEventListener('click', () => {
        vscode.postMessage({
            command: 'executeCommand',
            commandId: 'comitto.toggleAutoCommit'
        });
    });
    
    btnManualCommit.addEventListener('click', () => {
        vscode.postMessage({
            command: 'executeCommand',
            commandId: 'comitto.performManualCommit'
        });
    });
    
    btnStageAll.addEventListener('click', () => {
        vscode.postMessage({
            command: 'executeCommand',
            commandId: 'comitto.stageAll'
        });
    });
    
    btnShowDashboard.addEventListener('click', () => {
        vscode.postMessage({
            command: 'executeCommand',
            commandId: 'comitto.showDashboard'
        });
    });
    
    // Nachrichten von der Extension verarbeiten
    window.addEventListener('message', (event) => {
        const message = event.data;
        
        switch (message.command) {
            case 'updateStatus':
                updateUI(message.data);
                break;
            case 'error':
                showError(message.message);
                break;
        }
    });
    
    // UI-Status aktualisieren
    function updateUI(data) {
        // Status-Anzeige aktualisieren
        statusElement.className = `status-indicator ${data.isEnabled ? 'status-enabled' : 'status-disabled'}`;
        statusElement.textContent = data.isEnabled ? 'Aktiviert' : 'Deaktiviert';
        
        // Provider-Info aktualisieren
        providerInfoElement.textContent = `Aktueller KI-Provider: ${data.provider}`;
        
        // Button-Text aktualisieren
        btnToggle.textContent = data.isEnabled ? 'Deaktivieren' : 'Aktivieren';
    }
    
    // Fehlermeldung anzeigen
    function showError(message) {
        const container = document.querySelector('.simple-ui-container');
        
        const errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.textContent = message;
        errorElement.style.backgroundColor = 'var(--vscode-inputValidation-errorBackground)';
        errorElement.style.color = 'var(--vscode-inputValidation-errorForeground)';
        errorElement.style.border = '1px solid var(--vscode-inputValidation-errorBorder)';
        errorElement.style.borderRadius = '4px';
        errorElement.style.padding = '8px 12px';
        errorElement.style.margin = '10px 0';
        errorElement.style.width = '100%';
        errorElement.style.maxWidth = '600px';
        errorElement.style.textAlign = 'center';
        
        // Am Anfang des Containers einfügen
        container.insertBefore(errorElement, container.firstChild);
        
        // Nach 5 Sekunden automatisch ausblenden
        setTimeout(() => {
            if (errorElement.parentNode === container) {
                container.removeChild(errorElement);
            }
        }, 5000);
    }
    
    // Refresh der Daten von der Extension anfordern
    function requestRefresh() {
        vscode.postMessage({
            command: 'refresh'
        });
    }
})(); 