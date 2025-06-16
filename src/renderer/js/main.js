// Main window JavaScript
let currentView = 'home';
let spaces = [];
let appCatalog = [];
let addAppToPodSelectedAppId = null;
let addAppToPodSelectedSpaceId = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Main window DOM loaded');

    // Set up event listeners
    setupEventListeners();

    // Load initial data
    await loadSpaces();
    await loadAppCatalog();

    // Update UI
    updateSpacesCount();
    updateAppsCount();
    renderHomeView();

    // Initialize Vera AI if enabled
    await initializeMainPageVeraAI();

    console.log('Main window initialized');
});

// Initialize Vera AI for main page
async function initializeMainPageVeraAI() {
    console.log('[Vera Debug] initializeMainPageVeraAI called');
    try {
        const settings = await window.veraAPI.getSettings();
        console.log('[Vera Debug] Vera settings:', settings.veraAI);
        if (settings.veraAI?.enabled && settings.veraAI?.apiKey) {
            // Load Vera AI widget
            const widgetScript = document.createElement('script');
            widgetScript.src = '../vera-ai/widget.js';
            widgetScript.onload = () => {
                setTimeout(() => {
                    if (window.VeraWidget) {
                        if (!document.getElementById('vera-ai-widget')) {
                            console.log('[Vera Debug] VeraWidget class found');
                            // Main window always uses generic chatbot type
                            console.log('[Vera Debug] Initializing main window widget with generic type');
                            window.veraWidget = new window.VeraWidget('generic');
                            window.veraWidget.createWidget();
                            console.log('[Vera Debug] VeraWidget created');
                            // Set up message handler
                            window.veraWidget.onSendMessage = async (message) => {
                                handleMainPageVeraAIMessage(message, settings.veraAI.apiKey);
                            };
                        } else {
                            console.warn('[Vera Debug] Widget already exists, skipping creation.');
                        }
                    } else {
                        console.error('[Vera Debug] VeraWidget class NOT found after script load');
                    }
                }, 100);
            };
            widgetScript.onerror = (e) => console.error('[Vera Debug] Failed to load widget.js', e);
            document.head.appendChild(widgetScript);

            const widgetStyles = document.createElement('link');
            widgetStyles.rel = 'stylesheet';
            widgetStyles.href = '../vera-ai/widget.css';
            widgetStyles.onload = () => console.log('[Vera Debug] widget.css loaded');
            widgetStyles.onerror = (e) => console.error('[Vera Debug] Failed to load widget.css', e);
            document.head.appendChild(widgetStyles);
        } else {
            console.log('[Vera Debug] Vera AI not enabled or API key missing');
        }
    } catch (error) {
        console.error('Error initializing Vera AI:', error);
    }
}

// Handle Vera AI message from main page
async function handleMainPageVeraAIMessage(message, apiKey) {
    try {
        // Start streaming response
        window.veraWidget.startStreamingResponse();

        // For main page, we don't have specific page context
        // But we can provide context about the Vera Desktop app
        const context = `
You are in the Vera Desktop application main page. This is an Electron-based application that allows users to:
- Create "Pods" (workspaces) to organize web applications
- Add web applications to these pods
- Keep different accounts and settings separate between pods
- Browse an app catalog with popular web services
- Manage settings like theme, ad blocking, and more

The user might ask about how to use the application, create pods, add apps, or general questions.
`;

        // Call OpenAI API
        const response = await callOpenAI(message, context, apiKey);

        // Stream response
        for await (const chunk of streamOpenAIResponse(response)) {
            window.veraWidget.updateStreamingResponse(chunk);
        }

        window.veraWidget.finishStreamingResponse();
    } catch (error) {
        console.error('Error processing Vera AI message:', error);
        window.veraWidget.addMessage('assistant', 'Sorry, I encountered an error. Please check your API key and try again.');
        window.veraWidget.finishStreamingResponse();
    }
}

// Call OpenAI API (shared with space.js)
async function callOpenAI(message, context, apiKey) {
    const messages = [
        {
            role: 'system',
            content: `You are Vera, a helpful AI assistant integrated into the Vera Desktop application. ${context}`
        },
        {
            role: 'user',
            content: message
        }
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'gpt-4-turbo-preview',
            messages: messages,
            max_tokens: 2000,
            temperature: 0.7,
            stream: true
        })
    });

    if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
    }

    return response;
}

