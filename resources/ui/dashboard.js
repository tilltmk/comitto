// Comitto Dashboard UI
// Modern JavaScript for an interactive dashboard with animations and glassmorphism effects

(function() {
    // VSCode API für die Kommunikation mit der Extension
    const vscode = acquireVsCodeApi();
    
    // Wait until the DOM is loaded
    document.addEventListener('DOMContentLoaded', () => {
        console.log('Dashboard DOM loaded');
        initializeDashboard();
    });

    // Main initialization function
    function initializeDashboard() {
        console.log('Dashboard initializing');
        // Get elements
        const toggleBtn = document.getElementById('toggleBtn');
        const commitBtn = document.getElementById('commitBtn');
        const refreshBtn = document.getElementById('refreshBtn');
        const configureAIBtn = document.getElementById('configureAIBtn');
        const configureTriggersBtn = document.getElementById('configureTriggersBtn');
        const openSettingsBtn = document.getElementById('openSettingsBtn');
        
        // Add animated elements (background bubbles for glassmorphism effect)
        createBackgroundBubbles();
        
        // Event listeners for buttons
        setupEventListeners();
        
        // Initial animations
        runEntranceAnimations();
        
        // Load and display information for the dashboard
        loadDashboardData();
    }
    
    // Event listeners for buttons
    function setupEventListeners() {
        console.log('Setting up event listeners');
        
        const toggleBtn = document.getElementById('toggleBtn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                // Toggle status, send to extension
                const isEnabled = toggleBtn.getAttribute('data-enabled') === 'true';
                vscode.postMessage({
                    command: 'executeCommand',
                    commandId: 'comitto.toggleAutoCommit'
                });
            });
        } else {
            console.log('toggleBtn not found');
        }
        
        const commitBtn = document.getElementById('commitBtn');
        if (commitBtn) {
            commitBtn.addEventListener('click', () => {
                // Start manual commit
                vscode.postMessage({
                    command: 'executeCommand',
                    commandId: 'comitto.performManualCommit'
                });
            });
        } else {
            console.log('commitBtn not found');
        }
        
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                // Refresh dashboard
                vscode.postMessage({
                    command: 'refresh'
                });
            });
        } else {
            console.log('refreshBtn not found');
        }
        
        const configureAIBtn = document.getElementById('configureAIBtn');
        if (configureAIBtn) {
            configureAIBtn.addEventListener('click', () => {
                // Configure AI provider
                vscode.postMessage({
                    command: 'executeCommand',
                    commandId: 'comitto.selectAiProvider'
                });
            });
        } else {
            console.log('configureAIBtn not found');
        }
        
        const configureTriggersBtn = document.getElementById('configureTriggersBtn');
        if (configureTriggersBtn) {
            configureTriggersBtn.addEventListener('click', () => {
                // Configure triggers
                vscode.postMessage({
                    command: 'executeCommand',
                    commandId: 'comitto.configureTriggers'
                });
            });
        } else {
            console.log('configureTriggersBtn not found');
        }
        
        const openSettingsBtn = document.getElementById('openSettingsBtn');
        if (openSettingsBtn) {
            openSettingsBtn.addEventListener('click', () => {
                // Open settings
                vscode.postMessage({
                    command: 'executeCommand',
                    commandId: 'comitto.openSettings'
                });
            });
        } else {
            console.log('openSettingsBtn not found');
        }
    }
    
    // Updates the status of the toggle button
    function updateToggleButton(isEnabled) {
        const toggleBtn = document.getElementById('toggleBtn');
        if (toggleBtn) {
            toggleBtn.setAttribute('data-enabled', isEnabled);
            toggleBtn.innerHTML = `<span class="icon">${isEnabled ? '🚫' : '✅'}</span> ${isEnabled ? 'Disable' : 'Enable'}`;
            toggleBtn.classList.remove('processing');
            
            // Update status display
            const statusElement = document.querySelector('.status');
            if (statusElement) {
                statusElement.className = `status ${isEnabled ? 'status-enabled' : 'status-disabled'}`;
                statusElement.innerHTML = `<strong>Status:</strong> Comitto is currently ${isEnabled ? 'enabled' : 'disabled'}`;
            }
        }
    }
    
    // Adds a ripple effect to the button
    function createRippleEffect(button) {
        const ripple = document.createElement('span');
        ripple.classList.add('ripple');
        
        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        
        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${0}px`;
        ripple.style.top = `${0}px`;
        
        button.appendChild(ripple);
        
        // Remove ripple after animation
        setTimeout(() => {
            ripple.remove();
        }, 600);
    }
    
    // Creates animated background bubbles for the glassmorphism effect
    function createBackgroundBubbles() {
        const container = document.querySelector('.container');
        if (!container) return;
        
        // Create bubble container
        const bubbleContainer = document.createElement('div');
        bubbleContainer.classList.add('bubble-container');
        container.appendChild(bubbleContainer);
        
        // Number of bubbles based on container size
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const bubbleCount = Math.floor((containerWidth * containerHeight) / 30000);
        
        // Create bubbles
        for (let i = 0; i < bubbleCount; i++) {
            const bubble = document.createElement('div');
            bubble.classList.add('bubble');
            
            // Random position
            const x = Math.floor(Math.random() * 100);
            const y = Math.floor(Math.random() * 100);
            
            // Random size (10-60px)
            const size = Math.floor(Math.random() * 50) + 10;
            
            // Random animation delay and duration
            const delay = Math.random() * 15;
            const duration = 20 + Math.random() * 20;
            
            // Random color (with very low opacity)
            const hue = Math.floor(Math.random() * 360);
            
            // Apply styles
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
    
    // Runs entrance animations for the dashboard elements
    function runEntranceAnimations() {
        // Select all cards
        const cards = document.querySelectorAll('.card');
        
        // Animation with delay for each card
        cards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                card.style.transition = 'all 0.6s ease-out';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, 100 + (index * 150));
        });
        
        // Header animation
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
        
        // Action buttons animation
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
    
    // Loads current data for the dashboard
    function loadDashboardData() {
        // In a real implementation, data would be fetched from the extension
        // For the demo, we display sample data
        
        // Update status indicator
        updateChartData();
        
        // Update commit history (if available)
        if (typeof updateCommitHistory === 'function') {
            updateCommitHistory();
        }
    }
    
    // Updates the chart data with some sample data
    function updateChartData() {
        const commitCount = document.getElementById('commitCount');
        const fileCount = document.getElementById('fileCount');
        const changeCount = document.getElementById('changeCount');
        const chart = document.getElementById('chart');
        
        if (commitCount && fileCount && changeCount) {
            // Sample data - in a real implementation, this would come from the extension
            setTimeout(() => {
                commitCount.textContent = Math.floor(Math.random() * 50) + 5;
                fileCount.textContent = Math.floor(Math.random() * 100) + 20;
                changeCount.textContent = Math.floor(Math.random() * 1000) + 100;
            }, 800);
        }
        
        if (chart) {
            // Create a simple SVG chart as placeholder
            setTimeout(() => {
                chart.innerHTML = createSimpleSVGChart();
            }, 1000);
        }
    }
    
    // Creates a simple SVG chart for demonstration
    function createSimpleSVGChart() {
        const values = [];
        for (let i = 0; i < 7; i++) {
            values.push(Math.floor(Math.random() * 80) + 10);
        }
        
        const max = Math.max(...values);
        const width = 100 / values.length;
        
        const bars = values.map((value, index) => {
            const height = (value / max) * 100;
            const x = index * width;
            return `
                <g class="bar">
                    <rect 
                        x="${x}%" 
                        y="${100 - height}%" 
                        width="${width * 0.8}%" 
                        height="${height}%" 
                        rx="2"
                        fill="var(--primary-color)"
                        opacity="0.8"
                    />
                </g>
            `;
        }).join('');
        
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const labels = days.map((day, index) => {
            const x = (index * width) + (width / 2);
            return `
                <text 
                    x="${x}%" 
                    y="100%" 
                    text-anchor="middle" 
                    fill="var(--text-secondary)"
                    font-size="10"
                >
                    ${day}
                </text>
            `;
        }).join('');
        
        return `
            <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                ${bars}
                <g class="labels">
                    ${labels}
                </g>
            </svg>
        `;
    }
    
    // Sends a message to VS Code
    function sendMessageToVscode(message) {
        if (typeof vscode !== 'undefined') {
            vscode.postMessage(message);
        } else {
            console.error('VS Code API not available');
            // For testing outside of VS Code
            showNotification('This would send a message to VS Code: ' + JSON.stringify(message), 'info');
        }
    }
    
    // Process messages from VS Code
    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'update':
                // Update dashboard with new data
                if (message.enabled !== undefined) {
                    updateToggleButton(message.enabled);
                }
                if (message.stats) {
                    updateStats(message.stats);
                }
                break;
            case 'showNotification':
                showNotification(message.text, message.type);
                break;
            case 'error':
                showNotification(message.text || 'An error occurred', 'error');
                break;
        }
    });
    
    // Shows a notification in the dashboard
    function showNotification(text, type = 'info') {
        // Check if notification container exists, if not create it
        let container = document.querySelector('.notification-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'notification-container';
            document.body.appendChild(container);
        }
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        // Icons for different notification types
        const icons = {
            'info': 'ℹ️',
            'success': '✅',
            'error': '❌',
            'warning': '⚠️'
        };
        
        notification.innerHTML = `
            <div class="notification-icon">${icons[type] || icons.info}</div>
            <div class="notification-content">${text}</div>
            <button class="notification-close">×</button>
        `;
        
        // Add to container
        container.appendChild(notification);
        
        // Show with animation
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // Close button handler
        const closeBtn = notification.querySelector('.notification-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                notification.classList.remove('show');
                setTimeout(() => {
                    notification.remove();
                }, 300);
            });
        }
        
        // Auto-remove after 5 seconds
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