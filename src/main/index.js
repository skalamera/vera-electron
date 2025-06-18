const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, shell, session, clipboard } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const windowStateKeeper = require('electron-window-state');
const _contextMenu = require('electron-context-menu');
const contextMenu = _contextMenu.default || _contextMenu;
const { v4: uuidv4 } = require('uuid');
const OpenAI = require('openai');
const Store = require('electron-store');

// Initialize store
let store = new Store();

// Global references
let mainWindow; // Main space management window
let spaceWindows = new Map(); // Map of spaceId -> BrowserWindow
let tray;
let spaces = new Map();
let openai; // OpenAI API client

// Enable sandbox for all renderer processes
app.enableSandbox();

// Default settings
const DEFAULT_SETTINGS = {
    spaces: [],
    theme: 'light',
    adBlockEnabled: true,
    syncEnabled: false,
    language: 'en',
    openaiApiKey: '' // Add OpenAI API key to settings
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

        mainWindow.webContents.openDevTools({ mode: 'detach' });
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
        spaceWindow.webContents.openDevTools({ mode: 'detach' });
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
        createdAt: Date.now(),
        personalData: config.personalData || '', // New field for personal data
        chatbotType: config.chatbotType || 'generic', // New field for specialized chatbot type
        portfolioData: config.portfolioData || [] // New field for crypto portfolio data
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

// Set up IPC handlers
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
            { id: 'benchmark-universe', name: 'Benchmark Universe', url: 'https://bec-micro.benchmarkuniverse.com', icon: '<img src="styles/images/benchmark-universe.svg" alt="Benchmark Universe" class="app-icon">', category: 'Education' },
            { id: 'freshdesk', name: 'Freshdesk', url: 'http://techsupport.benchmarkeducation.com/', icon: '<img src="styles/images/freshdesk.svg" alt="Freshdesk" class="app-icon">', category: 'Support' },
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
            { id: 'notion', name: 'Notion', url: 'https://www.notion.so/', icon: '📝', category: 'Productivity' },
            { id: 'figma', name: 'Figma', url: 'https://www.figma.com/', icon: '🎨', category: 'Design' },
            { id: 'slack', name: 'Slack', url: 'https://slack.com/', icon: '💬', category: 'Communication' },
            { id: 'discord', name: 'Discord', url: 'https://discord.com/', icon: '🎧', category: 'Communication' },
            { id: 'zoom', name: 'Zoom', url: 'https://zoom.us/', icon: '📞', category: 'Communication' },
            { id: 'google_meet', name: 'Google Meet', url: 'https://meet.google.com/', icon: '👋', category: 'Communication' },
            { id: 'asana', name: 'Asana', url: 'https://asana.com/', icon: '✅', category: 'Productivity' },
            { id: 'trello', name: 'Trello', url: 'https://trello.com/', icon: '📋', category: 'Productivity' },
            { id: 'github', name: 'GitHub', url: 'https://github.com/', icon: '🐙', category: 'Development' },
            { id: 'stackoverflow', name: 'Stack Overflow', url: 'https://stackoverflow.com/', icon: '📚', category: 'Development' },
            { id: 'medium', name: 'Medium', url: 'https://medium.com/', icon: '✍️', category: 'Reading' },
            { id: 'reddit', name: 'Reddit', url: 'https://www.reddit.com/', icon: '👽', category: 'Social' },
            { id: 'twitter', name: 'X (formerly Twitter)', url: 'https://twitter.com/', icon: '🐦', category: 'Social' },
            { id: 'facebook', name: 'Facebook', url: 'https://www.facebook.com/', icon: '👥', category: 'Social' },
            { id: 'instagram', name: 'Instagram', url: 'https://www.instagram.com/', icon: '📸', category: 'Social' },
            { id: 'pinterest', name: 'Pinterest', url: 'https://www.pinterest.com/', icon: '📌', category: 'Social' },
            { id: 'spotify', name: 'Spotify', url: 'https://open.spotify.com/', icon: '🎵', category: 'Music' },
            { id: 'apple_music', name: 'Apple Music', url: 'https://music.apple.com/', icon: '🍎', category: 'Music' },
            { id: 'amazon_prime_video', name: 'Amazon Prime Video', url: 'https://www.primevideo.com/', icon: '🎬', category: 'Entertainment' },
            { id: 'hulu', name: 'Hulu', url: 'https://www.hulu.com/', icon: '📺', category: 'Entertainment' },
            { id: 'disney_plus', name: 'Disney+', url: 'https://www.disneyplus.com/', icon: '🏰', category: 'Entertainment' },
            { id: 'wikipedia', name: 'Wikipedia', url: 'https://www.wikipedia.org/', icon: '🌐', category: 'Reference' },
            { id: 'google_docs', name: 'Google Docs', url: 'https://docs.google.com/', icon: '📄', category: 'Productivity' },
            { id: 'google_sheets', name: 'Google Sheets', url: 'https://sheets.google.com/', icon: '📊', category: 'Productivity' },
            { id: 'google_slides', name: 'Google Slides', url: 'https://slides.google.com/', icon: ' presentaciones', category: 'Productivity' },
            { id: 'miro', name: 'Miro', url: 'https://miro.com/', icon: '💡', category: 'Collaboration' },
            { id: 'zoom_whiteboard', name: 'Zoom Whiteboard', url: 'https://zoom.us/whiteboard', icon: '칠판', category: 'Collaboration' },
            { id: 'monday', name: 'Monday.com', url: 'https://monday.com/', icon: '🗓️', category: 'Productivity' },
            { id: 'clickup', name: 'ClickUp', url: 'https://clickup.com/', icon: '🚀', category: 'Productivity' },
            { id: 'salesforce', name: 'Salesforce', url: 'https://www.salesforce.com/', icon: '☁️', category: 'CRM' },
            { id: 'hubspot', name: 'HubSpot', url: 'https://www.hubspot.com/', icon: '🧡', category: 'CRM' },
            { id: 'stripe', name: 'Stripe', url: 'https://stripe.com/', icon: '💳', category: 'Finance' },
            { id: 'paypal', name: 'PayPal', url: 'https://www.paypal.com/', icon: '💰', category: 'Finance' },
            { id: 'binance', name: 'Binance', url: 'https://www.binance.com/', icon: '₿', category: 'Finance' },
            { id: 'coinbase', name: 'Coinbase', url: 'https://www.coinbase.com/', icon: '🪙', category: 'Finance' },
            { id: 'robinhood', name: 'Robinhood', url: 'https://robinhood.com/', icon: '📈', category: 'Finance' },
            { id: 'fidelity', name: 'Fidelity', url: 'https://www.fidelity.com/', icon: '🏛️', category: 'Finance' },
            { id: 'schwab', name: 'Charles Schwab', url: 'https://www.schwab.com/', icon: '🏦', category: 'Finance' },
            { id: 'zillow', name: 'Zillow', url: 'https://www.zillow.com/', icon: '🏠', category: 'Real Estate' },
            { id: 'redfin', name: 'Redfin', url: 'https://www.redfin.com/', icon: '🏡', category: 'Real Estate' },
            { id: 'airbnb', name: 'Airbnb', url: 'https://www.airbnb.com/', icon: '✈️', category: 'Travel' },
            { id: 'booking_com', name: 'Booking.com', url: 'https://www.booking.com/', icon: '🏨', category: 'Travel' },
            { id: 'expedia', name: 'Expedia', url: 'https://www.expedia.com/', icon: '🗺️', category: 'Travel' },
            { id: 'uber', name: 'Uber', url: 'https://www.uber.com/', icon: '🚗', category: 'Transportation' },
            { id: 'lyft', name: 'Lyft', url: 'https://www.lyft.com/', icon: '🚕', category: 'Transportation' },
            { id: 'doordash', name: 'DoorDash', url: 'https://www.doordash.com/', icon: '🍔', category: 'Food' },
            { id: 'ubereats', name: 'Uber Eats', url: 'https://www.ubereats.com/', icon: '🍟', category: 'Food' },
            { id: 'instacart', name: 'Instacart', url: 'https://www.instacart.com/', icon: '🛒', category: 'Food' },
            { id: 'amazon', name: 'Amazon', url: 'https://www.amazon.com/', icon: '📦', category: 'Shopping' },
            { id: 'ebay', name: 'eBay', url: 'https://www.ebay.com/', icon: '🏷️', category: 'Shopping' },
            { id: 'etsy', name: 'Etsy', url: 'https://www.etsy.com/', icon: '🛍️', category: 'Shopping' },
            { id: 'walmart', name: 'Walmart', url: 'https://www.walmart.com/', icon: '🏬', category: 'Shopping' },
            { id: 'target', name: 'Target', url: 'https://www.target.com/', icon: '🎯', category: 'Shopping' },
            { id: 'bestbuy', name: 'Best Buy', url: 'https://www.bestbuy.com/', icon: '💻', category: 'Shopping' },
            { id: 'homedepot', name: 'Home Depot', url: 'https://www.homedepot.com/', icon: '🛠️', category: 'Shopping' },
            { id: 'lowes', name: 'Lowes', url: 'https://www.lowes.com/', icon: '🏡', category: 'Shopping' },
            { id: 'wayfair', name: 'Wayfair', url: 'https://www.wayfair.com/', icon: '🛋️', category: 'Shopping' },
            { id: 'ikea', name: 'IKEA', url: 'https://www.ikea.com/', icon: 'urn', category: 'Shopping' },
            { id: 'zara', name: 'Zara', url: 'https://www.zara.com/', icon: '👗', category: 'Shopping' },
            { id: 'hm', name: 'H&M', url: 'https://www2.hm.com/', icon: '👕', category: 'Shopping' },
            { id: 'shein', name: 'SHEIN', url: 'https://us.shein.com/', icon: '✨', category: 'Shopping' },
            { id: 'aliexpress', name: 'AliExpress', url: 'https://www.aliexpress.com/', icon: '💎', category: 'Shopping' },
            { id: 'temu', name: 'Temu', url: 'https://www.temu.com/', icon: '🍀', category: 'Shopping' },
            { id: 'microsoft_365', name: 'Microsoft 365', url: 'https://www.microsoft365.com/', icon: '📊', category: 'Productivity' },
            { id: 'google_workspace', name: 'Google Workspace', url: 'https://workspace.google.com/', icon: '📝', category: 'Productivity' },
            { id: 'adobe_creative_cloud', name: 'Adobe Creative Cloud', url: 'https://www.adobe.com/creativecloud.html', icon: '🅰️', category: 'Design' },
            { id: 'salesforce_trailhead', name: 'Salesforce Trailhead', url: 'https://trailhead.salesforce.com/', icon: '⛰️', category: 'Education' },
            { id: 'coursera', name: 'Coursera', url: 'https://www.coursera.org/', icon: '🎓', category: 'Education' },
            { id: 'udemy', name: 'Udemy', url: 'https://www.udemy.com/', icon: '📚', category: 'Education' },
            { id: 'khan_academy', name: 'Khan Academy', url: 'https://www.khanacademy.org/', icon: '🏫', category: 'Education' },
            { id: 'leetcode', name: 'LeetCode', url: 'https://leetcode.com/', icon: '💻', category: 'Development' },
            { id: 'hackerrank', name: 'HackerRank', url: 'https://www.hackerrank.com/', icon: '🏆', category: 'Development' },
            { id: 'codewars', name: 'Codewars', url: 'https://www.codewars.com/', icon: '🥋', category: 'Development' },
            { id: 'medium_dev', name: 'Medium (Developers)', url: 'https://dev.to/', icon: '👩‍💻', category: 'Development' },
            { id: 'stack_exchange', name: 'Stack Exchange', url: 'https://stackexchange.com/', icon: '💬', category: 'Development' },
            { id: 'artstation', name: 'ArtStation', url: 'https://www.artstation.com/', icon: '🖼️', category: 'Design' },
            { id: 'behance', name: 'Behance', url: 'https://www.behance.net/', icon: '💡', category: 'Design' },
            { id: 'dribbble', name: 'Dribbble', url: 'https://dribbble.com/', icon: '🏀', category: 'Design' },
            { id: 'unsplash', name: 'Unsplash', url: 'https://unsplash.com/', icon: '📸', category: 'Design' },
            { id: 'pexels', name: 'Pexels', url: 'https://www.pexels.com/', icon: '📷', category: 'Design' },
            { id: 'pixabay', name: 'Pixabay', url: 'https://pixabay.com/', icon: '🌄', category: 'Design' },
            { id: 'flaticon', name: 'Flaticon', url: 'https://www.flaticon.com/', icon: '✨', category: 'Design' },
            { id: 'thenounproject', name: 'The Noun Project', url: 'https://thenounproject.com/', icon: '🅰️', category: 'Design' },
            { id: 'font_awesome', name: 'Font Awesome', url: 'https://fontawesome.com/', icon: '🌟', category: 'Design' },
            { id: 'google_fonts', name: 'Google Fonts', url: 'https://fonts.google.com/', icon: '🔤', category: 'Design' },
            { id: 'color_hunt', name: 'Color Hunt', url: 'https://colorhunt.co/', icon: '🌈', category: 'Design' },
            { id: 'coolors', name: 'Coolors', url: 'https://coolors.co/', icon: '🎨', category: 'Design' },
            { id: 'microsoft_copilot', name: 'Microsoft Copilot', url: 'https://m365.cloud.microsoft', icon: '<img src="styles/images/m365copilot.svg" alt="Microsoft Copilot" class="app-icon">', category: 'AI' }
        ];
    });

    // ChatGPT integration
    ipcMain.handle('get-chatgpt-response', async (event, payload) => {
        try {
            const settings = store.get('settings');
            const apiKey = settings.openaiApiKey;

            if (!apiKey) {
                throw new Error('OpenAI API key not configured');
            }

            // Initialize OpenAI client if not already done
            if (!openai) {
                openai = new OpenAI({
                    apiKey: apiKey
                });
            }

            // Support both string and object payloads for backward compatibility
            let messages;
            if (typeof payload === 'object' && payload.context) {
                messages = [
                    {
                        role: "system",
                        content: `You are Vera, a helpful AI assistant integrated into the Vera Desktop application.\nYou provide concise, accurate, and friendly responses to help users with their tasks.\nWhen the user asks about the current page or email, use the provided context below to answer.\nIf the context is not relevant to the question, you can ignore it and provide a general response.\nKeep your responses focused and helpful, and if you're not sure about something, say so.`
                    },
                    {
                        role: "user",
                        content: payload.context
                    },
                    {
                        role: "user",
                        content: payload.user
                    }
                ];
            } else {
                messages = [
                    {
                        role: "system",
                        content: `You are Vera, a helpful AI assistant integrated into the Vera Desktop application.\nYou provide concise, accurate, and friendly responses to help users with their tasks.\nWhen the user asks about the current page or email, use the provided context below to answer.\nIf the context is not relevant to the question, you can ignore it and provide a general response.\nKeep your responses focused and helpful, and if you're not sure about something, say so.`
                    },
                    {
                        role: "user",
                        content: typeof payload === 'string' ? payload : ''
                    }
                ];
            }

            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages,
                max_tokens: 2000,
                temperature: 0.7,
                stream: true
            });

            return completion.choices[0].message.content;
        } catch (error) {
            console.error('Error getting ChatGPT response:', error);
            throw error;
        }
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

    // Vera AI handlers
    ipcMain.handle('get-vera-ai-settings', async () => {
        const settings = store.get('settings');
        return settings.veraAI || { enabled: false, apiKey: '', model: 'gpt-4-turbo-preview' };
    });

    // Handle Vera AI message
    ipcMain.handle('send-chat-message', async (event, messageData) => {
        try {
            const settings = store.get('settings');
            if (!settings.veraAI?.enabled || !settings.veraAI?.apiKey) {
                throw new Error('Vera AI is not enabled or API key is missing');
            }

            // Initialize OpenAI client if not already initialized
            if (!openai) {
                openai = new OpenAI({
                    apiKey: settings.veraAI.apiKey
                });
            }

            // Prepare messages
            let messages;
            if (typeof messageData === 'object' && messageData.context) {
                messages = [
                    {
                        role: "system",
                        content: `You are Vera, a helpful AI assistant integrated into the Vera Desktop application.\nYou provide concise, accurate, and friendly responses to help users with their tasks.\nWhen the user asks about the current page or email, use the provided context below to answer.\nIf the context is not relevant to the question, you can ignore it and provide a general response.\nKeep your responses focused and helpful, and if you're not sure about something, say so.`
                    },
                    {
                        role: "user",
                        content: messageData.context
                    },
                    {
                        role: "user",
                        content: messageData.user
                    }
                ];
            } else {
                messages = [
                    {
                        role: "system",
                        content: `You are Vera, a helpful AI assistant integrated into the Vera Desktop application.\nYou provide concise, accurate, and friendly responses to help users with their tasks.\nWhen the user asks about the current page or email, use the provided context below to answer.\nIf the context is not relevant to the question, you can ignore it and provide a general response.\nKeep your responses focused and helpful, and if you're not sure about something, say so.`
                    },
                    {
                        role: "user",
                        content: typeof messageData === 'string' ? messageData : ''
                    }
                ];
            }

            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages,
                max_tokens: 2000,
                temperature: 0.7,
                stream: true
            });

            // Handle streaming response
            for await (const chunk of completion) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                    event.sender.send('vera-ai-response', {
                        type: 'chunk',
                        content
                    });
                }
            }

            // Send completion message
            event.sender.send('vera-ai-response', {
                type: 'complete'
            });

        } catch (error) {
            console.error('Error processing Vera AI message:', error);
            event.sender.send('vera-ai-response', {
                type: 'error',
                error: error.message
            });
        }
    });

    // Add IPC handler for webview context menu
    ipcMain.handle('show-webview-context-menu', async (event, params) => {
        console.log('[main] show-webview-context-menu IPC handler called with params:', params);
        const { x, y, tagName, isEditable } = params;
        const template = [];

        // Standard browser-like context menu
        if (isEditable) {
            template.push(
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' },
            );
        } else {
            template.push(
                { role: 'copy' },
                { type: 'separator' },
                { role: 'selectAll' },
            );
        }

        // Separator for future custom options
        template.push({ type: 'separator' });
        // Example custom option (disabled for now)
        // template.push({ label: 'Custom Option', enabled: false });

        const menu = Menu.buildFromTemplate(template);
        // Show the menu at the requested coordinates
        const win = BrowserWindow.fromWebContents(event.sender);
        console.log('[main] Showing context menu at', { x, y }, 'for tag', tagName, 'isEditable:', isEditable);
        menu.popup({
            window: win,
            x: x,
            y: y
        });
        console.log('[main] Context menu popup triggered');
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