// Stream OpenAI response (shared with space.js)
async function* streamOpenAIResponse(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullResponse = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') {
                        return;
                    }
                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices?.[0]?.delta?.content;
                        if (content) {
                            fullResponse += content;
                            yield fullResponse;
                        }
                    } catch (e) {
                        // Ignore parsing errors
                    }
                }
            }
        }
    } finally {
        reader.releaseLock();
    }
}

// Set up event listeners
function setupEventListeners() {
    // Title bar controls
    document.getElementById('minimize-btn')?.addEventListener('click', () => {
        window.veraAPI.windowMinimize();
    });

    document.getElementById('maximize-btn')?.addEventListener('click', () => {
        window.veraAPI.windowMaximize();
    });

    document.getElementById('close-btn')?.addEventListener('click', () => {
        window.veraAPI.windowClose();
    });

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            switchView(view);
        });
    });

    // Quick actions
    document.getElementById('create-space-action')?.addEventListener('click', () => {
        showModal('create-space-modal');
    });

    document.getElementById('browse-apps-action')?.addEventListener('click', () => {
        switchView('apps');
    });

    // Create pod button
    document.getElementById('create-space-btn')?.addEventListener('click', () => {
        showModal('create-space-modal');
    });

    // App search and filter
    document.getElementById('apps-search')?.addEventListener('input', (e) => {
        filterApps(e.target.value);
    });

    document.getElementById('category-filter')?.addEventListener('change', (e) => {
        filterAppsByCategory(e.target.value);
    });

    // Settings
    document.getElementById('dark-theme-checkbox')?.addEventListener('change', (e) => {
        toggleTheme(e.target.checked);
    });

    document.getElementById('global-adblock-checkbox')?.addEventListener('change', (e) => {
        updateGlobalAdBlock(e.target.checked);
    });

    document.getElementById('sync-enabled-checkbox')?.addEventListener('change', (e) => {
        updateSyncEnabled(e.target.checked);
    });

    // Vera AI settings
    document.getElementById('vera-ai-enabled-checkbox')?.addEventListener('change', (e) => {
        updateVeraAIEnabled(e.target.checked);
    });

    document.getElementById('vera-ai-api-key')?.addEventListener('input', (e) => {
        // Optional: Add validation or real-time feedback
    });

    document.getElementById('vera-ai-model')?.addEventListener('change', (e) => {
        // Optional: Add model change handling
    });

    // Save settings button
    document.getElementById('save-settings-btn')?.addEventListener('click', () => {
        saveAllSettings();
    });

    // ICON UPLOAD LOGIC FOR SPACES
    const spaceIconUpload = document.getElementById('space-icon-upload');
    if (spaceIconUpload) spaceIconUpload.addEventListener('change', handleSpaceIconUpload);
    const editSpaceIconUpload = document.getElementById('edit-space-icon-upload');
    if (editSpaceIconUpload) editSpaceIconUpload.addEventListener('change', handleEditSpaceIconUpload);

    // GENERIC ICON SELECTION LOGIC
    setupGenericIconSelection({
        iconRowId: 'space-generic-icons',
        iconInputId: 'space-icon-input',
        previewId: 'space-icon-preview',
        uploadId: 'space-icon-upload'
    });
    setupGenericIconSelection({
        iconRowId: 'edit-space-generic-icons',
        iconInputId: 'edit-space-icon-input',
        previewId: 'edit-space-icon-preview',
        uploadId: 'edit-space-icon-upload'
    });
}

