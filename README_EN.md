# Comitto

<p align="center">
  <img src="comitto.png" alt="Comitto Logo" width="200"/>
</p>

Automated Git Commits with AI-generated Commit Messages

---

[![Version](https://img.shields.io/badge/version-2.3.0-blue.svg)](https://marketplace.visualstudio.com/items?itemName=tilltmk.comitto)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Configuration](#configuration)
  - [AI Providers](#ai-providers)
  - [Commit Decision Logic](#commit-decision-logic)
  - [Trigger Rules](#trigger-rules)
  - [Guardian Settings](#guardian-settings)
  - [Commit Styles](#commit-styles)
- [Usage](#usage)
- [Settings Reference](#settings-reference)
- [Version History](#version-history)
- [Support](#support)

## Features

![Comitto Dashboard](https://github.com/user-attachments/assets/3fb666f0-114b-4bd3-a10d-b5eef0c667e8)

- **Automatic Commits**: Monitors file changes and performs commits automatically based on configurable triggers
- **AI-generated Commit Messages**: Uses OpenAI (default `gpt-4.1-mini`), Anthropic Claude, or Ollama to generate meaningful commit messages
- **Commit Guardian**: Intelligent protection logic with cooldown, quiet hours, branch protection, and keyword filters
- **Visual Status Display**: Progress bar and detailed feedback during the commit process
- **Configurable Triggers**: Control when commits should be executed with multiple trigger options
- **Dashboard**: Clear presentation of activities and settings with modern UI
- **VSCode Integration**: Fully integrated into the IDE with sidebar, status bar, and command palette
- **Flexible Commit Styles**: Support for Conventional Commits, Gitmoji, Angular, Atom, and Simple styles
- **Multi-language Support**: Generate commit messages in German or English

## Installation

1. Install the extension via the VSCode Marketplace
2. Search for "Comitto" or install directly from [marketplace.visualstudio.com](https://marketplace.visualstudio.com/items?itemName=tilltmk.comitto)
3. Configure your preferred AI provider (see [AI Providers](#ai-providers))
4. Activate automatic commits when ready

## Configuration

### AI Providers

Comitto supports three AI providers for generating commit messages:

#### OpenAI

- **API Key**: Required (get from [platform.openai.com](https://platform.openai.com))
- **Models**:
  - `gpt-4.1-mini` (recommended, default)
  - `gpt-4`
  - `gpt-3.5-turbo`
  - Other OpenAI models
- **Configuration**: Set via `comitto.openai.apiKey` and `comitto.openai.model`

#### Anthropic Claude

- **API Key**: Required (get from [console.anthropic.com](https://console.anthropic.com))
- **Models**:
  - `claude-3-haiku-20240307` (fast, cost-effective, default)
  - `claude-3-sonnet-20240229` (balanced)
  - `claude-3-opus-20240229` (most capable)
- **Configuration**: Set via `comitto.anthropic.apiKey` and `comitto.anthropic.model`

#### Ollama

- **API Key**: Not required (local installation)
- **Endpoint**: Default `http://localhost:11434/api/generate`
- **Models**: Any locally installed Ollama model (default: `granite3.3:2b`)
- **Configuration**: Set via `comitto.ollama.endpoint` and `comitto.ollama.model`
- **Setup**: Install Ollama from [ollama.ai](https://ollama.ai) and pull your desired model

### Commit Decision Logic

Comitto uses a sophisticated decision system to determine when to create automatic commits. The decision is based on multiple factors:

#### 1. Trigger Rules

Commits are triggered when **any** of the following conditions are met:

##### On Save Trigger
- **Setting**: `comitto.triggerRules.onSave`
- **Description**: Triggers a commit evaluation when files are saved
- **Use Case**: Ideal for frequent small commits during active development
- **Default**: `true`

##### Interval Trigger
- **Setting**: `comitto.triggerRules.onInterval`
- **Description**: Automatically evaluates commits at regular intervals
- **Interval Setting**: `comitto.triggerRules.intervalMinutes` (default: 15 minutes)
- **Use Case**: Useful for background work or when you forget to save
- **Default**: `false`

##### Branch Switch Trigger
- **Setting**: `comitto.triggerRules.onBranchSwitch`
- **Description**: Commits pending changes before switching branches
- **Use Case**: Ensures clean branch switches without losing work
- **Default**: `false`

#### 2. Change Thresholds

Even when a trigger fires, commits only occur if certain thresholds are met:

##### File Count Threshold
- **Setting**: `comitto.triggerRules.fileCountThreshold`
- **Description**: Minimum number of changed files required for auto-commit
- **Default**: `3`
- **Example**: With threshold of 3, commits only occur when 3 or more files have changes

##### Minimum Change Count
- **Setting**: `comitto.triggerRules.minChangeCount`
- **Description**: Minimum number of line changes required
- **Default**: `10`
- **Example**: Prevents commits for trivial single-line changes

##### Time Threshold
- **Setting**: `comitto.triggerRules.timeThresholdMinutes`
- **Description**: Minimum time (in minutes) that must pass since last auto-commit
- **Default**: `30`
- **Example**: Prevents too frequent commits even if other conditions are met

#### 3. File Patterns

- **Setting**: `comitto.triggerRules.filePatterns`
- **Description**: Glob patterns to include/exclude files from triggering commits
- **Default**: `["**/*"]` (all files)
- **Examples**:
  - `["src/**/*.ts"]` - Only TypeScript files in src folder
  - `["**/*.{js,ts}"]` - All JavaScript and TypeScript files
  - `["!**/test/**"]` - Exclude test directories

### Guardian Settings

The Guardian is an intelligent protection system that prevents inappropriate automatic commits:

#### Smart Commit Protection
- **Setting**: `comitto.guardian.smartCommitProtection`
- **Description**: Master switch for all guardian features
- **Default**: `true`
- **Impact**: When disabled, all guardian checks are bypassed (except for manual commits)

#### Cooldown Period
- **Setting**: `comitto.guardian.coolDownMinutes`
- **Description**: Minimum time between automatic commits
- **Default**: `5` minutes
- **Use Case**: Prevents commit spam during rapid development
- **Behavior**: Shows remaining cooldown time in notification

#### Dirty Workspace Protection
- **Setting**: `comitto.guardian.blockOnDirtyWorkspace`
- **Description**: Blocks auto-commits when files have unsaved changes
- **Default**: `true`
- **Use Case**: Ensures all changes are saved before committing

#### Debug Session Detection
- **Setting**: `comitto.guardian.skipWhenDebugging`
- **Description**: Pauses auto-commits during active debug sessions
- **Default**: `true`
- **Use Case**: Prevents commits while debugging, allowing focused work

#### Large Change Confirmation
- **Setting**: `comitto.guardian.confirmOnLargeChanges`
- **Description**: Requires manual confirmation for large diffs
- **Threshold**: `comitto.guardian.maxDiffSizeKb` (default: 512 KB)
- **Default**: `true`
- **Behavior**: Shows dialog with diff size and confirmation buttons

#### File Count Protection
- **Setting**: `comitto.guardian.maxFilesWithoutPrompt`
- **Description**: Maximum files that can be committed without confirmation
- **Default**: `8`
- **Behavior**: Shows confirmation dialog when exceeded

#### Protected Branches
- **Setting**: `comitto.guardian.protectedBranches`
- **Description**: Branches that require confirmation before auto-commit
- **Default**: `["main", "master", "release/*"]`
- **Pattern Support**: Supports wildcards (e.g., `release/*`, `hotfix/*`)
- **Behavior**: Shows warning dialog before committing to protected branches

#### Quiet Hours
- **Setting**: `comitto.guardian.quietHours`
- **Description**: Time windows when auto-commits are suspended
- **Format**: `["HH:MM-HH:MM"]` (24-hour format)
- **Default**: `[]` (no quiet hours)
- **Examples**:
  - `["22:00-08:00"]` - No commits between 10 PM and 8 AM
  - `["12:00-13:00", "18:00-19:00"]` - Lunch and dinner breaks

#### Keyword Detection
- **Setting**: `comitto.guardian.keywordsRequiringConfirmation`
- **Description**: Keywords in diffs that trigger confirmation dialogs
- **Default**: `["WIP", "DO-NOT-COMMIT"]`
- **Use Case**: Prevents accidental commits of work-in-progress or debug code
- **Detection**: Case-insensitive search in diff and status output

### Commit Styles

Comitto supports multiple commit message styles:

#### Conventional Commits
- **Setting Value**: `"conventional"`
- **Format**: `type: description`
- **Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
- **Example**: `feat: add user authentication system`

#### Gitmoji
- **Setting Value**: `"gitmoji"`
- **Format**: `emoji description`
- **Emojis**: 🎉 (initial), 🐛 (bugfix), 📚 (docs), 💄 (UI), etc.
- **Example**: `🎉 add user authentication system`

#### Angular
- **Setting Value**: `"angular"`
- **Format**: `type(scope): description`
- **Example**: `feat(auth): add user authentication system`

#### Atom
- **Setting Value**: `"atom"`
- **Format**: `:emoji: description`
- **Example**: `:sparkles: add user authentication system`

#### Simple
- **Setting Value**: `"simple"`
- **Format**: Simple descriptive messages
- **Example**: `Add user authentication system`

**Configuration**: Set via `comitto.gitSettings.commitMessageStyle`

### Commit Message Language

- **Setting**: `comitto.gitSettings.commitMessageLanguage`
- **Options**: `"en"` (English) or `"de"` (German)
- **Default**: `"de"`
- **Impact**: Affects AI-generated commit message language

## Usage

### Status Bar

The status bar item shows the current Comitto status:
- **Idle**: Green, shows "Überwacht" or "Watching"
- **In Progress**: Blue with progress percentage
- **Error**: Red with error indicator
- **Click**: Opens quick actions menu

### Sidebar View

Access the Comitto sidebar from the Activity Bar:
- **Status Card**: Current state and quick toggle
- **Quick Actions**: Manual commit, refresh, dashboard
- **Settings Overview**: AI provider, triggers, guardian status
- **Debug Logs**: Detailed execution logs (when debug enabled)

### Dashboard

Open with `Comitto: Show Dashboard` command:
- **Activity Monitor**: Recent commits and statistics
- **Configuration**: Visual editors for all settings
- **Trigger Configuration**: Toggle and configure triggers
- **Guardian Configuration**: Manage protection settings
- **AI Provider Setup**: Configure API keys and models

### Simple UI

Streamlined interface for quick configuration:
- Open with `Comitto: Show Simple User Interface`
- Cards for essential settings
- Guardian quick configuration
- Ideal for first-time setup

### Commands

All commands available via Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`):

- `Comitto: Enable Automatic Commits` - Start auto-commit monitoring
- `Comitto: Disable Automatic Commits` - Stop auto-commit monitoring
- `Comitto: Toggle Automatic Commits` - Quick enable/disable
- `Comitto: Perform Manual AI Commit` - Generate and commit immediately
- `Comitto: Show Dashboard` - Open configuration dashboard
- `Comitto: Show Simple User Interface` - Open streamlined UI
- `Comitto: Configure AI Provider` - Set up OpenAI, Anthropic, or Ollama
- `Comitto: Configure Triggers` - Manage trigger rules
- `Comitto: Configure Guardian` - Manage protection settings
- `Comitto: Select Commit Style` - Choose commit message format
- `Comitto: Select Commit Language` - Choose message language
- `Comitto: Toggle Auto Push` - Enable/disable automatic git push
- `Comitto: Edit Branch` - Set target branch for commits
- `Comitto: Select Stage Mode` - Choose staging strategy
- `Comitto: Refresh Settings` - Reload configuration

## Settings Reference

### Core Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `comitto.autoCommitEnabled` | boolean | `false` | Enable/disable automatic commits |
| `comitto.aiProvider` | string | `"openai"` | AI provider: `openai`, `anthropic`, or `ollama` |

### Trigger Rules

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `comitto.triggerRules.onSave` | boolean | `true` | Trigger on file save |
| `comitto.triggerRules.onInterval` | boolean | `false` | Trigger at intervals |
| `comitto.triggerRules.onBranchSwitch` | boolean | `false` | Trigger on branch switch |
| `comitto.triggerRules.intervalMinutes` | number | `15` | Interval duration |
| `comitto.triggerRules.fileCountThreshold` | number | `3` | Minimum files for commit |
| `comitto.triggerRules.minChangeCount` | number | `10` | Minimum line changes |
| `comitto.triggerRules.timeThresholdMinutes` | number | `30` | Minimum time between commits |
| `comitto.triggerRules.filePatterns` | array | `["**/*"]` | File patterns to monitor |

### Git Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `comitto.gitSettings.autoPush` | boolean | `false` | Auto-push after commit |
| `comitto.gitSettings.pullBeforePush` | boolean | `true` | Pull before pushing |
| `comitto.gitSettings.stageMode` | string | `"all"` | Staging mode: `all`, `modified`, `pattern` |
| `comitto.gitSettings.branch` | string | `""` | Target branch (empty = current) |
| `comitto.gitSettings.useGitignore` | boolean | `true` | Respect .gitignore rules |
| `comitto.gitSettings.commitMessageStyle` | string | `"gitmoji"` | Commit style format |
| `comitto.gitSettings.commitMessageLanguage` | string | `"de"` | Message language |
| `comitto.gitSettings.maxCommitAttempts` | number | `3` | Retry attempts on failure |

### Guardian Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `comitto.guardian.smartCommitProtection` | boolean | `true` | Enable guardian protection |
| `comitto.guardian.coolDownMinutes` | number | `5` | Cooldown between commits |
| `comitto.guardian.maxFilesWithoutPrompt` | number | `8` | Max files without confirmation |
| `comitto.guardian.confirmOnLargeChanges` | boolean | `true` | Confirm large diffs |
| `comitto.guardian.maxDiffSizeKb` | number | `512` | Large diff threshold (KB) |
| `comitto.guardian.blockOnDirtyWorkspace` | boolean | `true` | Block with unsaved files |
| `comitto.guardian.skipWhenDebugging` | boolean | `true` | Pause during debug |
| `comitto.guardian.quietHours` | array | `[]` | Time windows to pause |
| `comitto.guardian.protectedBranches` | array | `["main", "master", "release/*"]` | Branches requiring confirmation |
| `comitto.guardian.keywordsRequiringConfirmation` | array | `["WIP", "DO-NOT-COMMIT"]` | Keywords triggering confirmation |

### AI Provider Settings

#### OpenAI

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `comitto.openai.apiKey` | string | `""` | OpenAI API key |
| `comitto.openai.model` | string | `"gpt-4.1-mini"` | Model to use |

#### Anthropic

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `comitto.anthropic.apiKey` | string | `""` | Anthropic API key |
| `comitto.anthropic.model` | string | `"claude-3-haiku-20240307"` | Model to use |

#### Ollama

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `comitto.ollama.endpoint` | string | `"http://localhost:11434/api/generate"` | Ollama API endpoint |
| `comitto.ollama.model` | string | `"granite3.3:2b"` | Model name |

### UI Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `comitto.uiSettings.simpleMode` | boolean | `false` | Use simplified UI |
| `comitto.uiSettings.confirmBeforeCommit` | boolean | `true` | Confirm before manual commits |
| `comitto.uiSettings.showNotifications` | boolean | `true` | Show notifications |
| `comitto.uiSettings.theme` | string | `"auto"` | UI theme: `auto`, `light`, `dark` |

### Notification Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `comitto.notifications.onCommit` | boolean | `true` | Notify on successful commit |
| `comitto.notifications.onPush` | boolean | `true` | Notify on successful push |
| `comitto.notifications.onError` | boolean | `true` | Notify on errors |
| `comitto.notifications.onTriggerFired` | boolean | `false` | Notify when trigger fires |

### Debug Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `comitto.debug.enabled` | boolean | `false` | Enable debug logging |
| `comitto.debug.extendedLogging` | boolean | `false` | Verbose logging |
| `comitto.debug.commitDiagnostics` | boolean | `false` | Log commit diagnostics |

## Version History

### Version 2.3.0 (Current)

- Extended Git integration with new commands
- Auto-push configuration
- Branch editing support
- Commit style and language selection
- Updated UI provider with improved error handling
- Centralized settings management with Guardian

### Version 2.2.6

- Improved status bar with visual progress indicator
- Enhanced error handling for all AI providers
- Visual feedback during commit generation
- Better model selection for OpenAI with icons and categories

### Version 2.1.0

- Commit Guardian with quick configuration
- Overhauled settings manager with validation
- Smooth migration of old Ollama models
- Real-time configuration change reactions
- Modernized dashboard UI
- Guardian cards in simple interface

### Version 2.0.0

- Multi-provider AI support (OpenAI, Anthropic, Ollama)
- Configurable triggers (save, interval, branch switch)
- Advanced threshold system
- Dashboard and Simple UI
- Comprehensive notification system

## Support

For questions, issues, or feature requests:

- **GitHub Issues**: [github.com/tilltmk/comitto/issues](https://github.com/tilltmk/comitto/issues)
- **Documentation**: See this README and in-app tooltips
- **Common Errors**: Check `COMMON_ERRORS.md` in the repository

## License

MIT License - See LICENSE.txt for details

---

Made with ❤️ by [tilltmk](https://github.com/tilltmk)
