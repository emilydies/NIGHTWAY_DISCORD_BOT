# Project Structure

```
NIGHTWAY_DISCORD_BOT/
├── index.js              # Main entry point - initializes client and handlers
├── package.json          # Dependencies
├── .env                  # Environment variables
├── vcOwners.json         # Database of voice channel owners
├── README.md             # Project description

src/
├── config.js             # Configuration management (cfg function)
├── db.js                 # Database operations (loadDb, saveDb)
├── i18n.js               # Localization strings and language detection
├── utils.js              # Utility functions (findRole, findChannel, isOwner, etc.)
├── voiceChannels.js      # Voice channel operations (create, cleanup)
├── settingsPanel.js      # Settings panel and message creation

handlers/
├── roleReactionHandler.js       # Language role selection (🇷🇺 🇬🇧)
├── settingsReactionHandler.js   # Voice settings (🔒 👥 ⛔)
├── voiceStateHandler.js         # Voice join/leave events
└── messageHandler.js             # Command processing
```

## Key Changes from Monolithic Code

### Before

- 1096 lines in single index.js
- All code mixed together
- Hard to maintain and test

### After

- Modular structure with clear separation of concerns
- Each file has single responsibility
- Easy to find and update specific features
- Better for team collaboration
- Easier to test individual modules

## Module Descriptions

- **config.js**: Reads and exposes environment variables
- **db.js**: Handles JSON database persistence
- **i18n.js**: Multi-language support (Russian/English)
- **utils.js**: Helper functions for finding roles/channels and ownership checks
- **voiceChannels.js**: Core VC creation, cleanup, and text channel pairing
- **settingsPanel.js**: Settings message creation and panel management
- **handlers/**: Event handlers with dependency injection pattern

## To Run

```bash
npm install
node index.js
```