// Switch between views
function switchView(viewName) {
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-view="${viewName}"]`)?.classList.add('active');

    // Update content
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    document.getElementById(`${viewName}-view`)?.classList.add('active');

    currentView = viewName;

    // Load view-specific data
    switch (viewName) {
        case 'home':
            renderHomeView();
            break;
        case 'apps':
            renderAppsView();
            break;
        case 'spaces':
            renderSpacesView();
            break;
        case 'installed':
            renderInstalledAppsView();
            break;
        case 'settings':
            loadSettings();
            break;
    }
}

// Load spaces from main process
async function loadSpaces() {
    try {
        spaces = await window.veraAPI.getSpaces();
        console.log('Loaded spaces:', spaces);
    } catch (error) {
        console.error('Error loading spaces:', error);
        spaces = [];
    }
}

// Load app catalog
async function loadAppCatalog() {
    try {
        appCatalog = await window.veraAPI.getAppCatalog();
        console.log('Loaded app catalog:', appCatalog);
    } catch (error) {
        console.error('Error loading app catalog:', error);
        appCatalog = [];
    }
}

// Render home view
function renderHomeView() {
    const recentSpacesGrid = document.getElementById('home-spaces-grid');
    if (!recentSpacesGrid) return;

    if (spaces.length === 0) {
        recentSpacesGrid.innerHTML = `
            <div class="empty-state">
                <p>No pods created yet. Create your first pod to get started!</p>
            </div>
        `;
        return;
    }

    // Show all recent spaces (no limit)
    const recentSpaces = spaces.slice().reverse();
    recentSpacesGrid.innerHTML = recentSpaces.map(space => `
        <div class="space-card large" onclick="openSpace('${space.id}')">
            <div class="space-card-header">
                <div class="space-card-menu">
                    <button class="icon-button" onclick="event.stopPropagation(); showSpaceMenu('${space.id}')" title="More Options">
                        <svg width="16" height="16" viewBox="0 0 16 16">
                            <circle cx="8" cy="3" r="1.5" fill="currentColor"/>
                            <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
                            <circle cx="8" cy="13" r="1.5" fill="currentColor"/>
                        </svg>
                    </button>
                </div>
                <div class="space-card-icon"></div>
                <div class="space-card-info">
                    <h4>${space.name}</h4>
                    <p>${space.subspaces?.length || 0} Apps</p>
                </div>
                <div class="space-card-actions"></div>
            </div>
            <div class="space-card-stats">
                <div class="stat">
                    <span class="stat-value">${space.subspaces?.length || 0}</span>
                    <span class="stat-label">Apps</span>
                </div>
                <div class="stat">
                    <span class="stat-value">${space.settings?.adBlockEnabled ? 'On' : 'Off'}</span>
                    <span class="stat-label">Ad Block</span>
                </div>
            </div>
        </div>
    `).join('');
    // Set icon HTML after rendering
    recentSpaces.forEach((space, i) => {
        const iconDiv = recentSpacesGrid.querySelectorAll('.space-card-icon')[i];
        if (iconDiv) {
            if (space.icon && space.icon.startsWith('<img')) {
                iconDiv.innerHTML = space.icon;
                iconDiv.style.backgroundColor = 'transparent';
            } else {
                iconDiv.textContent = space.name.charAt(0).toUpperCase();
                iconDiv.style.backgroundColor = space.color;
            }
        }
    });
}

// Render apps view
function renderAppsView() {
    const appsGrid = document.getElementById('apps-grid');
    if (!appsGrid) return;

    // Populate category dropdown with all unique categories
    const categoryFilter = document.getElementById('category-filter');
    if (categoryFilter) {
        const categories = Array.from(new Set(appCatalog.map(app => app.category).filter(Boolean)));
        categoryFilter.innerHTML = '<option value="">All Categories</option>' +
            categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    }

    appsGrid.innerHTML = appCatalog.map(app => `
        <div class="app-card" onclick="showAddToSpaceModal('${app.id}')">
            <div class="app-icon">${app.icon}</div>
            <div class="app-info">
                <h4>${app.name}</h4>
                <p>${app.url}</p>
                <span class="app-category">${app.category}</span>
            </div>
            <button class="primary-button" onclick="event.stopPropagation(); showAddToSpaceModal('${app.id}')">Add to Pod</button>
        </div>
    `).join('');
}

// Render spaces view
function renderSpacesView() {
    const spacesGrid = document.getElementById('spaces-grid');
    if (!spacesGrid) return;

    if (spaces.length === 0) {
        spacesGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🚀</div>
                <h3>No pods yet</h3>
                <p>Create your first pod to organize your web applications</p>
                <button class="primary-button" onclick="showModal('create-space-modal')">Create Pod</button>
            </div>
        `;
        return;
    }

    spacesGrid.innerHTML = spaces.map(space => `
        <div class="space-card large" onclick="openSpace('${space.id}')">
            <div class="space-card-header">
                <div class="space-card-menu">
                    <button class="icon-button" onclick="event.stopPropagation(); showSpaceMenu('${space.id}')" title="More Options">
                        <svg width="16" height="16" viewBox="0 0 16 16">
                            <circle cx="8" cy="3" r="1.5" fill="currentColor"/>
                            <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
                            <circle cx="8" cy="13" r="1.5" fill="currentColor"/>
                        </svg>
                    </button>
                </div>
                <div class="space-card-icon"></div>
                <div class="space-card-info">
                    <h4>${space.name}</h4>
                    <p>${space.subspaces?.length || 0} Apps</p>
                </div>
                <div class="space-card-actions"></div>
            </div>
            <div class="space-card-stats">
                <div class="stat">
                    <span class="stat-value">${space.subspaces?.length || 0}</span>
                    <span class="stat-label">Apps</span>
                </div>
                <div class="stat">
                    <span class="stat-value">${space.settings?.adBlockEnabled ? 'On' : 'Off'}</span>
                    <span class="stat-label">Ad Block</span>
                </div>
            </div>
        </div>
    `).join('');
    // Set icon HTML after rendering
    spaces.forEach((space, i) => {
        const iconDiv = spacesGrid.querySelectorAll('.space-card-icon')[i];
        if (iconDiv) {
            if (space.icon && space.icon.startsWith('<img')) {
                iconDiv.innerHTML = space.icon;
                iconDiv.style.backgroundColor = 'transparent';
            } else {
                iconDiv.textContent = space.name.charAt(0).toUpperCase();
                iconDiv.style.backgroundColor = space.color;
            }
        }
    });
}

