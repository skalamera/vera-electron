// Global state
let currentSpaceId = null;
let spaces = [];
let currentApps = [];
let activeWebviews = new Map();

console.log('app.js loaded');
console.log('veraAPI available:', !!window.veraAPI);

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, initializing app...');

    try {
        // Check if veraAPI is available
        if (!window.veraAPI) {
            console.error('veraAPI not available!');
            return;
        }

        // Set platform class for OS-specific styling
        document.body.classList.add(`platform-${window.veraAPI.system.platform}`);

        // Initialize
        await loadSpaces();
        await loadSettings();
        setupEventListeners();

        // Load app catalog
        await loadAppCatalog();

        // Show welcome screen if no spaces
        if (spaces.length === 0) {
            showWelcomeScreen();
        }

        console.log('App initialized successfully');
    } catch (error) {
        console.error('Error initializing app:', error);
    }
});

// Setup event listeners
function setupEventListeners() {
    console.log('Setting up event listeners...');

    // Title bar controls (Windows/Linux)
    const minimizeBtn = document.getElementById('minimize-btn');
    const maximizeBtn = document.getElementById('maximize-btn');
    const closeBtn = document.getElementById('close-btn');

    console.log('Title bar buttons:', { minimizeBtn, maximizeBtn, closeBtn });

    minimizeBtn?.addEventListener('click', () => {
        console.log('Minimize clicked');
        window.veraAPI.window.minimize();
    });

    maximizeBtn?.addEventListener('click', () => {
        console.log('Maximize clicked');
        window.veraAPI.window.maximize();
    });

    closeBtn?.addEventListener('click', () => {
        console.log('Close clicked');
        window.veraAPI.window.close();
    });

    // Sidebar
    const createSpaceBtn = document.getElementById('create-space-btn');
    const settingsBtn = document.getElementById('settings-btn');

    console.log('Sidebar buttons:', { createSpaceBtn, settingsBtn });

    createSpaceBtn?.addEventListener('click', () => {
        console.log('Create space clicked');
        showModal('create-space-modal');
    });

    settingsBtn?.addEventListener('click', () => {
        console.log('Settings clicked');
        showModal('settings-modal');
    });

    // Welcome screen
    const quickCreateSpaceBtn = document.getElementById('quick-create-space');
    const browseAppsBtn = document.getElementById('browse-apps');

    console.log('Welcome buttons:', { quickCreateSpaceBtn, browseAppsBtn });

    quickCreateSpaceBtn?.addEventListener('click', () => {
        console.log('Quick create space clicked');
        showModal('create-space-modal');
    });

    browseAppsBtn?.addEventListener('click', () => {
        console.log('Browse apps clicked');
        showModal('add-app-modal');
        switchTab('catalog');
    });

    // Space view
    document.getElementById('add-app-btn').addEventListener('click', () => {
        showModal('add-app-modal');
    });

    document.getElementById('space-settings-btn').addEventListener('click', () => {
        // TODO: Implement space-specific settings
        showModal('settings-modal');
    });

    // Search
    document.getElementById('app-search').addEventListener('input', filterAppCatalog);

    // Listen for space switches from main process
    window.veraAPI.spaces.onSwitch((spaceId) => {
        switchToSpace(spaceId);
    });

    // Listen for preferences
    window.veraAPI.settings.onShowPreferences(() => {
        showModal('settings-modal');
    });

    // Handle icon upload for create space
    const spaceIconUpload = document.getElementById('space-icon-upload');
    if (spaceIconUpload) spaceIconUpload.addEventListener('change', handleSpaceIconUpload);

    // Handle icon upload for edit space
    const editSpaceIconUpload = document.getElementById('edit-space-icon-upload');
    if (editSpaceIconUpload) editSpaceIconUpload.addEventListener('change', handleEditSpaceIconUpload);
}

// Load spaces
async function loadSpaces() {
    spaces = await window.veraAPI.spaces.getAll();
    renderSpaces();
}

// Render spaces in sidebar
function renderSpaces() {
    const spacesList = document.getElementById('spaces-list');
    spacesList.innerHTML = '';

    spaces.forEach(space => {
        const spaceElement = createSpaceElement(space);
        spacesList.appendChild(spaceElement);
    });
}

