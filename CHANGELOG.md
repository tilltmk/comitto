# Änderungsprotokoll

## [0.8.0] - 2025-04-29

### Behoben
- Kritischen Fehler bei der Aktivierung behoben: fehlende utils.js-Datei hinzugefügt
- Konflikte bei Funktionsdefinitionen zwischen extension.js und ui.js beseitigt
- getStatusDescription-Funktionalität korrekt zwischen allen Modulen aufgeteilt
- Module-Exports in ui.js um fehlende Funktionen erweitert

### Verbessert
- Robustere Fehlerbehandlung beim Import von Abhängigkeiten
- Bessere Strukturierung der Hilfsfunktionen
- Konsistente Nutzung importierter Funktionen

## [0.7.0] - 2025-04-29

### Behoben
- Kritischer Fehler bei der Befehlsregistrierung für "comitto.enableAutoCommit" behoben
- Korrekte Implementierung der Toggle-Befehle für Trigger-Regeln
- Fehlende Implementierung der Benachrichtigungseinstellungen hinzugefügt

### Verbessert
- Robustere Fehlerbehandlung in allen Befehlsfunktionen
- Bessere Validierung von Konfigurationsänderungen
- Optimierte Benutzerrückmeldungen bei Status-Änderungen

## [0.6.0] - 2025-04-29

### Hinzugefügt
- Verbesserte Fehlerbehandlung bei API-Verbindungsproblemen
- Mehrsprachige Unterstützung erweitert
- Neue gruppierte Seitenleistenansicht für bessere Übersichtlichkeit
- Detailliertere Tooltip-Informationen für alle Einstellungen

### Verbessert
- Optimierte Benutzererfahrung bei der Modellauswahl mit visuellen Indikatoren
- Verbessertes Feedback bei Spracheinstellungen mit automatischer Prompt-Anpassung
- Hierarchische Strukturierung der Einstellungen in der Seitenleiste
- Statusansicht mit klar gruppierten Elementen für bessere Navigation
- Intuitivere Schnellaktionen mit logischer Kategorisierung

### Geändert
- Aktualisierte Abhängigkeiten auf neueste Versionen
- Interne Architektur für bessere Wartbarkeit umstrukturiert
- Optimierte UI-Icons für verbesserte visuelle Unterscheidung
- Verbesserte Tooltip-Beschreibungen für alle Einstellungen

### Behoben
- Problem mit der Speicherung der Spracheinstellungen
- Fehler bei der Modellanzeige unter bestimmten Bedingungen
- Inkonsistenzen in der Benutzeroberfläche bei verschiedenen Themes
- Verbesserte Fehlerbehandlung bei der OpenAI-Modellauswahl

## [0.5.0] - 2025-04-29

### Hinzugefügt
- Ollama als Standard-KI-Provider für einfachere lokale Nutzung
- Dynamische Modellauswahl für Ollama mit Verfügbarkeitsprüfung
- Verbindungstest für Ollama-Endpunkt
- Fallback-Commitnachricht bei KI-Fehlern

### Verbessert
- Robustere Fehlerbehandlung bei Ollama-Verbindungen
- Detaillierte Statusanzeigen während des Commit-Prozesses
- Benutzerfreundlichere Fehlermeldungen bei Git-Problemen
- Verbesserte Validierung von Ollama-API-Endpunkt und Modell
- Kürzung zu langer Commit-Nachrichten auf maximale Länge

### Behoben
- Verhinderung von Abstürzen bei fehlenden Git-Repositories
- Besserer Umgang mit Netzwerkproblemen bei Ollama-Verbindungen

## [0.4.0] - 2025-04-29

### Hinzugefügt
- Verbesserte Sprachauswahl für Commit-Nachrichten (Deutsch/Englisch)
- Optimierte Prompt-Templates mit sprachspezifischen Anpassungen
- OpenAI-Modellauswahl mit aktuellen Modellen (GPT-4o, etc.)

### Verbessert
- Benutzeroberfläche für Einstellungen und Konfiguration
- Robustere Fehlerbehandlung

## [0.3.0] - 2025-04-29

### Hinzugefügt
- Verbesserte Fehlerbehandlung für alle KI-Verbindungen
- Optimierte Benutzeroberfläche des Dashboards

### Geändert
- Aktualisierung der Claude-Modell-Referenzen
- Performance-Optimierungen

### Behoben
- Behoben: Probleme bei der Erkennung von Git-Änderungen
- Behoben: UI-Aktualisierung nach Konfigurationsänderungen

## [0.2.0] - 2025-04-29

### Hinzugefügt
- Grafische Benutzeroberfläche in der Seitenleiste zur einfachen Konfiguration
- Status-Ansicht mit Übersicht über aktuelle Einstellungen
- Einstellungs-Ansicht zur interaktiven Konfiguration aller Parameter
- Icon für die Extension und die Seitenleiste
- Verbesserte Befehlsstruktur für einfachen Zugriff
- Zusätzliche Benutzerführung und Hilfetexte

### Verbessert
- Modularisierung des Codes für bessere Wartbarkeit
- Benutzerfreundlichkeit durch grafische Oberfläche statt JSON-Konfiguration
- UI/UX mit klaren visuellen Indikatoren und Feedback

## [0.1.0] - 2025-04-29

### Hinzugefügt
- Unterstützung für mehrere KI-Provider: Ollama, OpenAI und Anthropic
- Manuelle KI-Commit-Funktion über den Befehl "comitto.performManualCommit"
- Erweiterte Trigger-Regeln mit zeitbasiertem Schwellenwert und Dateimuster
- Umfangreiche Git-Einstellungen (Repository-Pfad, Auto-Push, Branch, etc.)
- Volle Unterstützung für .gitignore-Dateien
- Anpassbare Prompt-Vorlage für die KI-Generierung
- Bessere Handhabung von Sonderzeichen in Commit-Nachrichten

### Verbessert
- Qualität der generierten Commit-Nachrichten durch Einbeziehung von Diff-Informationen
- Benutzeroberfläche mit besseren Icons und Tooltips
- Fehlerbehandlung und Benutzerrückmeldungen
- Konfigurationsmanagement mit automatischer Aktualisierung bei Änderungen

## [0.0.1] - 2025-04-29

### Hinzugefügt
- Erste Version der Erweiterung
- Automatische Commit-Funktionalität mit konfigurierbaren Triggern
- Integration mit Ollama für KI-generierte Commit-Nachrichten
- Statusleistenelement zur Anzeige des aktuellen Status
- Befehle zum Aktivieren/Deaktivieren der automatischen Commits
- Grundlegende Konfigurationsoptionen (Ollama-Endpunkt, Modell, Trigger-Regeln) 