// Render installed apps view
function renderInstalledAppsView() {
    const installedGrid = document.getElementById('installed-apps-grid');
    if (!installedGrid) return;

    // Collect all subspaces (apps) from all spaces
    const appMap = new Map(); // key: app name or id, value: { app, pods: [spaceName] }
    spaces.forEach(space => {
        (space.subspaces || []).forEach(subspace => {
            const key = subspace.name + (subspace.url || ''); // Use name+url as unique key
            if (!appMap.has(key)) {
                appMap.set(key, { app: subspace, pods: [space.name] });
            } else {
                appMap.get(key).pods.push(space.name);
            }
        });
    });

    if (appMap.size === 0) {
        installedGrid.innerHTML = `<div class="empty-state"><p>No apps have been installed in any pod yet.</p></div>`;
        return;
    }

    installedGrid.innerHTML = Array.from(appMap.values()).map(({ app, pods }) => `
        <div class="app-card installed">
            <div class="app-icon">${app.icon || app.name.charAt(0)}</div>
            <div class="app-info">
                <h4>${app.name}</h4>
                <p>${app.url || ''}</p>
                <div class="app-pods">Installed in: ${pods.map(p => `<span class='pod-badge'>${p}</span>`).join(', ')}</div>
            </div>
        </div>
    `).join('');
}

// Filter apps by search term
function filterApps(searchTerm) {
    const appsGrid = document.getElementById('apps-grid');
    if (!appsGrid) return;

    const filteredApps = appCatalog.filter(app =>
        app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.url.toLowerCase().includes(searchTerm.toLowerCase())
    );

    appsGrid.innerHTML = filteredApps.map(app => `
        <div class="app-card" onclick="showAddToSpaceModal('${app.id}')">
            <div class="app-icon">${app.icon}</div>
            <div class="app-info">
                <h4>${app.name}</h4>
                <p>${app.url}</p>
                <span class="app-category">${app.category}</span>
            </div>
            <button class="primary-button" onclick="event.stopPropagation(); showAddToSpaceModal('${app.id}')">Add to Pod</button>
        </div>
    `).join('');
}

// Filter apps by category
function filterAppsByCategory(category) {
    const appsGrid = document.getElementById('apps-grid');
    if (!appsGrid) return;

    const filteredApps = category ?
        appCatalog.filter(app => app.category === category) :
        appCatalog;

    appsGrid.innerHTML = filteredApps.map(app => `
        <div class="app-card" onclick="showAddToSpaceModal('${app.id}')">
            <div class="app-icon">${app.icon}</div>
            <div class="app-info">
                <h4>${app.name}</h4>
                <p>${app.url}</p>
                <span class="app-category">${app.category}</span>
            </div>
            <button class="primary-button" onclick="event.stopPropagation(); showAddToSpaceModal('${app.id}')">Add to Pod</button>
        </div>
    `).join('');
}

// Open a space
async function openSpace(spaceId) {
    console.log('[openSpace] Called with spaceId:', spaceId, 'spaces:', spaces);
    try {
        await window.veraAPI.openSpace(spaceId);
    } catch (error) {
        console.error('Error opening space:', error);
    }
}

