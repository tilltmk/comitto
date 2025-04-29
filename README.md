# Comitto - Automatische Git Commits mit KI

Comitto ist eine VS Code-Erweiterung, die automatisch Commit-Nachrichten mit verschiedenen KI-Modellen (Ollama, OpenAI, Anthropic) generiert und Commits durchführt, ohne dass der Benutzer eingreifen muss.

## Funktionen

- **Automatische Commits**: Führt Git-Commits basierend auf konfigurierbaren Regeln durch
- **KI-generierte Commit-Nachrichten**: Nutzt Ollama, OpenAI oder Anthropic für qualitativ hochwertige Commit-Nachrichten
- **Konfigurierbare Trigger**: Passt an, wann automatische Commits ausgeführt werden sollen
- **Umfangreiche Git-Einstellungen**: Konfigurieren Sie Repository-Pfad, Branch, Auto-Push und mehr
- **Anpassbare Prompts**: Passen Sie die Vorlage für die Generierung von Commit-Nachrichten an
- **Statusanzeige**: Zeigt den aktuellen Status der Erweiterung in der VS Code-Statusleiste an

## Voraussetzungen

- Visual Studio Code Version 1.70.0 oder höher
- Git muss auf dem System installiert und im Workspace initialisiert sein
- Je nach Konfiguration: Ollama lokal oder API-Schlüssel für OpenAI/Anthropic

## KI-Provider einrichten

### Ollama (lokal)

