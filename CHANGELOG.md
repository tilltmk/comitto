# Änderungsprotokoll

Alle wesentlichen Änderungen an der Comitto-Erweiterung werden in dieser Datei dokumentiert.

## [0.1.0] - 2023-12-15

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

## [0.0.1] - 2023-12-01

### Hinzugefügt
- Erste Version der Erweiterung
- Automatische Commit-Funktionalität mit konfigurierbaren Triggern
- Integration mit Ollama für KI-generierte Commit-Nachrichten
- Statusleistenelement zur Anzeige des aktuellen Status
- Befehle zum Aktivieren/Deaktivieren der automatischen Commits
- Grundlegende Konfigurationsoptionen (Ollama-Endpunkt, Modell, Trigger-Regeln) 