// Create a new space
async function createSpace() {
    const nameInput = document.getElementById('space-name-input');
    const colorInput = document.getElementById('space-color-input');
    const adBlockInput = document.getElementById('space-adblock-input');
    const iconInput = document.getElementById('space-icon-input');
    if (!nameInput?.value.trim()) {
        alert('Please enter a pod name');
        return;
    }
    try {
        console.log('Icon input value on create:', iconInput?.value); // DEBUG LOG
        const spaceConfig = {
            name: nameInput.value.trim(),
            color: colorInput?.value || '#4a90e2',
            icon: iconInput?.value.trim() || '',
            settings: {
                adBlockEnabled: adBlockInput?.checked || false
            }
        };
        const newSpace = await window.veraAPI.createSpace(spaceConfig);
        spaces.push(newSpace);
        updateSpacesCount();
        renderHomeView();
        renderSpacesView();
        closeModal('create-space-modal');
        document.getElementById('create-space-form')?.reset();
        clearSpaceIconPreview();
        console.log('Pod created:', newSpace);
    } catch (error) {
        console.error('Error creating pod:', error);
        alert('Failed to create pod');
    }
}

// Update spaces count
function updateSpacesCount() {
    const spacesCount = document.getElementById('spaces-count');
    if (spacesCount) {
        spacesCount.textContent = `${spaces.length} / ∞`;
    }
}

// Update apps count (total subspaces across all spaces)
function updateAppsCount() {
    const appsCount = document.getElementById('apps-count');
    if (appsCount) {
        const totalSubspaces = spaces.reduce((total, space) =>
            total + (space.subspaces?.length || 0), 0);
        appsCount.textContent = `${totalSubspaces} / ∞`;
    }
}

// Load settings
async function loadSettings() {
    try {
        const settings = await window.veraAPI.getSettings();

        // Update UI elements
        const darkThemeCheckbox = document.getElementById('dark-theme-checkbox');
        if (darkThemeCheckbox) {
            darkThemeCheckbox.checked = settings.theme === 'dark';
        }

        const syncEnabledCheckbox = document.getElementById('sync-enabled-checkbox');
        if (syncEnabledCheckbox) {
            syncEnabledCheckbox.checked = settings.syncEnabled || false;
        }

        const globalAdBlockCheckbox = document.getElementById('global-adblock-checkbox');
        if (globalAdBlockCheckbox) {
            globalAdBlockCheckbox.checked = settings.adBlockEnabled || false;
        }

        // Vera AI settings
        const veraAIEnabledCheckbox = document.getElementById('vera-ai-enabled-checkbox');
        if (veraAIEnabledCheckbox) {
            veraAIEnabledCheckbox.checked = settings.veraAI?.enabled || false;
        }

        const veraAIApiKey = document.getElementById('vera-ai-api-key');
        if (veraAIApiKey) {
            veraAIApiKey.value = settings.veraAI?.apiKey || '';
        }

        const veraAIModel = document.getElementById('vera-ai-model');
        if (veraAIModel) {
            veraAIModel.value = settings.veraAI?.model || 'gpt-4-turbo-preview';
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// Toggle theme
async function toggleTheme(isDark) {
    try {
        await window.veraAPI.updateSettings({ theme: isDark ? 'dark' : 'light' });
        document.body.classList.toggle('dark-theme', isDark);
    } catch (error) {
        console.error('Error updating theme:', error);
    }
}

// Update global ad block setting
async function updateGlobalAdBlock(enabled) {
    try {
        await window.veraAPI.updateSettings({ adBlockEnabled: enabled });
        console.log('Global ad block updated:', enabled);
    } catch (error) {
        console.error('Error updating global ad block:', error);
    }
}

// Update sync enabled setting
async function updateSyncEnabled(enabled) {
    try {
        await window.veraAPI.updateSettings({ syncEnabled: enabled });
        console.log('Sync enabled updated:', enabled);
    } catch (error) {
        console.error('Error updating sync enabled:', error);
    }
}

// Update Vera AI enabled setting
async function updateVeraAIEnabled(enabled) {
    try {
        // Get current settings to preserve API key and model
        const settings = await window.veraAPI.getSettings();
        await window.veraAPI.updateSettings({
            veraAI: {
                ...settings.veraAI,
                enabled: enabled
            }
        });
        console.log('Vera AI enabled updated:', enabled);
    } catch (error) {
        console.error('Error updating Vera AI enabled:', error);
    }
}

// Save all settings
async function saveAllSettings() {
    try {
        const darkThemeCheckbox = document.getElementById('dark-theme-checkbox');
        const syncEnabledCheckbox = document.getElementById('sync-enabled-checkbox');
        const globalAdBlockCheckbox = document.getElementById('global-adblock-checkbox');
        const veraAIEnabledCheckbox = document.getElementById('vera-ai-enabled-checkbox');
        const veraAIApiKey = document.getElementById('vera-ai-api-key');
        const veraAIModel = document.getElementById('vera-ai-model');

        const settings = {
            theme: darkThemeCheckbox?.checked ? 'dark' : 'light',
            syncEnabled: syncEnabledCheckbox?.checked || false,
            adBlockEnabled: globalAdBlockCheckbox?.checked || false,
            veraAI: {
                enabled: veraAIEnabledCheckbox?.checked || false,
                apiKey: veraAIApiKey?.value || '',
                model: veraAIModel?.value || 'gpt-4-turbo-preview'
            }
        };

        await window.veraAPI.updateSettings(settings);

        // Apply theme immediately
        document.body.classList.toggle('dark-theme', settings.theme === 'dark');

        // Show success message
        showNotification('Settings saved successfully!', 'success');

        console.log('All settings saved:', settings);
    } catch (error) {
        console.error('Error saving settings:', error);
        showNotification('Failed to save settings', 'error');
    }
}

// Show notification
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    // Add to page
    document.body.appendChild(notification);

    // Show notification
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);

    // Hide and remove notification
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Show modal
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        // Auto-focus the Pod Name input when opening the Create Pod modal
        if (modalId === 'create-space-modal') {
            let attempts = 0;
            const maxAttempts = 10;
            function tryFocus() {
                const nameInput = document.getElementById('space-name-input');
                if (nameInput && document.activeElement !== nameInput) {
                    nameInput.focus();
                    if (document.activeElement === nameInput) return;
                }
                if (++attempts < maxAttempts) {
                    setTimeout(tryFocus, 50);
                }
            }
            tryFocus();
        }
    }
}