// Create space element
function createSpaceElement(space) {
    const div = document.createElement('div');
    div.className = 'space-item';
    div.dataset.spaceId = space.id;

    if (space.id === currentSpaceId) {
        div.classList.add('active');
    }

    div.innerHTML = `
        <div class="space-icon" style="background-color: ${space.color}">
            ${space.icon || space.name.charAt(0).toUpperCase()}
        </div>
        <span class="space-name">${space.name}</span>
        <button class="icon-button space-delete" onclick="deleteSpace('${space.id}', event)" title="Delete Space">
            <svg width="16" height="16" viewBox="0 0 16 16">
                <path d="M2 2 L14 14 M14 2 L2 14" stroke="currentColor" stroke-width="2"/>
            </svg>
        </button>
    `;

    div.addEventListener('click', (e) => {
        if (!e.target.closest('.space-delete')) {
            switchToSpace(space.id);
        }
    });

    return div;
}

// Switch to space
async function switchToSpace(spaceId) {
    currentSpaceId = spaceId;
    const space = spaces.find(s => s.id === spaceId);

    if (!space) return;

    // Update UI
    document.querySelectorAll('.space-item').forEach(item => {
        item.classList.toggle('active', item.dataset.spaceId === spaceId);
    });

    // Hide welcome screen
    document.getElementById('welcome-screen').style.display = 'none';
    document.getElementById('space-view').style.display = 'flex';

    // Update space header
    document.getElementById('space-name').textContent = space.name;

    // Load apps for this space
    currentApps = await window.veraAPI.apps.getAll(spaceId);
    renderApps();
}

// Render apps
function renderApps() {
    const appGrid = document.getElementById('app-grid');
    const webviewContainer = document.getElementById('webview-container');

    appGrid.innerHTML = '';
    appGrid.style.display = 'grid';
    webviewContainer.style.display = 'none';

    // Clear existing webviews
    activeWebviews.forEach(webview => webview.remove());
    activeWebviews.clear();

    currentApps.forEach(app => {
        const appElement = createAppElement(app);
        appGrid.appendChild(appElement);
    });
}

// Create app element
function createAppElement(app) {
    const div = document.createElement('div');
    div.className = 'app-item';
    div.dataset.appId = app.id;

    div.innerHTML = `
        <div class="app-icon">
            ${app.icon || '🌐'}
        </div>
        <span class="app-name">${app.name}</span>
        <button class="icon-button app-delete" onclick="deleteApp('${app.id}', event)" title="Delete App">
            <svg width="16" height="16" viewBox="0 0 16 16">
                <path d="M2 2 L14 14 M14 2 L2 14" stroke="currentColor" stroke-width="2"/>
            </svg>
        </button>
    `;

    div.addEventListener('click', (e) => {
        if (!e.target.closest('.app-delete')) {
            openApp(app);
        }
    });

    return div;
}

// Open app in webview
function openApp(app) {
    const appGrid = document.getElementById('app-grid');
    const webviewContainer = document.getElementById('webview-container');

    appGrid.style.display = 'none';
    webviewContainer.style.display = 'flex';

    // Check if webview already exists
    let webview = activeWebviews.get(app.id);

    if (!webview) {
        // Create new webview
        webview = document.createElement('webview');
        webview.src = app.url;
        webview.partition = app.partition;
        webview.setAttribute('allowpopups', 'true');
        webview.setAttribute('nodeintegration', 'false');
        webview.setAttribute('contextIsolation', 'true');

        if (app.userAgent) {
            webview.setAttribute('useragent', app.userAgent);
        }

        activeWebviews.set(app.id, webview);
    }

    // Clear container and add webview
    webviewContainer.innerHTML = '';
    webviewContainer.appendChild(webview);
}

// Show welcome screen
function showWelcomeScreen() {
    document.getElementById('welcome-screen').style.display = 'flex';
    document.getElementById('space-view').style.display = 'none';
}

// Modal functions
function showModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

