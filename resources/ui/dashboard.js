// Comitto Dashboard UI
// Modernes JavaScript für ein interaktives Dashboard mit Animationen und Glassmorphism-Effekten

(function() {
    // Warten, bis das DOM geladen ist
    document.addEventListener('DOMContentLoaded', () => {
        console.log('Dashboard DOM geladen');
        initializeDashboard();
    });

    // Hauptinitialisierungsfunktion
    function initializeDashboard() {
        console.log('Dashboard wird initialisiert');
        // Elemente abrufen
        const toggleBtn = document.getElementById('toggleBtn');
        const commitBtn = document.getElementById('commitBtn');
        const refreshBtn = document.getElementById('refreshBtn');
        const configureAIBtn = document.getElementById('configureAIBtn');
        const configureTriggersBtn = document.getElementById('configureTriggersBtn');
        const openSettingsBtn = document.getElementById('openSettingsBtn');
        
        // Animierte Elemente hinzufügen (Hintergrund-Blasen für Glassmorphism-Effekt)
        createBackgroundBubbles();
        
        // Event-Listener für Buttons
        setupEventListeners();
        
        // Initiale Animationen
        runEntranceAnimations();
        
        // Informationen für das Dashboard laden und anzeigen
        loadDashboardData();
    }
    
    // Event-Listener für UI-Elemente einrichten
    function setupEventListeners() {
        // Toggle Button für Auto-Commit
        const toggleBtn = document.getElementById('toggleBtn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const isEnabled = toggleBtn.getAttribute('data-enabled') === 'true';
                
                // Visuelles Feedback vor dem Senden des Befehls
                toggleBtn.classList.add('processing');
                
                // An die VSCode Extension API senden
                vscode.postMessage({
                    command: 'toggleAutoCommit'
                });
                
                // Lokal bereits den Zustand umschalten (wird durch das tatsächliche Ergebnis überschrieben)
                updateToggleButton(!isEnabled);
                
                // Ripple-Effekt hinzufügen
                createRippleEffect(toggleBtn);
            });
        }
        
        // Manueller Commit Button
        const commitBtn = document.getElementById('commitBtn');
        if (commitBtn) {
            commitBtn.addEventListener('click', () => {
                // Visuelles Feedback
                commitBtn.classList.add('processing');
                commitBtn.innerHTML = '<span class="icon icon-spin">⟳</span> Wird ausgeführt...';
                
                // An die VSCode Extension API senden
                vscode.postMessage({
                    command: 'manualCommit'
                });
                
                // Ripple-Effekt hinzufügen
                createRippleEffect(commitBtn);
                
                // Nach einer Weile den Button zurücksetzen
                setTimeout(() => {
                    commitBtn.classList.remove('processing');
                    commitBtn.innerHTML = '<span class="icon">💾</span> Manueller Commit';
                }, 2000);
            });
        }
        
        // Aktualisieren Button
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                refreshBtn.classList.add('icon-spin');
                
                // An die VSCode Extension API senden
                vscode.postMessage({
                    command: 'refresh'
                });
                
                // Nach einer Weile die Animation stoppen (falls keine Antwort kommt)
                setTimeout(() => {
                    refreshBtn.classList.remove('icon-spin');
                }, 2000);
            });
        }
        
        // KI konfigurieren Button
        const configureAIBtn = document.getElementById('configureAIBtn');
        if (configureAIBtn) {
            configureAIBtn.addEventListener('click', () => {
                vscode.postMessage({
                    command: 'configureProvider'
                });
                createRippleEffect(configureAIBtn);
            });
        }
        
        // Trigger konfigurieren Button
        const configureTriggersBtn = document.getElementById('configureTriggersBtn');
        if (configureTriggersBtn) {
            configureTriggersBtn.addEventListener('click', () => {
                vscode.postMessage({
                    command: 'configureTriggers'
                });
                createRippleEffect(configureTriggersBtn);
            });
        }
        
        // Einstellungen öffnen Button
        const openSettingsBtn = document.getElementById('openSettingsBtn');
        if (openSettingsBtn) {
            openSettingsBtn.addEventListener('click', () => {
                vscode.postMessage({
                    command: 'openSettings'
                });
                createRippleEffect(openSettingsBtn);
            });
        }
    }
    
    // Aktualisiert den Status des Toggle-Buttons
    function updateToggleButton(isEnabled) {
        const toggleBtn = document.getElementById('toggleBtn');
        if (toggleBtn) {
            toggleBtn.setAttribute('data-enabled', isEnabled);
            toggleBtn.innerHTML = `<span class="icon">${isEnabled ? '🚫' : '✅'}</span> ${isEnabled ? 'Deaktivieren' : 'Aktivieren'}`;
            toggleBtn.classList.remove('processing');
            
            // Status-Anzeige aktualisieren
            const statusElement = document.querySelector('.status');
            if (statusElement) {
                statusElement.className = `status ${isEnabled ? 'status-enabled' : 'status-disabled'}`;
                statusElement.innerHTML = `<strong>Status:</strong> Comitto ist derzeit ${isEnabled ? 'aktiviert' : 'deaktiviert'}`;
            }
        }
    }
    
    // Fügt dem Button einen Ripple-Effekt hinzu
    function createRippleEffect(button) {
        const ripple = document.createElement('span');
        ripple.classList.add('ripple');
        
        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        
        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${0}px`;
        ripple.style.top = `${0}px`;
        
        button.appendChild(ripple);
        
        // Ripple nach Animation entfernen
        setTimeout(() => {
            ripple.remove();
        }, 600);
    }
    
    // Erzeugt animierte Hintergrundblasen für den Glassmorphism-Effekt
    function createBackgroundBubbles() {
        const container = document.querySelector('.container');
        if (!container) return;
        
        // Bubble-Container erstellen
        const bubbleContainer = document.createElement('div');
        bubbleContainer.classList.add('bubble-container');
        container.appendChild(bubbleContainer);
        
        // Anzahl der Blasen basierend auf Containergröße
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const bubbleCount = Math.floor((containerWidth * containerHeight) / 30000);
        
        // Blasen erstellen
        for (let i = 0; i < bubbleCount; i++) {
            const bubble = document.createElement('div');
            bubble.classList.add('bubble');
            
            // Zufällige Position
            const x = Math.floor(Math.random() * 100);
            const y = Math.floor(Math.random() * 100);
            
            // Zufällige Größe (10-60px)
            const size = Math.floor(Math.random() * 50) + 10;
            
            // Zufällige Animationsverzögerung und -dauer
            const delay = Math.random() * 15;
            const duration = 20 + Math.random() * 20;
            
            // Zufällige Farbe (mit sehr geringer Deckkraft)
            const hue = Math.floor(Math.random() * 360);
            
            // Stile anwenden
            bubble.style.left = `${x}%`;
            bubble.style.top = `${y}%`;
            bubble.style.width = `${size}px`;
            bubble.style.height = `${size}px`;
            bubble.style.animationDelay = `${delay}s`;
            bubble.style.animationDuration = `${duration}s`;
            bubble.style.background = `hsla(${hue}, 70%, 70%, 0.1)`;
            
            bubbleContainer.appendChild(bubble);
        }
    }
    
    // Führt die Eingangsanimationen für die Dashboard-Elemente aus
    function runEntranceAnimations() {
        // Alle Karten auswählen
        const cards = document.querySelectorAll('.card');
        
        // Animation mit Verzögerung für jede Karte
        cards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                card.style.transition = 'all 0.6s ease-out';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, 100 + (index * 150));
        });
        
        // Header-Animation
        const header = document.querySelector('.header');
        if (header) {
            header.style.opacity = '0';
            header.style.transform = 'translateY(-20px)';
            
            setTimeout(() => {
                header.style.transition = 'all 0.6s ease-out';
                header.style.opacity = '1';
                header.style.transform = 'translateY(0)';
            }, 100);
        }
        
        // Action-Buttons Animation
        const actionButtons = document.querySelector('.action-buttons');
        if (actionButtons) {
            actionButtons.style.opacity = '0';
            actionButtons.style.transform = 'scale(0.95)';
            
            setTimeout(() => {
                actionButtons.style.transition = 'all 0.6s ease-out';
                actionButtons.style.opacity = '1';
                actionButtons.style.transform = 'scale(1)';
            }, 300);
        }
    }
    
    // Lädt aktuelle Daten für das Dashboard
    function loadDashboardData() {
        // In einer echten Implementierung würden hier Daten von der Extension abgerufen
        // Für die Demo zeigen wir Beispieldaten an
        
        // Statusindikator aktualisieren
        updateChartData();
        
        // Commit-History aktualisieren (falls vorhanden)
        if (typeof updateCommitHistory === 'function') {
            updateCommitHistory();
        }
    }
    
    // Aktualisiert Chart-Daten (falls vorhanden)
    function updateChartData() {
        // Prüfen, ob Charts verwendet werden
        if (typeof Chart === 'undefined') return;
        
        // Chart-Instanzen abrufen (falls vorhanden)
        const commitChartElement = document.getElementById('commitChart');
        if (commitChartElement) {
            // Beispiel für ein Chart
            const ctx = commitChartElement.getContext('2d');
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
                    datasets: [{
                        label: 'Commits pro Tag',
                        data: [5, 8, 12, 7, 10, 3, 6],
                        borderColor: '#6366f1',
                        backgroundColor: 'rgba(99, 102, 241, 0.2)',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            }
                        }
                    }
                }
            });
        }
    }
    
    // Nachrichtenempfang von der VSCode Extension API
    window.addEventListener('message', event => {
        const message = event.data;
        
        switch (message.command) {
            case 'refreshUI':
                // UI neu laden oder aktualisieren
                location.reload();
                break;
                
            case 'updateStatus':
                // Status aktualisieren
                updateToggleButton(message.isEnabled);
                break;
                
            case 'showNotification':
                // Benachrichtigung anzeigen
                showNotification(message.text, message.type);
                break;
        }
    });
    
    // Zeigt eine Benachrichtigung im Dashboard an
    function showNotification(text, type = 'info') {
        // Prüfen, ob bereits ein Notification-Container existiert
        let notificationContainer = document.querySelector('.notification-container');
        
        if (!notificationContainer) {
            // Container erstellen
            notificationContainer = document.createElement('div');
            notificationContainer.classList.add('notification-container');
            document.body.appendChild(notificationContainer);
        }
        
        // Neue Benachrichtigung erstellen
        const notification = document.createElement('div');
        notification.classList.add('notification', `notification-${type}`);
        notification.innerHTML = `
            <div class="notification-icon">
                ${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}
            </div>
            <div class="notification-content">${text}</div>
            <button class="notification-close">×</button>
        `;
        
        // Zum Container hinzufügen
        notificationContainer.appendChild(notification);
        
        // Eingangsanimation
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // Schließen-Button-Handler
        const closeButton = notification.querySelector('.notification-close');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                notification.classList.remove('show');
                
                // Nach der Ausgangsanimation entfernen
                setTimeout(() => {
                    notification.remove();
                }, 300);
            });
        }
        
        // Automatisch nach 5 Sekunden schließen
        setTimeout(() => {
            if (notification.parentNode) {
                notification.classList.remove('show');
                
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 5000);
    }
})(); 