// Close modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// Show space menu (context menu)
function showSpaceMenu(spaceId) {
    const space = spaces.find(s => s.id === spaceId);
    if (!space) return;

    // Create a simple dropdown menu
    const existingMenu = document.querySelector('.space-context-menu');
    if (existingMenu) existingMenu.remove();

    const menu = document.createElement('div');
    menu.className = 'space-context-menu';
    menu.innerHTML = `
        <button class="menu-item" data-action="edit">
            <svg width="16" height="16" viewBox="0 0 16 16">
                <path d="M2 10 L10 2 L14 6 L6 14 L2 14 Z" stroke="currentColor" fill="none"/>
            </svg>
            Edit Pod
        </button>
        <button class="menu-item" data-action="duplicate">
            <svg width="16" height="16" viewBox="0 0 16 16">
                <rect x="2" y="2" width="10" height="10" stroke="currentColor" fill="none"/>
                <rect x="5" y="5" width="10" height="10" stroke="currentColor" fill="none"/>
            </svg>
            Duplicate
        </button>
        <hr class="menu-divider">
        <button class="menu-item danger" data-action="delete">
            <svg width="16" height="16" viewBox="0 0 16 16">
                <path d="M2 4 L14 4 M5 4 V2 H11 V4 M6 7 V12 M10 7 V12 M4 4 L4 14 H12 V4" 
                      stroke="currentColor" fill="none"/>
            </svg>
            Delete Pod
        </button>
    `;

    // Position the menu near the button
    const button = event.target.closest('button');
    const rect = button.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = rect.bottom + 'px';
    menu.style.left = rect.left + 'px';

    document.body.appendChild(menu);

    // Add click handlers to close menu and run action
    menu.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            menu.remove();
            const action = item.getAttribute('data-action');
            if (action === 'edit') editSpace(spaceId);
            else if (action === 'duplicate') duplicateSpace(spaceId);
            else if (action === 'delete') deleteSpace(spaceId);
        });
    });

    // Close menu when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 0);
}