window.closeModal = function (modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Create space
window.createSpace = async function () {
    const name = document.getElementById('space-name-input').value.trim();
    const color = document.getElementById('space-color-input').value;
    const adBlockEnabled = document.getElementById('space-adblock-input').checked;
    const icon = document.getElementById('space-icon-input').value.trim();

    if (!name) {
        alert('Please enter a space name');
        return;
    }

    const space = await window.veraAPI.spaces.create({
        name,
        color,
        icon,
        settings: { adBlockEnabled }
    });

    spaces.push(space);
    renderSpaces();

    // Reset form
    document.getElementById('create-space-form').reset();
    clearSpaceIconPreview();
    closeModal('create-space-modal');

    // Switch to new space
    switchToSpace(space.id);
}

// Delete space
window.deleteSpace = async function (spaceId, event) {
    event.stopPropagation();

    if (!confirm('Are you sure you want to delete this space?')) {
        return;
    }

    await window.veraAPI.spaces.delete(spaceId);

    spaces = spaces.filter(s => s.id !== spaceId);
    renderSpaces();

    if (currentSpaceId === spaceId) {
        currentSpaceId = null;
        if (spaces.length > 0) {
            switchToSpace(spaces[0].id);
        } else {
            showWelcomeScreen();
        }
    }
}

// Load app catalog
async function loadAppCatalog() {
    const catalog = await window.veraAPI.apps.getCatalog();
    const catalogContainer = document.getElementById('app-catalog');

    catalogContainer.innerHTML = '';

    catalog.forEach(app => {
        const appElement = document.createElement('div');
        appElement.className = 'catalog-app';
        appElement.dataset.app = JSON.stringify(app);

        appElement.innerHTML = `
            <div class="catalog-app-icon">${app.icon}</div>
            <div class="catalog-app-name">${app.name}</div>
        `;

        appElement.addEventListener('click', () => addCatalogApp(app));

        catalogContainer.appendChild(appElement);
    });
}

// Filter app catalog
function filterAppCatalog(event) {
    const searchTerm = event.target.value.toLowerCase();
    const apps = document.querySelectorAll('.catalog-app');

    apps.forEach(app => {
        const name = app.querySelector('.catalog-app-name').textContent.toLowerCase();
        app.style.display = name.includes(searchTerm) ? 'flex' : 'none';
    });
}

// Add catalog app
async function addCatalogApp(catalogApp) {
    if (!currentSpaceId) {
        alert('Please select a space first');
        return;
    }

    const app = await window.veraAPI.apps.create(currentSpaceId, {
        name: catalogApp.name,
        url: catalogApp.url,
        icon: catalogApp.icon
    });

    currentApps.push(app);
    renderApps();

    closeModal('add-app-modal');
}

// Add custom app
window.addCustomApp = async function () {
    if (!currentSpaceId) {
        alert('Please select a space first');
        return;
    }

    const name = document.getElementById('app-name-input').value.trim();
    const url = document.getElementById('app-url-input').value.trim();
    const icon = document.getElementById('app-icon-input').value.trim();

    if (!name || !url) {
        alert('Please enter app name and URL');
        return;
    }

    const app = await window.veraAPI.apps.create(currentSpaceId, {
        name,
        url,
        icon
    });

    currentApps.push(app);
    renderApps();

    // Reset form
    document.getElementById('custom-app-form').reset();
    closeModal('add-app-modal');
}

// Delete app
window.deleteApp = async function (appId, event) {
    event.stopPropagation();

    if (!confirm('Are you sure you want to delete this app?')) {
        return;
    }

    await window.veraAPI.apps.delete(currentSpaceId, appId);

    currentApps = currentApps.filter(a => a.id !== appId);
    renderApps();

    // Remove webview if exists
    const webview = activeWebviews.get(appId);
    if (webview) {
        webview.remove();
        activeWebviews.delete(appId);
    }
}

// Switch tabs
window.switchTab = function (tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.toggle('active', tab.textContent.toLowerCase().includes(tabName));
    });

    // Update tab content
    document.getElementById('catalog-tab').style.display = tabName === 'catalog' ? 'block' : 'none';
    document.getElementById('custom-tab').style.display = tabName === 'custom' ? 'block' : 'none';
}

// Load settings
async function loadSettings() {
    const settings = await window.veraAPI.settings.get();

    // Apply theme
    if (settings.theme === 'dark') {
        document.body.classList.add('dark-theme');
        document.getElementById('dark-theme-checkbox').checked = true;
    }

    document.getElementById('sync-enabled-checkbox').checked = settings.syncEnabled;
    document.getElementById('global-adblock-checkbox').checked = settings.adBlockEnabled;
}

// Save settings
window.saveSettings = async function () {
    const darkTheme = document.getElementById('dark-theme-checkbox').checked;
    const syncEnabled = document.getElementById('sync-enabled-checkbox').checked;
    const adBlockEnabled = document.getElementById('global-adblock-checkbox').checked;

    await window.veraAPI.settings.update({
        theme: darkTheme ? 'dark' : 'light',
        syncEnabled,
        adBlockEnabled
    });

    // Apply theme immediately
    document.body.classList.toggle('dark-theme', darkTheme);

    closeModal('settings-modal');
}