Besuchen Sie [ollama.com](https://ollama.com/), um Ollama für Ihr Betriebssystem zu installieren.

Nach der Installation starten Sie Ollama und laden ein Modell:

```
ollama pull llama3
```

### OpenAI

Für die Verwendung von OpenAI benötigen Sie einen API-Schlüssel.

1. Besuchen Sie [platform.openai.com](https://platform.openai.com/)
2. Erstellen Sie ein Konto oder melden Sie sich an
3. Navigieren Sie zum API-Bereich und erstellen Sie einen API-Schlüssel
4. Kopieren Sie den Schlüssel in die Einstellungen der Erweiterung

### Anthropic

Für die Verwendung von Anthropic benötigen Sie einen API-Schlüssel.

1. Besuchen Sie [console.anthropic.com](https://console.anthropic.com/)
2. Erstellen Sie ein Konto oder melden Sie sich an
3. Erstellen Sie einen API-Schlüssel
4. Kopieren Sie den Schlüssel in die Einstellungen der Erweiterung

## Konfiguration

Diese Erweiterung bietet folgende Konfigurationsoptionen:

| Einstellung | Beschreibung | Standardwert |
|-------------|--------------|--------------|
| `comitto.aiProvider` | KI-Provider für die Generierung von Commit-Nachrichten (ollama, openai, anthropic) | `ollama` |
| `comitto.ollama.endpoint` | Ollama API-Endpunkt | `http://localhost:11434/api/generate` |
| `comitto.ollama.model` | Ollama-Modell für die Generierung von Commit-Nachrichten | `llama3` |
| `comitto.openai.apiKey` | OpenAI API-Schlüssel | `` |
| `comitto.openai.model` | OpenAI-Modell für die Generierung von Commit-Nachrichten | `gpt-3.5-turbo` |
| `comitto.anthropic.apiKey` | Anthropic API-Schlüssel | `` |
| `comitto.anthropic.model` | Anthropic-Modell für die Generierung von Commit-Nachrichten | `claude-3-haiku-20240307` |
| `comitto.autoCommitEnabled` | Aktiviert oder deaktiviert automatische Commits | `false` |
| `comitto.triggerRules` | Regeln, die automatische Commits auslösen | Siehe unten |
| `comitto.gitSettings` | Git-Einstellungen für Commits | Siehe unten |
| `comitto.promptTemplate` | Anpassbare Vorlage für die Generierung von Commit-Nachrichten | Siehe unten |

### Trigger-Regeln

Die Trigger-Regeln können wie folgt konfiguriert werden:

```json
"comitto.triggerRules": {
  "fileCountThreshold": 3,     // Anzahl der geänderten Dateien, die einen Commit auslösen
  "specificFiles": [           // Bestimmte Dateien, bei deren Änderung ein Commit ausgelöst wird
    "package.json",
    "README.md"
  ],
  "minChangeCount": 10,        // Minimale Anzahl an Änderungen, die einen Commit auslösen
  "timeThresholdMinutes": 30,  // Minimale Zeit in Minuten zwischen automatischen Commits
  "filePatterns": ["**/*"]     // Glob-Muster für zu überwachende Dateien
}
```

### Git-Einstellungen

Die Git-Einstellungen können wie folgt konfiguriert werden:

```json
"comitto.gitSettings": {
  "repositoryPath": "",        // Optionaler Pfad zum Git-Repository (standardmäßig Workspace-Ordner)
  "autoPush": false,           // Automatisch nach dem Commit pushen
  "branch": "",                // Optionaler Branch-Name für Commits (leerlassen für aktuellen Branch)
  "commitMessageLanguage": "de", // Sprache für die Commit-Nachricht (de, en, fr, ...)
  "commitMessageStyle": "conventional", // Stil der Commit-Nachricht (conventional, gitmoji, ...)
  "useGitignore": true         // .gitignore-Datei für das Ignorieren von Dateien verwenden
}
```

### Prompt-Vorlage

Sie können die Vorlage für die KI-Generierung anpassen:

```
"comitto.promptTemplate": "Generiere eine aussagekräftige Commit-Nachricht für die folgenden Änderungen: \n\n{changes}\n\nVerwende das Conventional Commits Format (feat, fix, docs, etc.) und halte die Nachricht unter 80 Zeichen."
```

Der Platzhalter `{changes}` wird automatisch durch die Liste der geänderten Dateien ersetzt.

## Verwendung

1. Installieren Sie die Erweiterung in VS Code
2. Konfigurieren Sie den gewünschten KI-Provider und weitere Einstellungen
3. Aktivieren Sie die automatischen Commits über:
   - Den Befehl "Comitto: Automatische Commits aktivieren" im Befehls-Paletten (Strg+Shift+P)
   - Klicken auf das Comitto-Symbol in der Statusleiste
4. Arbeiten Sie normal weiter - die Erweiterung erledigt den Rest!
5. Sie können auch jederzeit einen manuellen KI-Commit mit dem Befehl "Comitto: Manuellen KI-Commit ausführen" durchführen

## Befehle

Die Erweiterung bietet folgende Befehle:

- `comitto.enableAutoCommit`: Aktiviert automatische Commits
- `comitto.disableAutoCommit`: Deaktiviert automatische Commits
- `comitto.toggleAutoCommit`: Wechselt zwischen aktiviertem und deaktiviertem Zustand
- `comitto.performManualCommit`: Führt einen manuellen KI-Commit durch

## Datenschutz und Sicherheit

Diese Erweiterung sendet Informationen über Ihre Code-Änderungen an den konfigurierten KI-Provider:

- **Ollama**: Da Ollama lokal auf Ihrem System ausgeführt wird, verlassen diese Daten Ihren Computer nicht.
- **OpenAI/Anthropic**: Bei Verwendung dieser Provider werden Ihre Änderungsinformationen an externe Server gesendet. Bitte lesen Sie die Datenschutzrichtlinien dieser Anbieter.

Sie können die Menge der gesendeten Informationen durch Anpassung der Prompt-Vorlage kontrollieren.

## Fehlerbehebung

Wenn Sie Probleme mit der Erweiterung haben:

1. Stellen Sie sicher, dass der ausgewählte KI-Provider korrekt konfiguriert ist
   - Ollama: Ollama muss ausgeführt werden und das konfigurierte Modell muss installiert sein
   - OpenAI/Anthropic: API-Schlüssel muss gültig sein
2. Überprüfen Sie, ob Git korrekt eingerichtet ist und `git status` im Workspace funktioniert
3. Überprüfen Sie die VS Code-Ausgabe der Erweiterung auf Fehlermeldungen

## Bekannte Einschränkungen

- Die Erweiterung funktioniert nur in Workspaces mit einem initialisierten Git-Repository
- Bei Verwendung von großen Diffs kann die Qualität der generierten Commit-Nachrichten variieren

## Lizenz

Diese Erweiterung unterliegt der MIT-Lizenz. 