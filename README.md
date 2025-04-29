# Comitto - AI-Powered Git Commits

<p align="center">
  <img src="comitto.png" alt="Comitto Logo" width="200"/>
</p>

Comitto is a VS Code extension that automatically generates commit messages using various AI models (Ollama, OpenAI, Anthropic) and performs commits without user intervention.

[![Version](https://img.shields.io/badge/version-0.3.0-blue.svg)](https://marketplace.visualstudio.com/items?itemName=comitto.comitto)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **Automatic Commits**: Performs Git commits based on configurable rules
- **AI-generated Commit Messages**: Uses Ollama, OpenAI, or Anthropic for high-quality commit messages
- **Configurable Triggers**: Adjust when automatic commits should be performed
- **Comprehensive Git Settings**: Configure repository path, branch, auto-push, and more
- **Customizable Prompts**: Customize the template for generating commit messages
- **User-friendly Interface**: All settings can be easily adjusted via the sidebar
- **Status Display**: Shows the current status of the extension in the VS Code status bar

## Prerequisites

- Visual Studio Code version 1.70.0 or higher
- Git must be installed on your system and initialized in your workspace
- Depending on configuration: Ollama installed locally or API keys for OpenAI/Anthropic

## User Interface

Comitto provides a user-friendly interface in the VS Code sidebar:

### Status View

Shows the current status of the extension and provides quick access to frequently used functions:
- Status (enabled/disabled)
- Current AI provider
- Trigger rules
- Perform manual commit

### Settings View

Allows easy configuration of all parameters without editing JSON:
- AI provider and model settings
- Trigger rules
- Git settings
- Prompt templates

Click on an entry to edit the corresponding setting.

## Setting Up AI Providers

### Ollama (Local)

Visit [ollama.com](https://ollama.com/) to install Ollama for your operating system.

After installation, start Ollama and load a model:

```
ollama pull llama3
```

### OpenAI

To use OpenAI, you need an API key.

1. Visit [platform.openai.com](https://platform.openai.com/)
2. Create an account or sign in
3. Navigate to the API section and create an API key
4. Copy the key into the extension settings (via the sidebar)

### Anthropic

To use Anthropic, you need an API key.

1. Visit [console.anthropic.com](https://console.anthropic.com/)
2. Create an account or sign in
3. Create an API key
4. Copy the key into the extension settings (via the sidebar)

## Configuration

All settings can be easily adjusted via the sidebar. Alternatively, you can also use the VS Code settings:

| Setting | Description | Default Value |
|---------|-------------|---------------|
| `comitto.aiProvider` | AI provider for generating commit messages (ollama, openai, anthropic) | `ollama` |
| `comitto.ollama.endpoint` | Ollama API endpoint | `http://localhost:11434/api/generate` |
| `comitto.ollama.model` | Ollama model for generating commit messages | `llama3` |
| `comitto.openai.apiKey` | OpenAI API key | `` |
| `comitto.openai.model` | OpenAI model for generating commit messages | `gpt-3.5-turbo` |
| `comitto.anthropic.apiKey` | Anthropic API key | `` |
| `comitto.anthropic.model` | Anthropic model for generating commit messages | `claude-3-haiku-20240307` |
| `comitto.autoCommitEnabled` | Enables or disables automatic commits | `false` |
| `comitto.triggerRules` | Rules that trigger automatic commits | See below |
| `comitto.gitSettings` | Git settings for commits | See below |
| `comitto.promptTemplate` | Customizable template for generating commit messages | See below |

### Trigger Rules

The trigger rules can be configured as follows:

```jsonc
"comitto.triggerRules": {
  "fileCountThreshold": 3,     // Number of changed files that trigger a commit
  "specificFiles": [           // Specific files that trigger a commit when changed
    "package.json",
    "README.md"
  ],
  "minChangeCount": 10,        // Minimum number of changes that trigger a commit
  "timeThresholdMinutes": 30,  // Minimum time in minutes between automatic commits
  "filePatterns": ["**/*"]     // Glob patterns for files to watch
}
```

### Git Settings

The Git settings can be configured as follows:

```jsonc
"comitto.gitSettings": {
  "repositoryPath": "",        // Optional path to the Git repository (defaults to workspace folder)
  "autoPush": false,           // Automatically push after commit
  "branch": "",                // Optional branch name for commits (leave empty for current branch)
  "commitMessageLanguage": "en", // Language for the commit message (en, de, fr, ...)
  "commitMessageStyle": "conventional", // Style of the commit message (conventional, gitmoji, ...)
  "useGitignore": true         // Use .gitignore file for ignoring files
}
```

### Prompt Template

You can customize the template for AI generation. This can be done conveniently via the sidebar, where an editor will open:

```
"comitto.promptTemplate": "Generate a meaningful commit message for the following changes: \n\n{changes}\n\nUse the Conventional Commits format (feat, fix, docs, etc.) and keep the message under 80 characters."
```

The placeholder `{changes}` will be automatically replaced with the list of changed files.

## Usage

1. Install the extension in VS Code
2. Click on the Comitto icon in the activity bar to open the sidebar
3. Configure the desired AI provider and other settings via the sidebar
4. Enable automatic commits via:
   - The button in the status view
   - The command "Comitto: Enable Automatic Commits" in the command palette (Ctrl+Shift+P)
   - Clicking on the Comitto icon in the status bar
5. Continue working normally - the extension takes care of the rest!
6. You can also perform a manual AI commit at any time using the command "Comitto: Perform Manual AI Commit" or via the status view

## Commands

The extension provides the following commands:

- `comitto.enableAutoCommit`: Enables automatic commits
- `comitto.disableAutoCommit`: Disables automatic commits
- `comitto.toggleAutoCommit`: Toggles between enabled and disabled state
- `comitto.performManualCommit`: Performs a manual AI commit
- `comitto.refreshSettings`: Updates the settings display
- `comitto.openSettings`: Opens the VS Code settings for Comitto

## Privacy and Security

This extension sends information about your code changes to the configured AI provider:

- **Ollama**: Since Ollama runs locally on your system, this data does not leave your computer.
- **OpenAI/Anthropic**: When using these providers, your change information is sent to external servers. Please read the privacy policies of these providers.

You can control the amount of information sent by customizing the prompt template.

## Troubleshooting

If you have problems with the extension:

1. Make sure the selected AI provider is correctly configured
   - Ollama: Ollama must be running and the configured model must be installed
   - OpenAI/Anthropic: API key must be valid
2. Check that Git is properly set up and `git status` works in the workspace
3. Check the VS Code output of the extension for error messages
4. Refresh the settings display using the "Refresh" button

## Known Limitations

- The extension only works in workspaces with an initialized Git repository
- When using large diffs, the quality of the generated commit messages may vary

## License

This extension is released under the MIT License. 
