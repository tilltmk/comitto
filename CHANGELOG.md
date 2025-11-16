# Änderungsprotokoll

Alle wichtigen Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

## [2.6.0] - 2025-11-16

### Hinzugefügt
- Automatisches Cleanup alter Log-Dateien zur Vermeidung von Speicherüberlauf
- Verbesserte Log-Verwaltung mit konfigurierbarer Aufbewahrungsdauer

### Verbessert
- Entfernung störender Pop-Up-Nachrichten für bessere Benutzererfahrung
- Optimierte Benachrichtigungslogik mit weniger Unterbrechungen
- Verbessertes Log-Cleanup-System für bessere Performance

### Geändert
- Aktualisierte Abhängigkeiten auf neueste stabile Versionen

## [2.5.0] - 2025-11-15

### Hinzugefügt
- Verbesserte Modellauswahl mit manueller Eingabemöglichkeit für alle Provider
- Ollama-Endpoint-Bearbeitung direkt im Menü verfügbar

### Verbessert
- Flexiblere KI-Provider-Konfiguration
- Benutzerfreundlichere Einstellungsoberfläche

## [2.2.0] - 2024-07-15

### Verbessert
- Vermeidung der globalen Variable `statusBarItem` zugunsten einer Closure-Lösung
- Verbesserte Fehlerbehandlung mit try/catch-Blöcken für alle asynchronen Operationen
- Konsistente Fehlerbehandlung in allen Funktionen mit Kontext-Informationen
- Mindestanforderung für VSCode-Version auf 1.74.0 aktualisiert

### Hinzugefügt
- Fehlende Befehle implementiert: `comitto.showDashboard`, `comitto.showSimpleUI`, `comitto.selectAiProvider`
- Automatische Wiederherstellung des Statusleisten-Status nach Fehlern
- Verbesserte Prompt-Generierung mit intelligenter Diff-Verarbeitung
- Bessere Verarbeitung von Commit-Nachrichten mit Unterstützung für mehrzeilige Formate

### Behoben
- Problem mit fehlenden Befehlen in der Befehlspalette behoben
- Fehlerbehandlung bei der KI-Generierung verbessert
- Korrektur der Befehlsregistrierung für konsistente Benennung

## [2.2.1] - 2024-10-30

### Fehlerbehebungen
- Fehlerhafte Befehlsregistrierung behoben, die zum Fehlen von UI-Komponenten und Befehlen führte
- Alle fehlenden Befehle wurden korrekt implementiert und registriert
- Aktivierungsereignisse in package.json aktualisiert, um alle Befehle zu unterstützen

## [2.1.0] - 2024-06-01

### Hinzugefügt
- Verbesserte Statusleiste mit visuellem Fortschrittsbalken
- Verbesserte Fehlerbehandlung für alle KI-Provider
- Visuelles Feedback während der Commit-Generierung
- Bessere Modellauswahl für OpenAI mit Icons und Kategorien

### Geändert
- Die Funktion `updateStatusBarProgress` wurde zur besseren Übersichtlichkeit in utils.js verschoben
- Verbesserte Fehleranzeige im Fehlerfall
- Fehlerprotokolle enthalten jetzt detailliertere Informationen

### Behoben
- Problem mit nicht definierten Funktionen aus extension.js
- Fehler "getStatusText is not defined" in commands.js behoben
- Fehler "generateWithOllama is not defined" behoben durch verbesserte Import-Struktur
- Verbesserte Performance bei der KI-Generierung

## [2.0.0] - 2024-05-15

### Hinzugefügt
- Unterstützung für Ollama als lokalen KI-Provider
- Dashboard zur Überwachung und Konfiguration
- Einfache Benutzeroberfläche für schnelle Commits
- Detaillierte Fehlerbehandlung und Protokollierung

### Geändert
- Vollständige Überarbeitung der Benutzeroberfläche
- Verbesserte Konfigurationsmöglichkeiten
- Optimierte Generierung von Commit-Nachrichten

## [1.0.0] - 2024-03-01

### Hinzugefügt
- Erste öffentliche Version
- Unterstützung für OpenAI und Anthropic Claude
- Automatische Commits basierend auf Dateiänderungen
- VSCode-Integration mit Statusleiste und Befehlen

## [0.9.6] - 2025-05-15

### Behoben
- Kritischer Fehler behoben: `maxBuffer length exceeded` bei Git-Diff von großen Änderungen
- Verbesserte Puffergröße für Git-Befehle von 10 MB auf 50 MB erhöht
- Intelligente Diff-Verarbeitung implementiert, um auch sehr große Änderungen zu unterstützen
- Spezifische Fehlerbehandlung für Pufferüberlauf-Fehler hinzugefügt
- Alternative Strategie für große Diffs: Fallback auf Dateilistendarstellung
- Benutzerfreundlichere Fehlermeldungen bei Pufferüberlauf

### Verbessert
- Robustere Verarbeitung von Git-Befehlen mit großen Ausgaben
- Bessere Fehlerbehandlung und aussagekräftigere Benutzermeldungen
- Optimierte Diff-Kürzung mit Fokus auf die wichtigsten Änderungen

## [0.9.5] - 2025-04-29

### Behoben
- Kritischen Fehler bei der Aktivierung behoben: fehlende utils.js-Datei hinzugefügt
- Konflikte bei Funktionsdefinitionen zwischen extension.js und ui.js beseitigt
- getStatusDescription-Funktionalität korrekt zwischen allen Modulen aufgeteilt
- Module-Exports in ui.js um fehlende Funktionen erweitert

### Verbessert
- Robustere Fehlerbehandlung beim Import von Abhängigkeiten
- Bessere Strukturierung der Hilfsfunktionen
- Konsistente Nutzung importierter Funktionen

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