# Comitto

<p align="center">
   <img src="comitto.png" alt="Comitto Logo" width="200"/>
 </p>

Automated Git Commits with AI-generated Commit Messages

 ---
[![Version](https://img.shields.io/badge/version-2.2.6-blue.svg)](https://marketplace.visualstudio.com/items?itemName=tilltmk.comitto)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
 
## Features

![image](https://github.com/user-attachments/assets/3fb666f0-114b-4bd3-a10d-b5eef0c667e8)

- **Automatic Commits**: Monitors file changes and performs commits automatically
- **AI-generated Commit Messages**: Uses OpenAI (standardmäßig `gpt-4.1-mini`), Anthropic Claude oder Ollama
- **Commit Guardian**: Intelligente Schutzlogik mit Cooldown, Quiet Hours, Branch-Schutz und Keyword-Filtern
- **Visual Status Display**: Progress bar and detailed feedback during the commit process
- **Configurable Triggers**: Control when commits should be executed
- **Dashboard**: Clear presentation of activities and settings
- **VSCode Integration**: Fully integrated into the IDE
- **Modernisierte UI**: Überarbeitete Dashboard-Optik und neue Guardian-Karten in der einfachen Oberfläche

## Installation

1. Install the extension via the VSCode Marketplace
2. Configure your preferred AI provider
3. Activate automatic commits

## Configuration

### AI Providers

- **OpenAI**: API key required
- **Anthropic Claude**: API key required
- **Ollama**: Local installation without API key

### Triggers

- On file save
- At regular intervals
- When reaching a certain number of changes

## Usage

- Status bar shows current status and progress
- Sidebar view with status, quick actions and settings
- Dashboard for detailed overview and configuration

## Version 2.1.0 (New)

- Improved status bar with visual progress indicator
- Enhanced error handling for all AI providers
- Visual feedback during commit generation
- Better model selection for OpenAI with icons and categories
- Commit Guardian mit Schnellkonfiguration über Sidebar, Kommando-Palette und Simple UI
- Überarbeiteter Settings-Manager mit Validierung, sanfter Migration alter Ollama-Modelle und Echtzeit-Reaktion auf Konfigurationsänderungen

## Support

For questions or issues, please create an issue in the GitHub repository.