// Handle icon upload for create space
function handleSpaceIconUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const validTypes = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
        alert('Please upload a valid image file (SVG, PNG, or JPG)');
        return;
    }
    if (file.size > 2 * 1024 * 1024) {
        alert('File size must be less than 2MB');
        return;
    }
    const timestamp = Date.now();
    const extension = file.name.split('.').pop();
    const filename = `space-icon-${timestamp}.${extension}`;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const iconPath = await window.veraAPI.saveCustomIcon(filename, e.target.result);
            document.getElementById('space-icon-input').value = `<img src="${iconPath}" alt="Space Icon" class="space-icon">`;
            const preview = document.getElementById('space-icon-preview');
            const previewImage = document.getElementById('space-preview-image');
            previewImage.src = iconPath;
            preview.style.display = 'flex';
        } catch (error) {
            alert('Failed to save icon');
        }
    };
    reader.readAsArrayBuffer(file);
}

function clearSpaceIconPreview() {
    document.getElementById('space-icon-input').value = '';
    document.getElementById('space-preview-image').src = '';
    document.getElementById('space-icon-preview').style.display = 'none';
    document.getElementById('space-icon-upload').value = '';
}

// Handle icon upload for edit space
function handleEditSpaceIconUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const validTypes = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
        alert('Please upload a valid image file (SVG, PNG, or JPG)');
        return;
    }
    if (file.size > 2 * 1024 * 1024) {
        alert('File size must be less than 2MB');
        return;
    }
    const timestamp = Date.now();
    const extension = file.name.split('.').pop();
    const filename = `space-icon-${timestamp}.${extension}`;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const iconPath = await window.veraAPI.saveCustomIcon(filename, e.target.result);
            document.getElementById('edit-space-icon-input').value = `<img src="${iconPath}" alt="Space Icon" class="space-icon">`;
            const preview = document.getElementById('edit-space-icon-preview');
            const previewImage = document.getElementById('edit-space-preview-image');
            previewImage.src = iconPath;
            preview.style.display = 'flex';
        } catch (error) {
            alert('Failed to save icon');
        }
    };
    reader.readAsArrayBuffer(file);
}

function clearEditSpaceIconPreview() {
    document.getElementById('edit-space-icon-input').value = '';
    document.getElementById('edit-space-preview-image').src = '';
    document.getElementById('edit-space-icon-preview').style.display = 'none';
    document.getElementById('edit-space-icon-upload').value = '';
}

async function editSpace(spaceId) {
    const space = spaces.find(s => s.id === spaceId);
    if (!space) return;
    document.getElementById('edit-space-name-input').value = space.name;
    document.getElementById('edit-space-color-input').value = space.color;
    document.getElementById('edit-space-adblock-input').checked = space.settings?.adBlockEnabled || false;
    document.getElementById('edit-space-icon-input').value = space.icon || '';
    // Preview if icon exists
    if (space.icon && space.icon.startsWith('<img')) {
        const match = space.icon.match(/src=\"([^\"]+)\"/);
        if (match) {
            document.getElementById('edit-space-preview-image').src = match[1];
            document.getElementById('edit-space-icon-preview').style.display = 'flex';
        }
    } else {
        clearEditSpaceIconPreview();
    }
    document.getElementById('edit-space-form').dataset.spaceId = spaceId;
    showModal('edit-space-modal');
}

async function updateSpace() {
    const form = document.getElementById('edit-space-form');
    const spaceId = form.dataset.spaceId;
    const nameInput = document.getElementById('edit-space-name-input');
    const colorInput = document.getElementById('edit-space-color-input');
    const adBlockInput = document.getElementById('edit-space-adblock-input');
    const iconInput = document.getElementById('edit-space-icon-input');
    if (!nameInput?.value.trim()) {
        alert('Please enter a space name');
        return;
    }
    try {
        const updates = {
            name: nameInput.value.trim(),
            color: colorInput.value,
            icon: iconInput.value.trim(),
            settings: {
                adBlockEnabled: adBlockInput.checked
            }
        };
        const updatedSpace = await window.veraAPI.updateSpace(spaceId, updates);
        const index = spaces.findIndex(s => s.id === spaceId);
        if (index !== -1) {
            spaces[index] = updatedSpace;
        }
        renderHomeView();
        renderSpaces();
        closeModal('edit-space-modal');
        showNotification('Space updated successfully!', 'success');
    } catch (error) {
        alert('Failed to update space');
    }
} 