// Show add to pod modal
function showAddToSpaceModal(appId) {
    addAppToPodSelectedAppId = appId;
    addAppToPodSelectedSpaceId = null;
    const modal = document.getElementById('add-app-to-pod-modal');
    const podList = document.getElementById('add-app-pod-list');
    if (!modal || !podList) return;
    // Render all pods
    podList.innerHTML = spaces.map(space => `
        <div class="pod-list-card" tabindex="0" onclick="showAddAppConfirmModal('${space.id}')">
            <div class="pod-list-icon">${space.icon && space.icon.startsWith('<img') ? space.icon : space.name.charAt(0).toUpperCase()}</div>
            <div class="pod-list-name">${space.name}</div>
        </div>
    `).join('');
    showModal('add-app-to-pod-modal');
}

// Edit space
async function editSpace(spaceId) {
    const space = spaces.find(s => s.id === spaceId);
    if (!space) return;

    // Populate edit form with current values
    document.getElementById('edit-space-name-input').value = space.name;
    document.getElementById('edit-space-color-input').value = space.color;
    document.getElementById('edit-space-adblock-input').checked = space.settings?.adBlockEnabled || false;
    document.getElementById('edit-space-icon-input').value = space.icon ? `<img src=\"${space.icon}\" alt=\"Space Icon\" class=\"space-icon\">` : '';

    // Store spaceId for update
    document.getElementById('edit-space-form').dataset.spaceId = spaceId;

    showModal('edit-space-modal');
}

// Update space
async function updateSpace() {
    const form = document.getElementById('edit-space-form');
    const spaceId = form.dataset.spaceId;
    const nameInput = document.getElementById('edit-space-name-input');
    const colorInput = document.getElementById('edit-space-color-input');
    const adBlockInput = document.getElementById('edit-space-adblock-input');
    const iconInput = document.getElementById('edit-space-icon-input');
    if (!nameInput?.value.trim()) {
        alert('Please enter a pod name');
        return;
    }
    try {
        const updates = {
            name: nameInput.value.trim(),
            color: colorInput.value,
            icon: iconInput?.value.trim() || '',
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
        renderSpacesView();
        closeModal('edit-space-modal');
        clearEditSpaceIconPreview();
        showNotification('Space updated successfully!', 'success');
    } catch (error) {
        console.error('Error updating pod:', error);
        alert('Failed to update pod');
    }
}

// Duplicate space
async function duplicateSpace(spaceId) {
    const space = spaces.find(s => s.id === spaceId);
    if (!space) return;

    try {
        const duplicateConfig = {
            name: `${space.name} (Copy)`,
            color: space.color,
            settings: { ...space.settings }
        };

        const newSpace = await window.veraAPI.createSpace(duplicateConfig);
        spaces.push(newSpace);

        // Update UI
        updateSpacesCount();
        renderHomeView();
        renderSpacesView();

        showNotification('Pod duplicated successfully!', 'success');
    } catch (error) {
        console.error('Error duplicating pod:', error);
        alert('Failed to duplicate pod');
    }
}

// Delete space
async function deleteSpace(spaceId) {
    const space = spaces.find(s => s.id === spaceId);
    if (!space) return;

    if (!confirm(`Are you sure you want to delete "${space.name}"? This action cannot be undone.`)) {
        return;
    }

    try {
        await window.veraAPI.deleteSpace(spaceId);

        // Remove from local array
        spaces = spaces.filter(s => s.id !== spaceId);

        // Update UI
        updateSpacesCount();
        updateAppsCount();
        renderHomeView();
        renderSpacesView();

        showNotification('Pod deleted successfully!', 'success');
    } catch (error) {
        console.error('Error deleting pod:', error);
        alert('Failed to delete pod');
    }
}

// Global functions for HTML onclick handlers
window.createSpace = createSpace;
window.openSpace = openSpace;
window.closeModal = closeModal;
window.showModal = showModal;
window.showSpaceMenu = showSpaceMenu;
window.editSpace = editSpace;
window.updateSpace = updateSpace;
window.duplicateSpace = duplicateSpace;
window.deleteSpace = deleteSpace;

// ICON UPLOAD LOGIC FOR SPACES
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
            document.getElementById('space-icon-input').value = `<img src=\"${iconPath}\" alt=\"Space Icon\" class=\"space-icon\">`;
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
            document.getElementById('edit-space-icon-input').value = `<img src=\"${iconPath}\" alt=\"Space Icon\" class=\"space-icon\">`;
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
window.clearSpaceIconPreview = clearSpaceIconPreview;
window.clearEditSpaceIconPreview = clearEditSpaceIconPreview;

// On initial load, apply dark theme if needed
async function applyInitialTheme() {
    try {
        const settings = await window.veraAPI.getSettings();
        if (settings.theme === 'dark') {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
        }
    } catch (error) {
        console.error('Error applying initial theme:', error);
    }
}

// Call on load
applyInitialTheme();

// GENERIC ICON SELECTION LOGIC
function setupGenericIconSelection({
    iconRowId,
    iconInputId,
    previewId,
    uploadId
}) {
    const iconRow = document.getElementById(iconRowId);
    const iconInput = document.getElementById(iconInputId);
    if (!iconRow || !iconInput) return;
    const iconButtons = iconRow.querySelectorAll('.generic-icon-btn');
    iconButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            // Remove highlight from all
            iconButtons.forEach(b => b.classList.remove('selected'));
            // Highlight this one
            btn.classList.add('selected');
            // Set input value to IMG HTML
            const img = btn.querySelector('img');
            iconInput.value = `<img src=\"${img.getAttribute('src')}\" alt=\"${img.getAttribute('alt')}\" class=\"app-icon\">`;
            // Clear preview and file input
            if (previewId) {
                const preview = document.getElementById(previewId);
                if (preview) preview.style.display = 'none';
            }
            if (uploadId) {
                const upload = document.getElementById(uploadId);
                if (upload) upload.value = '';
            }
        });
    });
    // Deselect icons if user types or uploads
    iconInput.addEventListener('input', function () {
        iconButtons.forEach(b => b.classList.remove('selected'));
    });
    if (uploadId) {
        const upload = document.getElementById(uploadId);
        if (upload) {
            upload.addEventListener('change', function () {
                iconButtons.forEach(b => b.classList.remove('selected'));
            });
        }
    }
}

