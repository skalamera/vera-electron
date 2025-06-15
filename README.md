# Vera Desktop

Transform websites into desktop applications with spaces and multi-account support.

## Features

### 🎯 Core Features
- **Desktop Apps from Websites**: Turn any website into a dedicated desktop application
- **Spaces**: Create separate environments with their own accounts, settings, and browsing data
- **Multi-Account Support**: Stay logged into multiple accounts of the same service simultaneously
- **App Catalog**: Pre-configured popular web apps ready to install
- **Custom Apps**: Create apps from any URL with custom settings

### 🔒 Privacy & Security
- **Isolated Sessions**: Each space runs in its own sandboxed environment
- **Ad Blocking**: Built-in ad and tracker blocking
- **App Lock**: Protect spaces with password or biometric authentication (coming soon)
- **No Tracking**: Your data stays on your device

### 🎨 Customization
- **Dark Theme**: Toggle between light and dark themes
- **Custom Icons & Colors**: Personalize each space
- **Keyboard Shortcuts**: Quick app switching (coming soon)
- **System Tray Integration**: Quick access from the system tray

### ☁️ Sync & Backup
- **Cloud Sync**: Sync spaces, apps, and settings across devices (Pro feature)
- **Local Storage**: All data stored locally using Electron Store

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/vera-desktop.git
cd vera-desktop
```

2. Install dependencies:
```bash
npm install
```

3. Run in development mode:
```bash
npm start
```

### Building

To build for your platform:

```bash
# Windows
npm run dist

# macOS
npm run dist

# Linux
npm run dist
```

## Usage

### Creating a Space
1. Click the "+" button in the sidebar or "Create Your First Space"
2. Give your space a name (e.g., "Work", "Personal")
3. Choose a color for easy identification
4. Enable/disable ad blocking for this space

### Adding Apps
1. Select a space from the sidebar
2. Click the "+" button in the space view
3. Choose from:
   - **App Catalog**: Pre-configured popular apps
   - **Custom App**: Enter any website URL

### Managing Apps
- Click an app to open it
- Hover over an app and click the "X" to delete it
- Each app maintains its own session within the space

## Architecture

### Technology Stack
- **Electron**: Desktop framework
- **Chromium**: Web rendering engine
- **Node.js**: JavaScript runtime
- **electron-store**: Persistent data storage
- **electron-context-menu**: Native context menus

### Project Structure
```
vera-desktop/
├── src/
│   ├── main/           # Main process
│   │   ├── index.js    # Entry point
│   │   └── preload.js  # Preload script
│   ├── renderer/       # Renderer process
│   │   ├── index.html  # Main UI
│   │   ├── js/         # JavaScript
│   │   └── styles/     # CSS
│   └── common/         # Shared modules
├── assets/             # Icons and images
└── package.json        # Project configuration
```

### Security Model
- Context Isolation enabled
- Sandbox mode for all renderers
- Secure IPC communication
- No direct Node.js access in renderers

## Advanced Features (Roadmap)

### Subspaces
- Create nested browser environments within spaces
- Perfect for managing multiple projects or client accounts

### Menu Bar Apps
- Pin frequently used apps to the menu bar
- Quick access with keyboard shortcuts

### Default App Handler
- Set Vera apps as default email or calendar handlers
- Seamless OS integration

### Extensions (Future)
- Support for browser extensions
- Custom user scripts
- Theme marketplace

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- **Documentation**: [docs.veradesktop.com](https://docs.veradesktop.com)
- **Issues**: [GitHub Issues](https://github.com/yourusername/vera-desktop/issues)
- **Community**: [Discord Server](https://discord.gg/veradesktop)

## Acknowledgments

Inspired by WebCatalog and similar projects that make web apps feel native on the desktop.

---

Built with ❤️ by the Vera Desktop Team 