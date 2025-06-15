const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, shell, session } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const windowStateKeeper = require('electron-window-state');
const _contextMenu = require('electron-context-menu');
const contextMenu = _contextMenu.default || _contextMenu;
const { v4: uuidv4 } = require('uuid');

// Global references
let mainWindow; // Main space management window
let spaceWindows = new Map(); // Map of spaceId -> BrowserWindow
let tray;
let spaces = new Map();
let store; // Will be initialized asynchronously

// Enable sandbox for all renderer processes
app.enableSandbox();

// Default settings
const DEFAULT_SETTINGS = {
    spaces: [],
    theme: 'light',
    adBlockEnabled: true,
    syncEnabled: false,
    language: 'en'
};

// Create the main space management window
function createMainWindow() {
    // Load window state
    let mainWindowState = windowStateKeeper({
        defaultWidth: 1000,
        defaultHeight: 700,
        file: 'main-window-state.json'
    });

    // Create the browser window
    mainWindow = new BrowserWindow({
        x: mainWindowState.x,
        y: mainWindowState.y,
        width: mainWindowState.width,
        height: mainWindowState.height,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            preload: path.join(__dirname, 'preload.js')
        },
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
        show: false,
        title: 'Vera Desktop'
    });

    // Let windowStateKeeper manage the window
    mainWindowState.manage(mainWindow);

    // Load the main renderer
    mainWindow.loadFile(path.join(__dirname, '../renderer/main.html'));

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools();
    }

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Handle window closed
    mainWindow.on('closed', () => {
        mainWindow = null;
        // Close all space windows when main window closes
        spaceWindows.forEach(window => window.close());
        spaceWindows.clear();
    });

    // Set up context menu
    contextMenu({
        showSaveImageAs: true,
        showCopyImageAddress: true,
        showSearchWithGoogle: true,
        showInspectElement: process.env.NODE_ENV === 'development'
    });
}

// Create a space window
function createSpaceWindow(space) {
    console.log('[main] createSpaceWindow called for space:', space);
    // Check if window already exists
    if (spaceWindows.has(space.id)) {
        const existingWindow = spaceWindows.get(space.id);
        existingWindow.focus();
        return existingWindow;
    }

    // Load window state for this space
    let spaceWindowState = windowStateKeeper({
        defaultWidth: 1200,
        defaultHeight: 800,
        file: `space-${space.id}-window-state.json`
    });

    // Create the space window
    const spaceWindow = new BrowserWindow({
        x: spaceWindowState.x,
        y: spaceWindowState.y,
        width: spaceWindowState.width,
        height: spaceWindowState.height,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webviewTag: true,
            preload: path.join(__dirname, 'preload.js'),
            partition: `persist:space-${space.id}` // Isolated session per space
        },
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
        show: false,
        title: `${space.name} - Vera Desktop`
    });

    // Let windowStateKeeper manage the window
    spaceWindowState.manage(spaceWindow);

    // Load the space renderer
    spaceWindow.loadFile(path.join(__dirname, '../renderer/space.html'));

    // Send space data when ready
    spaceWindow.webContents.once('dom-ready', () => {
        // Send space data
        spaceWindow.webContents.send('space-data', space);

        // Send current theme settings
        const settings = store.get('settings');
        spaceWindow.webContents.send('theme-update', settings.theme || 'light');
    });

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
        spaceWindow.webContents.openDevTools();
    }

    // Show window when ready
    spaceWindow.once('ready-to-show', () => {
        spaceWindow.show();
    });

    // Handle window closed
    spaceWindow.on('closed', () => {
        spaceWindows.delete(space.id);
    });

    // Store reference
    spaceWindows.set(space.id, spaceWindow);

    // Configure ad blocking if enabled
    if (space.settings?.adBlockEnabled) {
        setupAdBlocking(spaceWindow.webContents.session);
    }

    return spaceWindow;
}

