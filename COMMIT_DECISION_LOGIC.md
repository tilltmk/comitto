# Commit Decision Logic

This document provides a comprehensive explanation of how Comitto decides when to create automatic commits.

[English](#english) | [Deutsch](#deutsch)

---

## English

### Overview

Comitto uses a multi-layered decision system to determine when automatic commits should be created. The system ensures that commits are made at appropriate times while preventing inappropriate or disruptive commits through the Guardian protection system.

### Decision Flow

The commit decision process follows this flow:

```
1. Trigger Event Occurs
   ↓
2. Check if Auto-Commit is Enabled
   ↓
3. Evaluate Trigger Conditions
   ↓
4. Check Change Thresholds
   ↓
5. Guardian Pre-Conditions Check
   ↓
6. Stage Files & Generate Diff
   ↓
7. Guardian Post-Diff Check
   ↓
8. Generate Commit Message
   ↓
9. Execute Commit
   ↓
10. Optional: Auto-Push
```

### 1. Trigger Events

A trigger event is anything that signals Comitto to evaluate whether a commit should be made. Multiple trigger types can be enabled simultaneously:

#### On Save Trigger
- **Setting**: `comitto.triggerRules.onSave`
- **Default**: `true`
- **When it fires**: Every time a file is saved
- **Use case**: Continuous development with frequent saves
- **Behavior**: Fires immediately after save operation completes

#### Interval Trigger
- **Setting**: `comitto.triggerRules.onInterval`
- **Default**: `false`
- **When it fires**: At regular time intervals
- **Interval**: `comitto.triggerRules.intervalMinutes` (default: 15 minutes)
- **Use case**: Background work, long-running tasks
- **Behavior**: Timer starts when extension activates, resets after each interval

#### Branch Switch Trigger
- **Setting**: `comitto.triggerRules.onBranchSwitch`
- **Default**: `false`
- **When it fires**: Before switching to a different branch
- **Use case**: Ensures uncommitted work is saved before branch changes
- **Behavior**: Fires when VSCode git.checkout command is invoked

### 2. Auto-Commit Enabled Check

- **Setting**: `comitto.autoCommitEnabled`
- **Default**: `false`
- **Result**: If disabled, process stops immediately
- **Override**: Manual commits bypass this check

### 3. Trigger Condition Evaluation

When a trigger event fires, Comitto evaluates whether the specific trigger type is enabled:

```javascript
if (trigger === 'onSave' && !triggerRules.onSave) return false;
if (trigger === 'onInterval' && !triggerRules.onInterval) return false;
if (trigger === 'onBranchSwitch' && !triggerRules.onBranchSwitch) return false;
```

### 4. Change Thresholds

Even when a trigger fires, commits only occur if certain change thresholds are met. **All thresholds must be satisfied:**

#### File Count Threshold
- **Setting**: `comitto.triggerRules.fileCountThreshold`
- **Default**: `3`
- **Check**: Number of changed files ≥ threshold
- **Example**: With threshold of 3, at least 3 files must have changes

#### Minimum Change Count
- **Setting**: `comitto.triggerRules.minChangeCount`
- **Default**: `10`
- **Check**: Total number of line changes ≥ threshold
- **Calculation**: Additions + Deletions from `git diff --stat`
- **Example**: Prevents commits for trivial 1-2 line changes

#### Time Threshold
- **Setting**: `comitto.triggerRules.timeThresholdMinutes`
- **Default**: `30`
- **Check**: Time since last auto-commit ≥ threshold
- **Example**: Even if files change frequently, wait at least 30 minutes between auto-commits
- **Note**: This is checked **before** Guardian cooldown

#### File Pattern Matching
- **Setting**: `comitto.triggerRules.filePatterns`
- **Default**: `["**/*"]`
- **Check**: Changed files match at least one pattern
- **Pattern syntax**: Glob patterns (e.g., `src/**/*.ts`, `!**/test/**`)
- **Behavior**: If patterns are specified, only matching files count toward thresholds

### 5. Guardian Pre-Conditions

The Guardian performs several checks **before** staging files and generating diffs:

#### Smart Protection Master Switch
- **Setting**: `comitto.guardian.smartCommitProtection`
- **Default**: `true`
- **Effect**: When disabled, all guardian checks are bypassed
- **Note**: Manual commits skip Guardian checks regardless of this setting

#### Dirty Workspace Check
- **Setting**: `comitto.guardian.blockOnDirtyWorkspace`
- **Default**: `true`
- **Check**: Are there unsaved changes in open editors?
- **Reason**: Prevents committing while you're still editing
- **Result if blocked**: Shows warning notification, abort commit

#### Debug Session Check
- **Setting**: `comitto.guardian.skipWhenDebugging`
- **Default**: `true`
- **Check**: Is there an active debug session?
- **Reason**: Avoids interrupting debugging workflow
- **Result if blocked**: Shows info notification, abort commit

#### Cooldown Check
- **Setting**: `comitto.guardian.coolDownMinutes`
- **Default**: `5`
- **Check**: Has enough time passed since last auto-commit?
- **Calculation**: `(currentTime - lastCommitTime) / 60000 ≥ coolDownMinutes`
- **Difference from Time Threshold**: Guardian cooldown is stricter and checked **after** thresholds
- **Result if blocked**: Shows remaining cooldown time, abort commit

#### Quiet Hours Check
- **Setting**: `comitto.guardian.quietHours`
- **Default**: `[]`
- **Format**: Array of time ranges, e.g., `["22:00-08:00", "12:00-13:00"]`
- **Check**: Is current time within any quiet hour range?
- **Time format**: 24-hour format (HH:MM)
- **Behavior**: Ranges can span midnight (e.g., `22:00-08:00`)
- **Result if blocked**: Shows info notification, abort commit

#### Protected Branch Check
- **Setting**: `comitto.guardian.protectedBranches`
- **Default**: `["main", "master", "release/*"]`
- **Check**: Does current branch match any protected pattern?
- **Pattern matching**: Supports wildcards (`*`) and exact matches
- **Examples**:
  - `main` matches only "main"
  - `release/*` matches "release/1.0", "release/2.0", etc.
  - `hotfix/*` matches any branch starting with "hotfix/"
- **Result if matched**: Shows confirmation dialog, user must approve or abort

#### File Count Pre-Check
- **Setting**: `comitto.guardian.maxFilesWithoutPrompt`
- **Default**: `8`
- **Check**: Number of changed files ≥ threshold?
- **Result if exceeded**: Shows confirmation dialog with file count, user must approve or abort

### 6. Stage Files & Generate Diff

At this point, Comitto proceeds to stage files and generate a diff:

#### Staging Strategy
- **Setting**: `comitto.gitSettings.stageMode`
- **Options**:
  - `all`: Stage all changes (`git add .`)
  - `modified`: Stage only modified files (not new files)
  - `pattern`: Stage files matching specific patterns
- **Gitignore**: Respects .gitignore if `comitto.gitSettings.useGitignore` is true

#### Diff Generation
- **Command**: `git diff --cached`
- **Purpose**: Get actual content changes for AI and Guardian checks
- **Fallback**: If diff is too large or fails, uses `git diff --cached --name-status`

### 7. Guardian Post-Diff Checks

After generating the diff, Guardian performs additional checks:

#### Large Change Confirmation
- **Setting**: `comitto.guardian.confirmOnLargeChanges`
- **Default**: `true`
- **Threshold**: `comitto.guardian.maxDiffSizeKb` (default: 512 KB)
- **Check**: Is diff size ≥ threshold?
- **Calculation**: `Buffer.byteLength(diffOutput, 'utf8') / 1024`
- **Result if exceeded**: Shows confirmation dialog with diff size in KB, user must approve or abort

#### Keyword Detection
- **Setting**: `comitto.guardian.keywordsRequiringConfirmation`
- **Default**: `["WIP", "DO-NOT-COMMIT"]`
- **Check**: Does diff or git status contain any keywords?
- **Matching**: Case-insensitive
- **Search scope**: Both diff content and `git status --porcelain` output
- **Result if matched**: Shows confirmation dialog with matched keyword, user must approve or abort

### 8. Commit Message Generation

If all checks pass, Comitto generates a commit message:

#### AI Provider Selection
- **Setting**: `comitto.aiProvider`
- **Options**: `openai`, `anthropic`, `ollama`
- **Input**: Git diff and status
- **Style**: Based on `comitto.gitSettings.commitMessageStyle`
- **Language**: Based on `comitto.gitSettings.commitMessageLanguage`

#### Commit Styles

**Conventional Commits** (`conventional`):
- Format: `type: description`
- Types: feat, fix, docs, style, refactor, test, chore
- Example: `feat: add user authentication`

**Gitmoji** (`gitmoji`):
- Format: `emoji description`
- Emojis: 🎉 ✨ 🐛 📚 💄 ♻️ ✅ 🔧
- Example: `✨ add user authentication`

**Angular** (`angular`):
- Format: `type(scope): description`
- Example: `feat(auth): add user authentication`

**Atom** (`atom`):
- Format: `:emoji: description`
- Example: `:sparkles: add user authentication`

**Simple** (`simple`):
- Format: Plain description
- Example: `Add user authentication`

#### Fallback Message
If AI generation fails:
```
Language: English
  Conventional: "chore: automatic commit YYYY-MM-DD HH:MM"
  Gitmoji: "💾 Automatic commit YYYY-MM-DD HH:MM"

Language: German
  Conventional: "chore: Automatischer Commit YYYY-MM-DD HH:MM"
  Gitmoji: "💾 Automatischer Commit YYYY-MM-DD HH:MM"
```

### 9. Commit Execution

#### Branch Handling
- **Setting**: `comitto.gitSettings.branch`
- **Behavior**:
  - If specified and different from current branch:
    - Checks if branch exists
    - If exists: `git checkout <branch>`
    - If not: `git checkout -b <branch>`
  - If empty or same as current: No branch switching

#### Commit Command
- **Command**: `git commit -m "<message>"`
- **Escaping**: Double quotes and backticks are escaped
- **Retry**: Up to `comitto.gitSettings.maxCommitAttempts` retries on failure

### 10. Auto-Push (Optional)

#### Configuration
- **Setting**: `comitto.gitSettings.autoPush`
- **Default**: `false`
- **Pull Before Push**: `comitto.gitSettings.pullBeforePush` (default: true)

#### Push Process
1. If `pullBeforePush` is true: Execute `git pull`
2. Execute `git push` with optional push options
3. Retry up to `comitto.gitSettings.pushRetryCount` times (default: 3)
4. Show notification on success or failure

### Decision Matrix

| Condition | Result | Can Override? |
|-----------|--------|---------------|
| Auto-commit disabled | Abort | Manual commit |
| Trigger disabled | Abort | No |
| File count < threshold | Abort | Manual commit |
| Change count < threshold | Abort | Manual commit |
| Time < threshold | Abort | Manual commit |
| Files don't match patterns | Abort | Manual commit |
| Dirty workspace | Abort | Manual commit |
| Debug session active | Abort | Manual commit |
| Within cooldown period | Abort | Manual commit |
| Within quiet hours | Abort | Manual commit |
| Protected branch | Require confirmation | Deny = Abort |
| Too many files | Require confirmation | Deny = Abort |
| Diff too large | Require confirmation | Deny = Abort |
| Keyword detected | Require confirmation | Deny = Abort |

### Summary

The commit decision logic is designed to be **permissive with triggers** but **protective with execution**:

1. **Triggers** are liberal - multiple types, frequent firing
2. **Thresholds** filter out trivial changes
3. **Guardian** prevents inappropriate commits with multiple safety checks
4. **User confirmations** allow override in edge cases
5. **Manual commits** bypass most restrictions for developer control

This ensures that automatic commits happen when useful but never when disruptive.

---

## Deutsch

### Überblick

Comitto verwendet ein mehrschichtiges Entscheidungssystem, um zu bestimmen, wann automatische Commits erstellt werden sollen. Das System stellt sicher, dass Commits zu geeigneten Zeitpunkten erstellt werden, während unangemessene oder störende Commits durch das Guardian-Schutzsystem verhindert werden.

### Entscheidungsfluss

Der Commit-Entscheidungsprozess folgt diesem Ablauf:

```
1. Trigger-Ereignis tritt auf
   ↓
2. Prüfung, ob Auto-Commit aktiviert ist
   ↓
3. Evaluierung der Trigger-Bedingungen
   ↓
4. Prüfung der Änderungs-Schwellwerte
   ↓
5. Guardian-Vorbedingungen-Prüfung
   ↓
6. Dateien stagen & Diff generieren
   ↓
7. Guardian-Post-Diff-Prüfung
   ↓
8. Commit-Nachricht generieren
   ↓
9. Commit ausführen
   ↓
10. Optional: Auto-Push
```

### 1. Trigger-Ereignisse

Ein Trigger-Ereignis ist alles, was Comitto signalisiert, zu evaluieren, ob ein Commit erstellt werden soll. Mehrere Trigger-Typen können gleichzeitig aktiviert sein:

#### On-Save-Trigger
- **Einstellung**: `comitto.triggerRules.onSave`
- **Standard**: `true`
- **Wann ausgelöst**: Jedes Mal, wenn eine Datei gespeichert wird
- **Anwendungsfall**: Kontinuierliche Entwicklung mit häufigen Speicherungen
- **Verhalten**: Wird sofort nach Abschluss des Speichervorgangs ausgelöst

#### Intervall-Trigger
- **Einstellung**: `comitto.triggerRules.onInterval`
- **Standard**: `false`
- **Wann ausgelöst**: In regelmäßigen Zeitintervallen
- **Intervall**: `comitto.triggerRules.intervalMinutes` (Standard: 15 Minuten)
- **Anwendungsfall**: Hintergrundarbeit, langandauernde Aufgaben
- **Verhalten**: Timer startet bei Aktivierung der Extension, setzt sich nach jedem Intervall zurück

#### Branch-Wechsel-Trigger
- **Einstellung**: `comitto.triggerRules.onBranchSwitch`
- **Standard**: `false`
- **Wann ausgelöst**: Vor dem Wechsel zu einem anderen Branch
- **Anwendungsfall**: Stellt sicher, dass nicht committete Arbeit vor Branch-Änderungen gespeichert wird
- **Verhalten**: Wird ausgelöst, wenn VSCode git.checkout-Befehl aufgerufen wird

### 2. Auto-Commit-Aktiviert-Prüfung

- **Einstellung**: `comitto.autoCommitEnabled`
- **Standard**: `false`
- **Ergebnis**: Wenn deaktiviert, stoppt der Prozess sofort
- **Überschreibung**: Manuelle Commits umgehen diese Prüfung

### 3. Trigger-Bedingungen-Evaluierung

Wenn ein Trigger-Ereignis ausgelöst wird, evaluiert Comitto, ob der spezifische Trigger-Typ aktiviert ist:

```javascript
if (trigger === 'onSave' && !triggerRules.onSave) return false;
if (trigger === 'onInterval' && !triggerRules.onInterval) return false;
if (trigger === 'onBranchSwitch' && !triggerRules.onBranchSwitch) return false;
```

### 4. Änderungs-Schwellwerte

Selbst wenn ein Trigger ausgelöst wird, erfolgen Commits nur, wenn bestimmte Änderungs-Schwellwerte erfüllt sind. **Alle Schwellwerte müssen erfüllt sein:**

#### Dateianzahl-Schwellwert
- **Einstellung**: `comitto.triggerRules.fileCountThreshold`
- **Standard**: `3`
- **Prüfung**: Anzahl geänderter Dateien ≥ Schwellwert
- **Beispiel**: Mit Schwellwert 3 müssen mindestens 3 Dateien Änderungen haben

#### Minimale Änderungsanzahl
- **Einstellung**: `comitto.triggerRules.minChangeCount`
- **Standard**: `10`
- **Prüfung**: Gesamtanzahl der Zeilenänderungen ≥ Schwellwert
- **Berechnung**: Hinzufügungen + Löschungen aus `git diff --stat`
- **Beispiel**: Verhindert Commits für triviale 1-2 Zeilen-Änderungen

#### Zeit-Schwellwert
- **Einstellung**: `comitto.triggerRules.timeThresholdMinutes`
- **Standard**: `30`
- **Prüfung**: Zeit seit letztem Auto-Commit ≥ Schwellwert
- **Beispiel**: Auch wenn Dateien sich häufig ändern, warte mindestens 30 Minuten zwischen Auto-Commits
- **Hinweis**: Wird **vor** Guardian-Cooldown geprüft

#### Dateimuster-Matching
- **Einstellung**: `comitto.triggerRules.filePatterns`
- **Standard**: `["**/*"]`
- **Prüfung**: Geänderte Dateien entsprechen mindestens einem Muster
- **Muster-Syntax**: Glob-Muster (z.B. `src/**/*.ts`, `!**/test/**`)
- **Verhalten**: Wenn Muster angegeben sind, zählen nur passende Dateien zu den Schwellwerten

### 5. Guardian-Vorbedingungen

Der Guardian führt mehrere Prüfungen **vor** dem Stagen von Dateien und Generieren von Diffs durch:

#### Smart-Protection-Hauptschalter
- **Einstellung**: `comitto.guardian.smartCommitProtection`
- **Standard**: `true`
- **Effekt**: Wenn deaktiviert, werden alle Guardian-Prüfungen umgangen
- **Hinweis**: Manuelle Commits überspringen Guardian-Prüfungen unabhängig von dieser Einstellung

#### Dirty-Workspace-Prüfung
- **Einstellung**: `comitto.guardian.blockOnDirtyWorkspace`
- **Standard**: `true`
- **Prüfung**: Gibt es ungespeicherte Änderungen in offenen Editoren?
- **Grund**: Verhindert Committen während des Bearbeitens
- **Ergebnis bei Blockierung**: Zeigt Warn-Benachrichtigung, Commit abbrechen

#### Debug-Sitzungs-Prüfung
- **Einstellung**: `comitto.guardian.skipWhenDebugging`
- **Standard**: `true`
- **Prüfung**: Gibt es eine aktive Debug-Sitzung?
- **Grund**: Vermeidet Unterbrechung des Debugging-Workflows
- **Ergebnis bei Blockierung**: Zeigt Info-Benachrichtigung, Commit abbrechen

#### Cooldown-Prüfung
- **Einstellung**: `comitto.guardian.coolDownMinutes`
- **Standard**: `5`
- **Prüfung**: Ist genug Zeit seit letztem Auto-Commit vergangen?
- **Berechnung**: `(aktuelleZeit - letzteCommitZeit) / 60000 ≥ coolDownMinutes`
- **Unterschied zum Zeit-Schwellwert**: Guardian-Cooldown ist strenger und wird **nach** Schwellwerten geprüft
- **Ergebnis bei Blockierung**: Zeigt verbleibende Cooldown-Zeit, Commit abbrechen

#### Ruhezeiten-Prüfung
- **Einstellung**: `comitto.guardian.quietHours`
- **Standard**: `[]`
- **Format**: Array von Zeitbereichen, z.B. `["22:00-08:00", "12:00-13:00"]`
- **Prüfung**: Liegt aktuelle Zeit in einem Ruhezeiten-Bereich?
- **Zeitformat**: 24-Stunden-Format (HH:MM)
- **Verhalten**: Bereiche können Mitternacht überspannen (z.B. `22:00-08:00`)
- **Ergebnis bei Blockierung**: Zeigt Info-Benachrichtigung, Commit abbrechen

#### Geschützte-Branches-Prüfung
- **Einstellung**: `comitto.guardian.protectedBranches`
- **Standard**: `["main", "master", "release/*"]`
- **Prüfung**: Entspricht aktueller Branch einem geschützten Muster?
- **Muster-Matching**: Unterstützt Wildcards (`*`) und exakte Übereinstimmungen
- **Beispiele**:
  - `main` entspricht nur "main"
  - `release/*` entspricht "release/1.0", "release/2.0", etc.
  - `hotfix/*` entspricht jedem Branch, der mit "hotfix/" beginnt
- **Ergebnis bei Übereinstimmung**: Zeigt Bestätigungsdialog, Benutzer muss genehmigen oder abbrechen

#### Dateianzahl-Vor-Prüfung
- **Einstellung**: `comitto.guardian.maxFilesWithoutPrompt`
- **Standard**: `8`
- **Prüfung**: Anzahl geänderter Dateien ≥ Schwellwert?
- **Ergebnis bei Überschreitung**: Zeigt Bestätigungsdialog mit Dateianzahl, Benutzer muss genehmigen oder abbrechen

### 6. Dateien stagen & Diff generieren

An diesem Punkt fährt Comitto fort, Dateien zu stagen und ein Diff zu generieren:

#### Staging-Strategie
- **Einstellung**: `comitto.gitSettings.stageMode`
- **Optionen**:
  - `all`: Alle Änderungen stagen (`git add .`)
  - `modified`: Nur geänderte Dateien stagen (keine neuen Dateien)
  - `pattern`: Dateien stagen, die spezifischen Mustern entsprechen
- **Gitignore**: Beachtet .gitignore wenn `comitto.gitSettings.useGitignore` true ist

#### Diff-Generierung
- **Befehl**: `git diff --cached`
- **Zweck**: Tatsächliche Inhaltsänderungen für KI und Guardian-Prüfungen erhalten
- **Fallback**: Wenn Diff zu groß oder fehlschlägt, verwendet `git diff --cached --name-status`

### 7. Guardian-Post-Diff-Prüfungen

Nach Generierung des Diffs führt Guardian zusätzliche Prüfungen durch:

#### Große-Änderungen-Bestätigung
- **Einstellung**: `comitto.guardian.confirmOnLargeChanges`
- **Standard**: `true`
- **Schwellwert**: `comitto.guardian.maxDiffSizeKb` (Standard: 512 KB)
- **Prüfung**: Ist Diff-Größe ≥ Schwellwert?
- **Berechnung**: `Buffer.byteLength(diffOutput, 'utf8') / 1024`
- **Ergebnis bei Überschreitung**: Zeigt Bestätigungsdialog mit Diff-Größe in KB, Benutzer muss genehmigen oder abbrechen

#### Keyword-Erkennung
- **Einstellung**: `comitto.guardian.keywordsRequiringConfirmation`
- **Standard**: `["WIP", "DO-NOT-COMMIT"]`
- **Prüfung**: Enthält Diff oder Git-Status Keywords?
- **Matching**: Groß-/Kleinschreibung-unabhängig
- **Suchbereich**: Sowohl Diff-Inhalt als auch `git status --porcelain` Ausgabe
- **Ergebnis bei Übereinstimmung**: Zeigt Bestätigungsdialog mit gefundenem Keyword, Benutzer muss genehmigen oder abbrechen

### 8. Commit-Nachricht-Generierung

Wenn alle Prüfungen bestanden sind, generiert Comitto eine Commit-Nachricht:

#### KI-Provider-Auswahl
- **Einstellung**: `comitto.aiProvider`
- **Optionen**: `openai`, `anthropic`, `ollama`
- **Eingabe**: Git-Diff und Status
- **Stil**: Basierend auf `comitto.gitSettings.commitMessageStyle`
- **Sprache**: Basierend auf `comitto.gitSettings.commitMessageLanguage`

#### Commit-Stile

**Conventional Commits** (`conventional`):
- Format: `type: beschreibung`
- Typen: feat, fix, docs, style, refactor, test, chore
- Beispiel: `feat: Benutzerauthentifizierung hinzufügen`

**Gitmoji** (`gitmoji`):
- Format: `emoji beschreibung`
- Emojis: 🎉 ✨ 🐛 📚 💄 ♻️ ✅ 🔧
- Beispiel: `✨ Benutzerauthentifizierung hinzufügen`

**Angular** (`angular`):
- Format: `type(scope): beschreibung`
- Beispiel: `feat(auth): Benutzerauthentifizierung hinzufügen`

**Atom** (`atom`):
- Format: `:emoji: beschreibung`
- Beispiel: `:sparkles: Benutzerauthentifizierung hinzufügen`

**Simple** (`simple`):
- Format: Einfache Beschreibung
- Beispiel: `Benutzerauthentifizierung hinzufügen`

#### Fallback-Nachricht
Wenn KI-Generierung fehlschlägt:
```
Sprache: Englisch
  Conventional: "chore: automatic commit YYYY-MM-DD HH:MM"
  Gitmoji: "💾 Automatic commit YYYY-MM-DD HH:MM"

Sprache: Deutsch
  Conventional: "chore: Automatischer Commit YYYY-MM-DD HH:MM"
  Gitmoji: "💾 Automatischer Commit YYYY-MM-DD HH:MM"
```

### 9. Commit-Ausführung

#### Branch-Handling
- **Einstellung**: `comitto.gitSettings.branch`
- **Verhalten**:
  - Wenn angegeben und unterschiedlich vom aktuellen Branch:
    - Prüft, ob Branch existiert
    - Wenn existiert: `git checkout <branch>`
    - Wenn nicht: `git checkout -b <branch>`
  - Wenn leer oder gleich wie aktuell: Kein Branch-Wechsel

#### Commit-Befehl
- **Befehl**: `git commit -m "<nachricht>"`
- **Escaping**: Doppelte Anführungszeichen und Backticks werden escaped
- **Wiederholung**: Bis zu `comitto.gitSettings.maxCommitAttempts` Wiederholungen bei Fehler

### 10. Auto-Push (Optional)

#### Konfiguration
- **Einstellung**: `comitto.gitSettings.autoPush`
- **Standard**: `false`
- **Pull vor Push**: `comitto.gitSettings.pullBeforePush` (Standard: true)

#### Push-Prozess
1. Wenn `pullBeforePush` true ist: Führe `git pull` aus
2. Führe `git push` mit optionalen Push-Optionen aus
3. Wiederhole bis zu `comitto.gitSettings.pushRetryCount` mal (Standard: 3)
4. Zeige Benachrichtigung bei Erfolg oder Fehler

### Entscheidungs-Matrix

| Bedingung | Ergebnis | Kann überschrieben werden? |
|-----------|----------|----------------------------|
| Auto-Commit deaktiviert | Abbrechen | Manueller Commit |
| Trigger deaktiviert | Abbrechen | Nein |
| Dateianzahl < Schwellwert | Abbrechen | Manueller Commit |
| Änderungsanzahl < Schwellwert | Abbrechen | Manueller Commit |
| Zeit < Schwellwert | Abbrechen | Manueller Commit |
| Dateien entsprechen nicht Mustern | Abbrechen | Manueller Commit |
| Dirty Workspace | Abbrechen | Manueller Commit |
| Debug-Sitzung aktiv | Abbrechen | Manueller Commit |
| Innerhalb Cooldown-Periode | Abbrechen | Manueller Commit |
| Innerhalb Ruhezeiten | Abbrechen | Manueller Commit |
| Geschützter Branch | Bestätigung erforderlich | Ablehnung = Abbrechen |
| Zu viele Dateien | Bestätigung erforderlich | Ablehnung = Abbrechen |
| Diff zu groß | Bestätigung erforderlich | Ablehnung = Abbrechen |
| Keyword erkannt | Bestätigung erforderlich | Ablehnung = Abbrechen |

### Zusammenfassung

Die Commit-Entscheidungslogik ist **permissiv bei Triggern** aber **schützend bei Ausführung**:

1. **Trigger** sind liberal - mehrere Typen, häufiges Auslösen
2. **Schwellwerte** filtern triviale Änderungen heraus
3. **Guardian** verhindert unangemessene Commits mit mehreren Sicherheitsprüfungen
4. **Benutzer-Bestätigungen** erlauben Überschreibung in Grenzfällen
5. **Manuelle Commits** umgehen die meisten Einschränkungen für Entwickler-Kontrolle

Dies stellt sicher, dass automatische Commits erfolgen, wenn sie nützlich sind, aber niemals wenn sie störend sind.
