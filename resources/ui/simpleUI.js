// Comitto Simple UI Interaktionen
// Moderne Interaktionen für die einfache Benutzeroberfläche

(function() {
    // VSCode API abrufen
    const vscode = acquireVsCodeApi();
    
    // Warten bis das DOM geladen ist
    document.addEventListener('DOMContentLoaded', () => {
        initializeSimpleUI();
    });
    
    // Hauptinitialisierungsfunktion
    function initializeSimpleUI() {
        // Hintergrund-Effekte hinzufügen
        createBackgroundEffects();
        
        // Event-Listener für Schaltflächen einrichten
        setupEventListeners();
        
        // Eingangsanimationen starten
        runEntranceAnimations();
    }
    
    // Hintergrundeffekte erstellen
    function createBackgroundEffects() {
        // Container abrufen
        const container = document.querySelector('.container');
        if (!container) return;
        
        // Glassmorphism-Effekt durch Hinzufügen von Klassen
        container.classList.add('glass-container');
        
        // Hintergrund-Blasen hinzufügen für animation
        createBubbles(container);
    }
    
    // Animierte Blasen für den Hintergrund erstellen
    function createBubbles(container) {
        const bubblesContainer = document.createElement('div');
        bubblesContainer.classList.add('bubble-container');
        container.appendChild(bubblesContainer);
        
        // 10-15 Blasen erstellen (basierend auf Containergröße)
        const bubbleCount = 10 + Math.floor(Math.random() * 5);
        
        for (let i = 0; i < bubbleCount; i++) {
            const bubble = document.createElement('div');
            bubble.classList.add('bubble');
            
            // Zufällige Eigenschaften für die Blasen
            const size = 20 + Math.floor(Math.random() * 60);
            const posX = Math.floor(Math.random() * 100);
            const posY = Math.floor(Math.random() * 100);
            const delay = Math.random() * 10;
            const duration = 15 + Math.random() * 20;
            const hue = Math.floor(Math.random() * 360);
            
            // Stile anwenden
            bubble.style.width = `${size}px`;
            bubble.style.height = `${size}px`;
            bubble.style.left = `${posX}%`;
            bubble.style.top = `${posY}%`;
            bubble.style.animationDelay = `${delay}s`;
            bubble.style.animationDuration = `${duration}s`;
            bubble.style.background = `hsla(${hue}, 80%, 60%, 0.08)`;
            
            bubblesContainer.appendChild(bubble);
        }
    }
    
    // Event-Listener für UI-Elemente einrichten
    function setupEventListeners() {
        // Toggle-Button
        const toggleBtn = document.getElementById('toggleBtn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const isEnabled = toggleBtn.getAttribute('data-enabled') === 'true';
                
                // Visual feedback vor dem Senden des Befehls
                toggleBtn.classList.add('processing');
                
                // Befehl an die Extension senden
                vscode.postMessage({ command: 'toggleAutoCommit' });
                
                // Unmittelbares visuelles Feedback
                updateToggleStatus(!isEnabled);
                
                // Ripple-Effekt hinzufügen
                addRippleEffect(toggleBtn);
            });
        }
        
        // Manueller Commit Button
        const manualCommitBtn = document.getElementById('manualCommitBtn');
        if (manualCommitBtn) {
            manualCommitBtn.addEventListener('click', () => {
                // Button-Status ändern
                manualCommitBtn.classList.add('processing');
                manualCommitBtn.innerHTML = '<span class="icon icon-spin">⟳</span> Wird ausgeführt...';
                
                // Befehl an die Extension senden
                vscode.postMessage({ command: 'performManualCommit' });
                
                // Ripple-Effekt hinzufügen
                addRippleEffect(manualCommitBtn);
                
                // Button nach einer Weile zurücksetzen
                setTimeout(() => {
                    manualCommitBtn.classList.remove('processing');
                    manualCommitBtn.innerHTML = '<span class="icon">💾</span> Manuellen Commit ausführen';
                }, 2000);
            });
        }
        
        // KI konfigurieren Button
        const configureAIBtn = document.getElementById('configureAIBtn');
        if (configureAIBtn) {
            configureAIBtn.addEventListener('click', () => {
                vscode.postMessage({ command: 'selectProvider' });
                addRippleEffect(configureAIBtn);
            });
        }
        
        // Trigger konfigurieren Button
        const configureTriggersBtn = document.getElementById('configureTriggersBtn');
        if (configureTriggersBtn) {
            configureTriggersBtn.addEventListener('click', () => {
                vscode.postMessage({ command: 'configureTriggers' });
                addRippleEffect(configureTriggersBtn);
            });
        }
        
        // Einstellungen öffnen Button
        const openSettingsBtn = document.getElementById('openSettingsBtn');
        if (openSettingsBtn) {
            openSettingsBtn.addEventListener('click', () => {
                vscode.postMessage({ command: 'openSettings' });
                addRippleEffect(openSettingsBtn);
            });
        }
        
        // Dashboard öffnen Button
        const openDashboardBtn = document.getElementById('openDashboardBtn');
        if (openDashboardBtn) {
            openDashboardBtn.addEventListener('click', () => {
                vscode.postMessage({ command: 'openDashboard' });
                addRippleEffect(openDashboardBtn);
            });
        }
    }
    
    // Eingangsanimationen für UI-Elemente ausführen
    function runEntranceAnimations() {
        // Header-Animation
        const header = document.querySelector('.header');
        if (header) {
            header.style.opacity = '0';
            header.style.transform = 'translateY(-20px)';
            setTimeout(() => {
                header.style.transition = 'all 0.5s ease-out';
                header.style.opacity = '1';
                header.style.transform = 'translateY(0)';
            }, 100);
        }
        
        // Status-Animation
        const status = document.querySelector('.status');
        if (status) {
            status.style.opacity = '0';
            status.style.transform = 'scale(0.95)';
            setTimeout(() => {
                status.style.transition = 'all 0.5s ease-out';
                status.style.opacity = '1';
                status.style.transform = 'scale(1)';
            }, 300);
        }
        
        // Buttons-Animation
        const actionButtons = document.querySelector('.action-buttons');
        if (actionButtons) {
            actionButtons.style.opacity = '0';
            actionButtons.style.transform = 'translateY(20px)';
            setTimeout(() => {
                actionButtons.style.transition = 'all 0.5s ease-out';
                actionButtons.style.opacity = '1';
                actionButtons.style.transform = 'translateY(0)';
            }, 500);
        }
        
        // Info-Box-Animationen (nacheinander)
        const infoBoxes = document.querySelectorAll('.info-box');
        infoBoxes.forEach((box, index) => {
            box.style.opacity = '0';
            box.style.transform = 'translateY(20px)';
            setTimeout(() => {
                box.style.transition = 'all 0.5s ease-out';
                box.style.opacity = '1';
                box.style.transform = 'translateY(0)';
            }, 700 + (index * 200));
        });
        
        // Footer-Animation
        const footer = document.querySelector('.footer');
        if (footer) {
            footer.style.opacity = '0';
            setTimeout(() => {
                footer.style.transition = 'opacity 0.5s ease-out';
                footer.style.opacity = '0.7';
            }, 1200);
        }
    }
    
    // Toggle-Status aktualisieren
    function updateToggleStatus(isEnabled) {
        const toggleBtn = document.getElementById('toggleBtn');
        const statusElement = document.querySelector('.status');
        
        if (toggleBtn) {
            toggleBtn.setAttribute('data-enabled', isEnabled);
            toggleBtn.innerHTML = `<span class="icon">${isEnabled ? '🚫' : '✅'}</span> ${isEnabled ? 'Auto-Commit deaktivieren' : 'Auto-Commit aktivieren'}`;
            toggleBtn.classList.remove('processing');
        }
        
        if (statusElement) {
            statusElement.className = `status ${isEnabled ? 'status-enabled' : 'status-disabled'}`;
            statusElement.innerHTML = `Automatische Commits: <strong>${isEnabled ? 'AKTIVIERT' : 'DEAKTIVIERT'}</strong>`;
        }
    }
    
    // Ripple-Effekt zu Schaltflächen hinzufügen
    function addRippleEffect(button) {
        const ripple = document.createElement('span');
        ripple.classList.add('ripple');
        
        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = '0px';
        ripple.style.top = '0px';
        
        button.appendChild(ripple);
        
        // Ripple nach der Animation entfernen
        setTimeout(() => {
            ripple.remove();
        }, 600);
    }
    
    // Auf Nachrichten von der Extension hören
    window.addEventListener('message', event => {
        const message = event.data;
        
        switch(message.command) {
            case 'updateStatus':
                // Status aktualisieren
                updateToggleStatus(message.isEnabled);
                break;
                
            case 'showNotification':
                // Benachrichtigung anzeigen
                showNotification(message.text, message.type);
                break;
                
            case 'refreshUI':
                // Seite neu laden
                location.reload();
                break;
        }
    });
    
    // Eine Benachrichtigung in der UI anzeigen
    function showNotification(text, type = 'info') {
        // Container für Benachrichtigungen erstellen/abrufen
        let notificationContainer = document.querySelector('.notification-container');
        
        if (!notificationContainer) {
            notificationContainer = document.createElement('div');
            notificationContainer.classList.add('notification-container');
            document.body.appendChild(notificationContainer);
        }
        
        // Benachrichtigung erstellen
        const notification = document.createElement('div');
        notification.classList.add('notification', `notification-${type}`);
        notification.innerHTML = `
            <div class="notification-icon">
                ${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}
            </div>
            <div class="notification-content">${text}</div>
            <button class="notification-close">×</button>
        `;
        
        notificationContainer.appendChild(notification);
        
        // Einblenden-Animation
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // Schließen-Button
        const closeButton = notification.querySelector('.notification-close');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                notification.classList.remove('show');
                
                setTimeout(() => {
                    notification.remove();
                }, 300);
            });
        }
        
        // Automatisch ausblenden nach 4 Sekunden
        setTimeout(() => {
            if (notification.parentNode) {
                notification.classList.remove('show');
                
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 4000);
    }
})(); 