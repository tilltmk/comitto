# Comitto

<p align="center">
  <img src="comitto.png" alt="Comitto Logo" width="200"/>
</p>

Automatisierte Git-Commits mit KI-generierten Commit-Nachrichten

---

[![Version](https://img.shields.io/badge/version-2.3.0-blue.svg)](https://marketplace.visualstudio.com/items?itemName=tilltmk.comitto)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[English Version](README_EN.md) | Deutsche Version

## Inhaltsverzeichnis

- [Features](#features)
- [Installation](#installation)
- [Konfiguration](#konfiguration)
  - [KI-Provider](#ki-provider)
  - [Commit-Entscheidungslogik](#commit-entscheidungslogik)
  - [Trigger-Regeln](#trigger-regeln)
  - [Guardian-Einstellungen](#guardian-einstellungen)
  - [Commit-Stile](#commit-stile)
- [Verwendung](#verwendung)
- [Einstellungs-Referenz](#einstellungs-referenz)
- [Versionshistorie](#versionshistorie)
- [Support](#support)

## Features

![Comitto Dashboard](https://github.com/user-attachments/assets/3fb666f0-114b-4bd3-a10d-b5eef0c667e8)

- **Automatische Commits**: Überwacht Dateiänderungen und führt Commits automatisch basierend auf konfigurierbaren Triggern durch
- **KI-generierte Commit-Nachrichten**: Nutzt OpenAI (Standard `gpt-4.1-mini`), Anthropic Claude oder Ollama zur Generierung aussagekräftiger Commit-Nachrichten
- **Commit Guardian**: Intelligente Schutzlogik mit Cooldown, Ruhezeiten, Branch-Schutz und Keyword-Filtern
- **Visuelle Statusanzeige**: Fortschrittsbalken und detailliertes Feedback während des Commit-Prozesses
- **Konfigurierbare Trigger**: Kontrolle, wann Commits ausgeführt werden sollen mit mehreren Trigger-Optionen
- **Dashboard**: Übersichtliche Darstellung von Aktivitäten und Einstellungen mit moderner UI
- **VSCode Integration**: Vollständig in die IDE integriert mit Sidebar, Statusleiste und Befehlspalette
- **Flexible Commit-Stile**: Unterstützung für Conventional Commits, Gitmoji, Angular, Atom und Simple-Stile
- **Mehrsprachig**: Generierung von Commit-Nachrichten auf Deutsch oder Englisch

## Installation

1. Installieren Sie die Extension über den VSCode Marketplace
2. Suchen Sie nach "Comitto" oder installieren Sie direkt von [marketplace.visualstudio.com](https://marketplace.visualstudio.com/items?itemName=tilltmk.comitto)
3. Konfigurieren Sie Ihren bevorzugten KI-Provider (siehe [KI-Provider](#ki-provider))
4. Aktivieren Sie automatische Commits, wenn Sie bereit sind

## Konfiguration

### KI-Provider

Comitto unterstützt drei KI-Provider zur Generierung von Commit-Nachrichten:

#### OpenAI

- **API-Schlüssel**: Erforderlich (erhältlich bei [platform.openai.com](https://platform.openai.com))
- **Modelle**:
  - `gpt-4.1-mini` (empfohlen, Standard)
  - `gpt-4`
  - `gpt-3.5-turbo`
  - Weitere OpenAI-Modelle
- **Konfiguration**: Setzen über `comitto.openai.apiKey` und `comitto.openai.model`

#### Anthropic Claude

- **API-Schlüssel**: Erforderlich (erhältlich bei [console.anthropic.com](https://console.anthropic.com))
- **Modelle**:
  - `claude-3-haiku-20240307` (schnell, kosteneffizient, Standard)
  - `claude-3-sonnet-20240229` (ausgewogen)
  - `claude-3-opus-20240229` (leistungsstärkste)
- **Konfiguration**: Setzen über `comitto.anthropic.apiKey` und `comitto.anthropic.model`

#### Ollama

- **API-Schlüssel**: Nicht erforderlich (lokale Installation)
- **Endpoint**: Standard `http://localhost:11434/api/generate`
- **Modelle**: Jedes lokal installierte Ollama-Modell (Standard: `granite3.3:2b`)
- **Konfiguration**: Setzen über `comitto.ollama.endpoint` und `comitto.ollama.model`
- **Setup**: Installieren Sie Ollama von [ollama.ai](https://ollama.ai) und laden Sie Ihr gewünschtes Modell herunter

### Commit-Entscheidungslogik

Comitto verwendet ein ausgeklügeltes Entscheidungssystem, um zu bestimmen, wann automatische Commits erstellt werden. Die Entscheidung basiert auf mehreren Faktoren:

#### 1. Trigger-Regeln

Commits werden ausgelöst, wenn **eine** der folgenden Bedingungen erfüllt ist:

##### On-Save-Trigger
- **Einstellung**: `comitto.triggerRules.onSave`
- **Beschreibung**: Löst eine Commit-Evaluation aus, wenn Dateien gespeichert werden
- **Anwendungsfall**: Ideal für häufige kleine Commits während aktiver Entwicklung
- **Standard**: `true`

##### Intervall-Trigger
- **Einstellung**: `comitto.triggerRules.onInterval`
- **Beschreibung**: Evaluiert Commits automatisch in regelmäßigen Abständen
- **Intervall-Einstellung**: `comitto.triggerRules.intervalMinutes` (Standard: 15 Minuten)
- **Anwendungsfall**: Nützlich für Hintergrundarbeit oder wenn Sie das Speichern vergessen
- **Standard**: `false`

##### Branch-Wechsel-Trigger
- **Einstellung**: `comitto.triggerRules.onBranchSwitch`
- **Beschreibung**: Committet ausstehende Änderungen vor dem Wechseln von Branches
- **Anwendungsfall**: Stellt saubere Branch-Wechsel ohne Verlust von Arbeit sicher
- **Standard**: `false`

#### 2. Änderungs-Schwellwerte

Selbst wenn ein Trigger ausgelöst wird, erfolgen Commits nur, wenn bestimmte Schwellwerte erreicht werden:

##### Dateianzahl-Schwellwert
- **Einstellung**: `comitto.triggerRules.fileCountThreshold`
- **Beschreibung**: Mindestanzahl geänderter Dateien für Auto-Commit
- **Standard**: `3`
- **Beispiel**: Mit Schwellwert 3 erfolgen Commits nur, wenn 3 oder mehr Dateien Änderungen haben

##### Minimale Änderungsanzahl
- **Einstellung**: `comitto.triggerRules.minChangeCount`
- **Beschreibung**: Mindestanzahl von Zeilenänderungen erforderlich
- **Standard**: `10`
- **Beispiel**: Verhindert Commits für triviale Einzeilen-Änderungen

##### Zeit-Schwellwert
- **Einstellung**: `comitto.triggerRules.timeThresholdMinutes`
- **Beschreibung**: Mindestzeit (in Minuten), die seit dem letzten Auto-Commit vergangen sein muss
- **Standard**: `30`
- **Beispiel**: Verhindert zu häufige Commits, auch wenn andere Bedingungen erfüllt sind

#### 3. Dateimuster

- **Einstellung**: `comitto.triggerRules.filePatterns`
- **Beschreibung**: Glob-Muster zum Ein-/Ausschließen von Dateien vom Auslösen von Commits
- **Standard**: `["**/*"]` (alle Dateien)
- **Beispiele**:
  - `["src/**/*.ts"]` - Nur TypeScript-Dateien im src-Ordner
  - `["**/*.{js,ts}"]` - Alle JavaScript- und TypeScript-Dateien
  - `["!**/test/**"]` - Test-Verzeichnisse ausschließen

### Guardian-Einstellungen

Der Guardian ist ein intelligentes Schutzsystem, das unangemessene automatische Commits verhindert:

#### Intelligenter Commit-Schutz
- **Einstellung**: `comitto.guardian.smartCommitProtection`
- **Beschreibung**: Hauptschalter für alle Guardian-Funktionen
- **Standard**: `true`
- **Auswirkung**: Bei Deaktivierung werden alle Guardian-Checks umgangen (außer bei manuellen Commits)

#### Cooldown-Zeitraum
- **Einstellung**: `comitto.guardian.coolDownMinutes`
- **Beschreibung**: Mindestzeit zwischen automatischen Commits
- **Standard**: `5` Minuten
- **Anwendungsfall**: Verhindert Commit-Spam während schneller Entwicklung
- **Verhalten**: Zeigt verbleibende Cooldown-Zeit in Benachrichtigung an

#### Dirty-Workspace-Schutz
- **Einstellung**: `comitto.guardian.blockOnDirtyWorkspace`
- **Beschreibung**: Blockiert Auto-Commits, wenn Dateien ungespeicherte Änderungen haben
- **Standard**: `true`
- **Anwendungsfall**: Stellt sicher, dass alle Änderungen vor dem Committen gespeichert sind

#### Debug-Sitzungs-Erkennung
- **Einstellung**: `comitto.guardian.skipWhenDebugging`
- **Beschreibung**: Pausiert Auto-Commits während aktiver Debug-Sitzungen
- **Standard**: `true`
- **Anwendungsfall**: Verhindert Commits während des Debuggens, erlaubt fokussiertes Arbeiten

#### Große-Änderungen-Bestätigung
- **Einstellung**: `comitto.guardian.confirmOnLargeChanges`
- **Beschreibung**: Erfordert manuelle Bestätigung für große Diffs
- **Schwellwert**: `comitto.guardian.maxDiffSizeKb` (Standard: 512 KB)
- **Standard**: `true`
- **Verhalten**: Zeigt Dialog mit Diff-Größe und Bestätigungsbuttons

#### Dateianzahl-Schutz
- **Einstellung**: `comitto.guardian.maxFilesWithoutPrompt`
- **Beschreibung**: Maximale Dateien, die ohne Bestätigung committet werden können
- **Standard**: `8`
- **Verhalten**: Zeigt Bestätigungsdialog bei Überschreitung

#### Geschützte Branches
- **Einstellung**: `comitto.guardian.protectedBranches`
- **Beschreibung**: Branches, die Bestätigung vor Auto-Commit erfordern
- **Standard**: `["main", "master", "release/*"]`
- **Muster-Unterstützung**: Unterstützt Wildcards (z.B. `release/*`, `hotfix/*`)
- **Verhalten**: Zeigt Warndialog vor Committen auf geschützten Branches

#### Ruhezeiten
- **Einstellung**: `comitto.guardian.quietHours`
- **Beschreibung**: Zeitfenster, in denen Auto-Commits ausgesetzt werden
- **Format**: `["HH:MM-HH:MM"]` (24-Stunden-Format)
- **Standard**: `[]` (keine Ruhezeiten)
- **Beispiele**:
  - `["22:00-08:00"]` - Keine Commits zwischen 22 Uhr und 8 Uhr
  - `["12:00-13:00", "18:00-19:00"]` - Mittags- und Abendessenspausen

#### Keyword-Erkennung
- **Einstellung**: `comitto.guardian.keywordsRequiringConfirmation`
- **Beschreibung**: Schlüsselwörter in Diffs, die Bestätigungsdialoge auslösen
- **Standard**: `["WIP", "DO-NOT-COMMIT"]`
- **Anwendungsfall**: Verhindert versehentliche Commits von Work-in-Progress oder Debug-Code
- **Erkennung**: Groß-/Kleinschreibung-unabhängige Suche in Diff und Status-Ausgabe

### Commit-Stile

Comitto unterstützt mehrere Commit-Nachricht-Stile:

#### Conventional Commits
- **Einstellungswert**: `"conventional"`
- **Format**: `type: beschreibung`
- **Typen**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
- **Beispiel**: `feat: Benutzerauthentifizierung hinzufügen`

#### Gitmoji
- **Einstellungswert**: `"gitmoji"`
- **Format**: `emoji beschreibung`
- **Emojis**: 🎉 (initial), 🐛 (bugfix), 📚 (docs), 💄 (UI), etc.
- **Beispiel**: `🎉 Benutzerauthentifizierung hinzufügen`

#### Angular
- **Einstellungswert**: `"angular"`
- **Format**: `type(scope): beschreibung`
- **Beispiel**: `feat(auth): Benutzerauthentifizierung hinzufügen`

#### Atom
- **Einstellungswert**: `"atom"`
- **Format**: `:emoji: beschreibung`
- **Beispiel**: `:sparkles: Benutzerauthentifizierung hinzufügen`

#### Simple
- **Einstellungswert**: `"simple"`
- **Format**: Einfache beschreibende Nachrichten
- **Beispiel**: `Benutzerauthentifizierung hinzufügen`

**Konfiguration**: Setzen über `comitto.gitSettings.commitMessageStyle`

### Commit-Nachricht-Sprache

- **Einstellung**: `comitto.gitSettings.commitMessageLanguage`
- **Optionen**: `"en"` (Englisch) oder `"de"` (Deutsch)
- **Standard**: `"de"`
- **Auswirkung**: Beeinflusst die Sprache der KI-generierten Commit-Nachricht

## Verwendung

### Statusleiste

Das Statusleisten-Element zeigt den aktuellen Comitto-Status:
- **Idle**: Grün, zeigt "Überwacht" oder "Watching"
- **In Bearbeitung**: Blau mit Fortschritt in Prozent
- **Fehler**: Rot mit Fehlerindikator
- **Klick**: Öffnet Schnellaktionen-Menü

### Sidebar-Ansicht

Zugriff auf die Comitto-Sidebar über die Aktivitätsleiste:
- **Status-Karte**: Aktueller Zustand und schnelles Umschalten
- **Schnellaktionen**: Manueller Commit, Aktualisieren, Dashboard
- **Einstellungs-Übersicht**: KI-Provider, Trigger, Guardian-Status
- **Debug-Logs**: Detaillierte Ausführungsprotokolle (wenn Debug aktiviert)

### Dashboard

Öffnen mit Befehl `Comitto: Show Dashboard`:
- **Aktivitäts-Monitor**: Letzte Commits und Statistiken
- **Konfiguration**: Visuelle Editoren für alle Einstellungen
- **Trigger-Konfiguration**: Umschalten und Konfigurieren von Triggern
- **Guardian-Konfiguration**: Verwaltung der Schutzeinstellungen
- **KI-Provider-Setup**: Konfiguration von API-Schlüsseln und Modellen

### Simple UI

Vereinfachte Oberfläche für schnelle Konfiguration:
- Öffnen mit `Comitto: Show Simple User Interface`
- Karten für essentielle Einstellungen
- Guardian-Schnellkonfiguration
- Ideal für erstmalige Einrichtung

### Befehle

Alle Befehle verfügbar über Befehlspalette (`Strg+Umschalt+P` oder `Cmd+Shift+P`):

- `Comitto: Enable Automatic Commits` - Auto-Commit-Überwachung starten
- `Comitto: Disable Automatic Commits` - Auto-Commit-Überwachung stoppen
- `Comitto: Toggle Automatic Commits` - Schnelles Aktivieren/Deaktivieren
- `Comitto: Perform Manual AI Commit` - Sofort generieren und committen
- `Comitto: Show Dashboard` - Konfigurations-Dashboard öffnen
- `Comitto: Show Simple User Interface` - Vereinfachte UI öffnen
- `Comitto: Configure AI Provider` - OpenAI, Anthropic oder Ollama einrichten
- `Comitto: Configure Triggers` - Trigger-Regeln verwalten
- `Comitto: Configure Guardian` - Schutzeinstellungen verwalten
- `Comitto: Select Commit Style` - Commit-Nachricht-Format wählen
- `Comitto: Select Commit Language` - Nachrichtensprache wählen
- `Comitto: Toggle Auto Push` - Automatisches Git-Push aktivieren/deaktivieren
- `Comitto: Edit Branch` - Ziel-Branch für Commits festlegen
- `Comitto: Select Stage Mode` - Staging-Strategie wählen
- `Comitto: Refresh Settings` - Konfiguration neu laden

## Einstellungs-Referenz

### Kern-Einstellungen

| Einstellung | Typ | Standard | Beschreibung |
|-------------|-----|----------|--------------|
| `comitto.autoCommitEnabled` | boolean | `false` | Automatische Commits aktivieren/deaktivieren |
| `comitto.aiProvider` | string | `"openai"` | KI-Provider: `openai`, `anthropic` oder `ollama` |

### Trigger-Regeln

| Einstellung | Typ | Standard | Beschreibung |
|-------------|-----|----------|--------------|
| `comitto.triggerRules.onSave` | boolean | `true` | Trigger bei Dateispeicherung |
| `comitto.triggerRules.onInterval` | boolean | `false` | Trigger in Intervallen |
| `comitto.triggerRules.onBranchSwitch` | boolean | `false` | Trigger bei Branch-Wechsel |
| `comitto.triggerRules.intervalMinutes` | number | `15` | Intervalldauer |
| `comitto.triggerRules.fileCountThreshold` | number | `3` | Mindestdateien für Commit |
| `comitto.triggerRules.minChangeCount` | number | `10` | Minimale Zeilenänderungen |
| `comitto.triggerRules.timeThresholdMinutes` | number | `30` | Mindestzeit zwischen Commits |
| `comitto.triggerRules.filePatterns` | array | `["**/*"]` | Zu überwachende Dateimuster |

### Git-Einstellungen

| Einstellung | Typ | Standard | Beschreibung |
|-------------|-----|----------|--------------|
| `comitto.gitSettings.autoPush` | boolean | `false` | Auto-Push nach Commit |
| `comitto.gitSettings.pullBeforePush` | boolean | `true` | Pull vor Push |
| `comitto.gitSettings.stageMode` | string | `"all"` | Staging-Modus: `all`, `modified`, `pattern` |
| `comitto.gitSettings.branch` | string | `""` | Ziel-Branch (leer = aktuell) |
| `comitto.gitSettings.useGitignore` | boolean | `true` | .gitignore-Regeln beachten |
| `comitto.gitSettings.commitMessageStyle` | string | `"gitmoji"` | Commit-Stil-Format |
| `comitto.gitSettings.commitMessageLanguage` | string | `"de"` | Nachrichtensprache |
| `comitto.gitSettings.maxCommitAttempts` | number | `3` | Wiederholungsversuche bei Fehler |

### Guardian-Einstellungen

| Einstellung | Typ | Standard | Beschreibung |
|-------------|-----|----------|--------------|
| `comitto.guardian.smartCommitProtection` | boolean | `true` | Guardian-Schutz aktivieren |
| `comitto.guardian.coolDownMinutes` | number | `5` | Cooldown zwischen Commits |
| `comitto.guardian.maxFilesWithoutPrompt` | number | `8` | Max. Dateien ohne Bestätigung |
| `comitto.guardian.confirmOnLargeChanges` | boolean | `true` | Große Diffs bestätigen |
| `comitto.guardian.maxDiffSizeKb` | number | `512` | Große-Diff-Schwellwert (KB) |
| `comitto.guardian.blockOnDirtyWorkspace` | boolean | `true` | Blockieren bei ungespeicherten Dateien |
| `comitto.guardian.skipWhenDebugging` | boolean | `true` | Pausieren während Debug |
| `comitto.guardian.quietHours` | array | `[]` | Zeitfenster zum Pausieren |
| `comitto.guardian.protectedBranches` | array | `["main", "master", "release/*"]` | Branches mit Bestätigungspflicht |
| `comitto.guardian.keywordsRequiringConfirmation` | array | `["WIP", "DO-NOT-COMMIT"]` | Keywords, die Bestätigung auslösen |

### KI-Provider-Einstellungen

#### OpenAI

| Einstellung | Typ | Standard | Beschreibung |
|-------------|-----|----------|--------------|
| `comitto.openai.apiKey` | string | `""` | OpenAI-API-Schlüssel |
| `comitto.openai.model` | string | `"gpt-4.1-mini"` | Zu verwendendes Modell |

#### Anthropic

| Einstellung | Typ | Standard | Beschreibung |
|-------------|-----|----------|--------------|
| `comitto.anthropic.apiKey` | string | `""` | Anthropic-API-Schlüssel |
| `comitto.anthropic.model` | string | `"claude-3-haiku-20240307"` | Zu verwendendes Modell |

#### Ollama

| Einstellung | Typ | Standard | Beschreibung |
|-------------|-----|----------|--------------|
| `comitto.ollama.endpoint` | string | `"http://localhost:11434/api/generate"` | Ollama-API-Endpoint |
| `comitto.ollama.model` | string | `"granite3.3:2b"` | Modellname |

### UI-Einstellungen

| Einstellung | Typ | Standard | Beschreibung |
|-------------|-----|----------|--------------|
| `comitto.uiSettings.simpleMode` | boolean | `false` | Vereinfachte UI verwenden |
| `comitto.uiSettings.confirmBeforeCommit` | boolean | `true` | Vor manuellen Commits bestätigen |
| `comitto.uiSettings.showNotifications` | boolean | `true` | Benachrichtigungen anzeigen |
| `comitto.uiSettings.theme` | string | `"auto"` | UI-Theme: `auto`, `light`, `dark` |

### Benachrichtigungs-Einstellungen

| Einstellung | Typ | Standard | Beschreibung |
|-------------|-----|----------|--------------|
| `comitto.notifications.onCommit` | boolean | `true` | Bei erfolgreichem Commit benachrichtigen |
| `comitto.notifications.onPush` | boolean | `true` | Bei erfolgreichem Push benachrichtigen |
| `comitto.notifications.onError` | boolean | `true` | Bei Fehlern benachrichtigen |
| `comitto.notifications.onTriggerFired` | boolean | `false` | Bei Trigger-Auslösung benachrichtigen |

### Debug-Einstellungen

| Einstellung | Typ | Standard | Beschreibung |
|-------------|-----|----------|--------------|
| `comitto.debug.enabled` | boolean | `false` | Debug-Protokollierung aktivieren |
| `comitto.debug.extendedLogging` | boolean | `false` | Ausführliche Protokollierung |
| `comitto.debug.commitDiagnostics` | boolean | `false` | Commit-Diagnose protokollieren |

## Versionshistorie

### Version 2.3.0 (Aktuell)

- Erweiterte Git-Integration mit neuen Befehlen
- Auto-Push-Konfiguration
- Branch-Bearbeitungsunterstützung
- Commit-Stil- und Sprachauswahl
- Aktualisierter UI-Provider mit verbesserter Fehlerbehandlung
- Zentralisierte Einstellungsverwaltung mit Guardian

### Version 2.2.6

- Verbesserte Statusleiste mit visuellem Fortschrittsindikator
- Erweiterte Fehlerbehandlung für alle KI-Provider
- Visuelles Feedback während Commit-Generierung
- Bessere Modellauswahl für OpenAI mit Icons und Kategorien

### Version 2.1.0

- Commit Guardian mit Schnellkonfiguration
- Überarbeiteter Settings-Manager mit Validierung
- Sanfte Migration alter Ollama-Modelle
- Echtzeit-Reaktion auf Konfigurationsänderungen
- Modernisierte Dashboard-UI
- Guardian-Karten in einfacher Oberfläche

### Version 2.0.0

- Multi-Provider-KI-Unterstützung (OpenAI, Anthropic, Ollama)
- Konfigurierbare Trigger (Save, Interval, Branch-Switch)
- Fortgeschrittenes Schwellwert-System
- Dashboard und Simple UI
- Umfassendes Benachrichtigungssystem

## Support

Für Fragen, Probleme oder Feature-Anfragen:

- **GitHub Issues**: [github.com/tilltmk/comitto/issues](https://github.com/tilltmk/comitto/issues)
- **Dokumentation**: Siehe diese README und In-App-Tooltips
- **Häufige Fehler**: Prüfen Sie `COMMON_ERRORS.md` im Repository

## Lizenz

MIT-Lizenz - Siehe LICENSE.txt für Details

---

Erstellt mit ❤️ von [tilltmk](https://github.com/tilltmk)