// Create a new space
function createSpace(config) {
    const spaceId = config.id || uuidv4();
    const spaceConfig = {
        id: spaceId,
        name: config.name || 'New Space',
        icon: config.icon || null,
        color: config.color || '#4a90e2',
        subspaces: config.subspaces || [],
        settings: config.settings || {
            adBlockEnabled: true,
            notifications: true,
            lockEnabled: false
        },
        createdAt: Date.now()
    };

    spaces.set(spaceId, spaceConfig);

    // Save to store
    const settings = store.get('settings');
    settings.spaces.push(spaceConfig);
    store.set('settings', settings);

    return spaceConfig;
}

// Set up ad blocking for a session
function setupAdBlocking(session) {
    session.webRequest.onBeforeRequest({
        urls: [
            '*://*.doubleclick.net/*',
            '*://googleads.g.doubleclick.net/*',
            '*://*.googlesyndication.com/*',
            '*://*.google-analytics.com/*',
            '*://*.googletagmanager.com/*',
            '*://*.google.com/pagead/*',
            '*://*.facebook.com/tr*',
            '*://*.amazon-adsystem.com/*'
        ]
    }, (details, callback) => {
        callback({ cancel: true });
    });
}


// Create system tray
function createTray() {
    // TODO: Add proper tray icon
    if (process.platform === 'darwin') {
        tray = new Tray(nativeImage.createEmpty());
        tray.setToolTip('Vera Desktop');
        updateTrayMenu();

        tray.on('click', () => {
            if (mainWindow) {
                mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
            }
        });
    }
}

// Update tray menu
function updateTrayMenu() {
    if (!tray) return;

    const settings = store.get('settings');
    const menuItems = [
        { label: 'Show Vera Desktop', click: () => mainWindow?.show() },
        { type: 'separator' }
    ];

    // Add spaces to menu
    settings.spaces.forEach(space => {
        menuItems.push({
            label: space.name,
            click: () => openSpace(space.id)
        });
    });

    menuItems.push(
        { type: 'separator' },
        { label: 'Preferences...', click: () => showPreferences() },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() }
    );

    const contextMenu = Menu.buildFromTemplate(menuItems);
    tray.setContextMenu(contextMenu);
}

// Open a space window
function openSpace(spaceId) {
    console.log('[main] openSpace called with spaceId:', spaceId, 'spaces.keys:', Array.from(spaces.keys()));
    const space = spaces.get(spaceId);
    if (space) {
        createSpaceWindow(space);
    } else {
        console.error('[main] openSpace: No space found for id', spaceId);
    }
}

// Show preferences
function showPreferences() {
    mainWindow?.webContents.send('show-preferences');
}

// Initialize store asynchronously
async function initializeStore() {
    try {
        console.log('Initializing store...');
        const Store = (await import('electron-store')).default;
        store = new Store();
        console.log('Store created successfully');

        // Initialize settings if not exists
        if (!store.has('settings')) {
            console.log('Setting default settings');
            store.set('settings', DEFAULT_SETTINGS);
        }
        console.log('Store initialized');
    } catch (error) {
        console.error('Error initializing store:', error);
        throw error;
    }
}