document.addEventListener('DOMContentLoaded', function () {
    setupGenericIconSelection({
        iconRowId: 'space-generic-icons',
        iconInputId: 'space-icon-input',
        previewId: 'space-icon-preview',
        uploadId: 'space-icon-upload'
    });
    setupGenericIconSelection({
        iconRowId: 'edit-space-generic-icons',
        iconInputId: 'edit-space-icon-input',
        previewId: 'edit-space-icon-preview',
        uploadId: 'edit-space-icon-upload'
    });
});

function showAddAppConfirmModal(spaceId) {
    addAppToPodSelectedSpaceId = spaceId;
    closeModal('add-app-to-pod-modal');
    const app = appCatalog.find(a => a.id === addAppToPodSelectedAppId);
    const space = spaces.find(s => s.id === spaceId);
    const confirmText = document.getElementById('add-app-confirm-text');
    if (confirmText && app && space) {
        confirmText.innerHTML = `Add <b>${app.name}</b> to <b>${space.name}</b>?`;
    }
    showModal('add-app-confirm-modal');
}

document.getElementById('add-app-confirm-btn').onclick = async function () {
    if (!addAppToPodSelectedAppId || !addAppToPodSelectedSpaceId) return;
    await addAppToPod(addAppToPodSelectedSpaceId);
    closeModal('add-app-confirm-modal');
};

async function addAppToPod(spaceId) {
    const app = appCatalog.find(a => a.id === addAppToPodSelectedAppId);
    if (!app) {
        showNotification('App not found in catalog', 'error');
        return;
    }
    try {
        await window.veraAPI.createSubspace(spaceId, {
            name: app.name,
            url: app.url,
            icon: app.icon
        });
        showNotification(`Added ${app.name} to ${spaces.find(s => s.id === spaceId)?.name || 'Pod'}!`, 'success');
        // Optionally refresh spaces/subspaces here
    } catch (error) {
        showNotification('Failed to add app to pod', 'error');
        console.error('Error adding app to pod:', error);
    }
}
window.addAppToPod = addAppToPod;

window.refreshCurrentView = async function refreshCurrentView() {
    console.log('[refreshCurrentView] Clicked. Current view:', currentView);
    switch (currentView) {
        case 'home':
            await loadSpaces();
            renderHomeView();
            break;
        case 'apps':
            await loadAppCatalog();
            renderAppsView();
            break;
        case 'spaces':
            await loadSpaces();
            renderSpacesView();
            break;
        case 'installed':
            await loadSpaces();
            renderInstalledAppsView();
            break;
    }
}; 