// IPC Handlers
function setupIpcHandlers() {
    console.log('Setting up IPC handlers...');

    // Window controls
    ipcMain.on('window-minimize', (event) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        window?.minimize();
    });

    ipcMain.on('window-maximize', (event) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (window?.isMaximized()) {
            window.unmaximize();
        } else {
            window?.maximize();
        }
    });

    ipcMain.on('window-close', (event) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        window?.close();
    });

    // Space management
    ipcMain.handle('get-spaces', () => {
        console.log('get-spaces called');
        if (!store) {
            console.error('Store not initialized!');
            return [];
        }
        const spaces = store.get('settings.spaces', []);
        console.log('Returning spaces:', spaces);
        return spaces;
    });

    ipcMain.handle('create-space', (event, config) => {
        const space = createSpace(config);
        updateTrayMenu();
        return space;
    });

    ipcMain.handle('update-space', (event, spaceId, updates) => {
        const settings = store.get('settings');
        const spaceIndex = settings.spaces.findIndex(s => s.id === spaceId);

        if (spaceIndex !== -1) {
            settings.spaces[spaceIndex] = { ...settings.spaces[spaceIndex], ...updates };
            store.set('settings', settings);
            spaces.set(spaceId, settings.spaces[spaceIndex]);
            updateTrayMenu();
            return settings.spaces[spaceIndex];
        }

        return null;
    });

    ipcMain.handle('delete-space', (event, spaceId) => {
        const settings = store.get('settings');
        settings.spaces = settings.spaces.filter(s => s.id !== spaceId);
        store.set('settings', settings);
        spaces.delete(spaceId);

        // Close space window if open
        const spaceWindow = spaceWindows.get(spaceId);
        if (spaceWindow) {
            spaceWindow.close();
        }

        updateTrayMenu();
        return true;
    });

    ipcMain.handle('open-space', (event, spaceId) => {
        console.log('[IPC] open-space called with spaceId:', spaceId);
        openSpace(spaceId);
        return true;
    });

    // Subspace management (for space windows)
    ipcMain.handle('get-subspaces', (event, spaceId) => {
        const settings = store.get('settings');
        const space = settings.spaces.find(s => s.id === spaceId);
        return space ? space.subspaces : [];
    });

    ipcMain.handle('create-subspace', (event, spaceId, subspaceConfig) => {
        const settings = store.get('settings');
        const space = settings.spaces.find(s => s.id === spaceId);

        if (space) {
            const subspace = {
                id: uuidv4(),
                name: subspaceConfig.name,
                url: subspaceConfig.url,
                icon: subspaceConfig.icon,
                userAgent: subspaceConfig.userAgent,
                partition: `persist:space-${spaceId}-subspace-${uuidv4()}`,
                createdAt: Date.now()
            };

            space.subspaces.push(subspace);
            store.set('settings', settings);
            spaces.set(spaceId, space);
            return subspace;
        }

        return null;
    });

    ipcMain.handle('delete-subspace', (event, spaceId, subspaceId) => {
        const settings = store.get('settings');
        const space = settings.spaces.find(s => s.id === spaceId);

        if (space) {
            space.subspaces = space.subspaces.filter(s => s.id !== subspaceId);
            store.set('settings', settings);
            spaces.set(spaceId, space);
            return true;
        }

        return false;
    });

    // App catalog
    ipcMain.handle('get-app-catalog', () => {
        return [
            { id: 'gmail', name: 'Gmail', url: 'https://mail.google.com', icon: '<img src="styles/images/google-gmail.svg" alt="Gmail" class="app-icon">', category: 'Email' },
            { id: 'outlook', name: 'Outlook', url: 'https://outlook.office.com', icon: '<img src="styles/images/outlook.svg" alt="Outlook" class="app-icon">', category: 'Email' },
            { id: 'teams', name: 'Microsoft Teams', url: 'https://teams.microsoft.com', icon: '<img src="styles/images/teams.svg" alt="Teams" class="app-icon">', category: 'Communication' },
            { id: 'linkedin', name: 'LinkedIn', url: 'https://linkedin.com', icon: '<img src="styles/images/linkedin.svg" alt="LinkedIn" class="app-icon">', category: 'Career' },
            { id: 'welcometothejungle', name: 'Welcome to the Jungle', url: 'https://app.welcometothejungle.com/', icon: '<img src="styles/images/welcometothejungle.svg" alt="Welcome to the Jungle" class="app-icon">', category: 'Career' },
            { id: 'indeed', name: 'Indeed', url: 'https://indeed.com', icon: '<img src="styles/images/indeed.svg" alt="Indeed" class="app-icon">', category: 'Career' },
            { id: 'glassdoor', name: 'Glassdoor', url: 'https://www.glassdoor.com/', icon: '<img src="styles/images/glassdoor.svg" alt="Glassdoor" class="app-icon">', category: 'Career' },
            { id: 'chatgpt', name: 'ChatGPT', url: 'https://chat.openai.com', icon: '<img src="styles/images/chatgpt.svg" alt="ChatGPT" class="app-icon">', category: 'AI' },
            { id: 'google-drive', name: 'Google Drive', url: 'https://drive.google.com', icon: '<img src="styles/images/google-drive.svg" alt="Google Drive" class="app-icon">', category: 'Productivity' },
            { id: 'google-cal', name: 'Google Calendar', url: 'https://calendar.google.com', icon: '<img src="styles/images/google-cal.svg" alt="Google Calendar" class="app-icon">', category: 'Productivity' },
            { id: 'google-keeps', name: 'Google Keep', url: 'https://keep.google.com', icon: '<img src="styles/images/google-keeps.svg" alt="Google Keep" class="app-icon">', category: 'Productivity' },
            { id: 'google-gemini', name: 'Google Gemini', url: 'https://gemini.google.com', icon: '<img src="styles/images/google-gemini.svg" alt="Google Gemini" class="app-icon">', category: 'AI' },
            { id: 'youtube', name: 'YouTube', url: 'https://youtube.com', icon: '<img src="styles/images/google-youtube.svg" alt="YouTube" class="app-icon">', category: 'Entertainment' },
            { id: 'netflix', name: 'Netflix', url: 'https://netflix.com', icon: '<img src="styles/images/netflix.svg" alt="Netflix" class="app-icon">', category: 'Entertainment' },
            { id: 'canva', name: 'Canva', url: 'https://canva.com', icon: '<img src="styles/images/canva.svg" alt="Canva" class="app-icon">', category: 'Design' },
            { id: 'jira', name: 'Jira', url: 'https://atlassian.net', icon: '<img src="styles/images/jira.svg" alt="Jira" class="app-icon">', category: 'Productivity' },
            { id: 'netsuite', name: 'NetSuite', url: 'https://system.netsuite.com', icon: '<img src="styles/images/netsuite.svg" alt="NetSuite" class="app-icon">', category: 'Business' },
            { id: 'benchmark-education', name: 'Benchmark Education', url: 'https://benchmarkeducation.com', icon: '<img src="styles/images/benchmark-education.svg" alt="Benchmark Education" class="app-icon">', category: 'Education' },
            { id: 'benchmark-universe', name: 'Benchmark Universe', url: 'https://benchmarkuniverse.com', icon: '<img src="styles/images/benchmark-universe.svg" alt="Benchmark Universe" class="app-icon">', category: 'Education' },
            { id: 'freshdesk', name: 'Freshdesk', url: 'https://freshdesk.com', icon: '<img src="styles/images/freshdesk.svg" alt="Freshdesk" class="app-icon">', category: 'Support' },
            { id: 'ringcentral', name: 'RingCentral', url: 'https://app.ringcentral.com', icon: '<img src="styles/images/ringcentral.svg" alt="RingCentral" class="app-icon">', category: 'Communication' },
            { id: 'suno', name: 'Suno', url: 'https://suno.ai', icon: '<img src="styles/images/suno.svg" alt="Suno" class="app-icon">', category: 'AI' },
            { id: 'bookings', name: 'Microsoft Bookings', url: 'https://outlook.office.com/bookings', icon: '<img src="styles/images/bookings.svg" alt="Bookings" class="app-icon">', category: 'Productivity' },
            { id: 'clever', name: 'Clever', url: 'https://clever.com', icon: '<img src="styles/images/clever.svg" alt="Clever" class="app-icon">', category: 'Education' },
            { id: 'classlink', name: 'ClassLink', url: 'https://launchpad.classlink.com', icon: '<img src="styles/images/classlink.svg" alt="ClassLink" class="app-icon">', category: 'Education' },
            { id: 'boa', name: 'Bank of America', url: 'https://bankofamerica.com', icon: '<img src="styles/images/boa.svg" alt="Bank of America" class="app-icon">', category: 'Finance' },
            { id: 'aljazeera', name: 'Al Jazeera', url: 'https://www.aljazeera.com/', icon: '<img src="styles/images/aljazeera.svg" alt="Al Jazeera" class="app-icon">', category: 'News' },
            { id: 'bbc', name: 'BBC', url: 'https://www.bbc.com/news', icon: '<img src="styles/images/bbc.svg" alt="BBC" class="app-icon">', category: 'News' },
            { id: 'cbs-news', name: 'CBS News', url: 'https://www.cbsnews.com/', icon: '<img src="styles/images/cbs-news.svg" alt="CBS News" class="app-icon">', category: 'News' },
            { id: 'cnn', name: 'CNN', url: 'https://www.cnn.com/', icon: '<img src="styles/images/cnn.svg" alt="CNN" class="app-icon">', category: 'News' },
            { id: 'espn', name: 'ESPN', url: 'https://www.espn.com/', icon: '<img src="styles/images/espn.svg" alt="ESPN" class="app-icon">', category: 'Sports' },
            { id: 'euro-news', name: 'Euro News', url: 'https://www.euronews.com/', icon: '<img src="styles/images/euro-news.svg" alt="Euro News" class="app-icon">', category: 'News' },
            { id: 'fox-news', name: 'Fox News', url: 'https://www.foxnews.com/', icon: '<img src="styles/images/fox-news.svg" alt="Fox News" class="app-icon">', category: 'News' },
            { id: 'nbc-news', name: 'NBC News', url: 'https://www.nbcnews.com/', icon: '<img src="styles/images/nbc-news.svg" alt="NBC News" class="app-icon">', category: 'News' },
            { id: 'sky-news', name: 'Sky News', url: 'https://news.sky.com/', icon: '<img src="styles/images/sky-news.svg" alt="Sky News" class="app-icon">', category: 'News' },
            { id: 'youtube-music', name: 'YouTube Music', url: 'https://music.youtube.com/', icon: '<img src="styles/images/youtube-music.svg" alt="YouTube Music" class="app-icon">', category: 'Music' },
            { id: 'philo', name: 'Philo', url: 'https://www.philo.com/', icon: '<img src="styles/images/philo.svg" alt="Philo" class="app-icon">', category: 'Entertainment' },
            { id: 'deepseek', name: 'Deepseek', url: 'https://chat.deepseek.com/', icon: '<img src="styles/images/deepseek.svg" alt="Deepseek" class="app-icon">', category: 'AI' },
            { id: 'claude', name: 'Claude', url: 'https://claude.ai/', icon: '<img src="styles/images/claude.svg" alt="Claude" class="app-icon">', category: 'AI' },
        ];
    });

    // Settings
    ipcMain.handle('update-settings', (event, updates) => {
        const settings = store.get('settings');
        const newSettings = { ...settings, ...updates };
        store.set('settings', newSettings);

        // If theme was updated, notify all space windows
        if (updates.theme) {
            spaceWindows.forEach(window => {
                window.webContents.send('theme-update', updates.theme);
            });
        }

        return newSettings;
    });

    ipcMain.handle('get-settings', () => {
        return store.get('settings');
    });

    // External links
    ipcMain.handle('open-external', (event, url) => {
        shell.openExternal(url);
    });

    // Custom icon handling
    ipcMain.handle('save-custom-icon', async (event, filename, data) => {
        try {
            // Create images directory if it doesn't exist
            const imagesDir = path.join(__dirname, '../renderer/styles/images');
            await fs.mkdir(imagesDir, { recursive: true });

            // Save the file
            const filePath = path.join(imagesDir, filename);
            await fs.writeFile(filePath, Buffer.from(data));

            // Return the relative path for use in the app
            return `styles/images/${filename}`;
        } catch (error) {
            console.error('Error saving custom icon:', error);
            throw error;
        }
    });
}

// App event handlers
app.whenReady().then(async () => {
    try {
        console.log('App ready, initializing...');

        // Initialize store first
        await initializeStore();

        // Set up IPC handlers before creating window
        setupIpcHandlers();
        console.log('IPC handlers set up');

        createMainWindow();
        createTray();

        // Load saved spaces
        const settings = store.get('settings');
        settings.spaces.forEach(space => {
            spaces.set(space.id, space);
        });

        console.log('App initialization complete');
    } catch (error) {
        console.error('Error during app initialization:', error);
    }
});

app.on('window-all-closed', () => {
    // On macOS, keep app running even when all windows are closed
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // On macOS, re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        // Someone tried to run a second instance, focus our window instead
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
} 