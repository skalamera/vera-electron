// Space window JavaScript
let currentSpace = null;
let subspaces = [];
let activeSubspace = null;
let appCatalog = [];
let webviewsMap = new Map(); // Store webviews by subspace ID
let veraAIEnabled = false;
let veraAISettings = null;
let veraAIInitialized = false;
window.veraWidgetCreated = false;

// Define quick actions for different chatbot types
const CHATBOT_QUICK_ACTIONS = {
    'generic': [],
    'job_search': [
        { label: 'Generate Cover Letter', message: 'Generate a cover letter for the job posting on this page using my personal data.' },
        { label: 'Evaluate Job Fit', message: 'Evaluate my experience against the requirements of this job posting using my personal data and provide a summary.' },
        { label: 'Suggest Interview Questions', message: 'Suggest common interview questions for this role.' }
    ]
};

// Initialize the space window
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Space window DOM loaded');

    // Set up event listeners
    setupEventListeners();

    // Load app catalog
    await loadAppCatalog();

    // Fetch Vera AI settings and set veraAIEnabled
    veraAISettings = await window.veraAPI.getVeraAISettings();
    veraAIEnabled = veraAISettings.enabled && veraAISettings.apiKey;

    // Load and apply theme settings
    await applyInitialTheme();

    // Initialize Vera AI
    await initializeVeraAI();

    // Navigation bar buttons
    const navBar = document.getElementById('webview-nav-bar');
    const navBackBtn = document.getElementById('nav-back-btn');
    const navForwardBtn = document.getElementById('nav-forward-btn');
    const navRefreshBtn = document.getElementById('nav-refresh-btn');
    const navHomeBtn = document.getElementById('nav-home-btn');
    const navWelcomeBtn = document.getElementById('nav-welcome-btn');
    const sidebar = document.querySelector('.space-sidebar');
    const collapseSidebarBtn = document.getElementById('collapse-sidebar-btn');

    // Navigation button handlers
    navBackBtn?.addEventListener('click', () => {
        const webview = getActiveWebview();
        if (webview && webview.canGoBack()) webview.goBack();
    });
    navForwardBtn?.addEventListener('click', () => {
        const webview = getActiveWebview();
        if (webview && webview.canGoForward()) webview.goForward();
    });
    navRefreshBtn?.addEventListener('click', () => {
        const webview = getActiveWebview();
        if (webview) webview.reload();
    });
    navHomeBtn?.addEventListener('click', () => {
        if (activeSubspace) {
            const webview = getActiveWebview();
            if (webview) webview.loadURL(activeSubspace.url);
        }
    });
    navWelcomeBtn?.addEventListener('click', () => {
        showWelcomeScreen();
    });
    collapseSidebarBtn?.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        const iconSpan = document.getElementById('collapse-sidebar-icon');
        if (sidebar.classList.contains('collapsed')) {
            // Show expand (right chevron)
            iconSpan.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20"><path d="M6 5 L11 10 L6 15" stroke="currentColor" stroke-width="2" fill="none"/></svg>';
            collapseSidebarBtn.title = 'Expand Sidebar';
        } else {
            // Show collapse (left chevron)
            iconSpan.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20"><path d="M14 5 L9 10 L14 15" stroke="currentColor" stroke-width="2" fill="none"/></svg>';
            collapseSidebarBtn.title = 'Collapse Sidebar';
        }
    });

    // Helper to get the currently visible webview
    function getActiveWebview() {
        const webviewContainer = document.getElementById('webview-container');
        if (!webviewContainer) return null;
        return webviewContainer.querySelector('webview[style*="display: flex"]') || webviewContainer.querySelector('webview');
    }

    // Show/hide nav bar depending on webview visibility
    function updateNavBarVisibility() {
        const webviewContainer = document.getElementById('webview-container');
        if (webviewContainer && webviewContainer.style.display !== 'none') {
            navBar.style.display = 'flex';
        } else {
            navBar.style.display = 'none';
        }
    }

    // Patch show/hide welcome screen to update nav bar
    const origShowWelcomeScreen = window.showWelcomeScreen || showWelcomeScreen;
    window.showWelcomeScreen = function () {
        origShowWelcomeScreen();
        updateNavBarVisibility();
    };
    const origHideWelcomeScreen = window.hideWelcomeScreen || hideWelcomeScreen;
    window.hideWelcomeScreen = function () {
        origHideWelcomeScreen();
        updateNavBarVisibility();
    };

    // Initial nav bar state
    updateNavBarVisibility();

    // On load, ensure correct icon/tooltip
    if (sidebar.classList.contains('collapsed')) {
        document.getElementById('collapse-sidebar-icon').innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20"><path d="M6 5 L11 10 L6 15" stroke="currentColor" stroke-width="2" fill="none"/></svg>';
        collapseSidebarBtn.title = 'Expand Sidebar';
    } else {
        document.getElementById('collapse-sidebar-icon').innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20"><path d="M14 5 L9 10 L14 15" stroke="currentColor" stroke-width="2" fill="none"/></svg>';
        collapseSidebarBtn.title = 'Collapse Sidebar';
    }

    console.log('Space window initialized');
});

// Listen for space data from main process
if (window.veraAPI) {
    window.veraAPI.onSpaceData((space) => {
        initializeSpace(space);
    });

    // Listen for theme updates
    window.veraAPI.onThemeUpdate((theme) => {
        document.body.classList.toggle('dark-theme', theme === 'dark');
    });
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

    // Add subspace button
    document.getElementById('add-subspace-btn')?.addEventListener('click', () => {
        showModal('add-subspace-modal');
    });

    // Quick actions
    document.getElementById('quick-add-subspace')?.addEventListener('click', () => {
        showModal('add-subspace-modal');
    });

    document.getElementById('browse-catalog')?.addEventListener('click', () => {
        showModal('add-subspace-modal');
    });

    // App search
    document.getElementById('app-search')?.addEventListener('input', (e) => {
        filterCatalogApps(e.target.value);
    });

    // Pod settings button
    document.getElementById('space-settings-btn')?.addEventListener('click', () => {
        showSpaceSettings();
    });

    // Icon upload
    const iconUpload = document.getElementById('subspace-icon-upload');
    if (iconUpload) {
        iconUpload.addEventListener('change', handleIconUpload);
    }
}

// Initialize space with data
async function initializeSpace(space) {
    console.log('Initializing space:', space);
    currentSpace = space;

    // Update UI with space info
    updateSpaceInfo();

    // Load subspaces
    await loadSubspaces();

    // Render subspaces
    renderSubspaces();

    // Show welcome screen if no subspaces
    if (subspaces.length === 0) {
        showWelcomeScreen();
    }

    // Render quick actions for the chatbot if it's initialized
    if (window.veraWidget) {
        console.log('[Vera Debug] Calling updateChatbotQuickActions from initializeSpace. currentSpace:', currentSpace, 'window.veraWidget:', !!window.veraWidget);
        updateChatbotQuickActions();
    }
}

// Update space info in UI
function updateSpaceInfo() {
    if (!currentSpace) return;

    // Update title
    const spaceTitle = document.getElementById('space-title');
    if (spaceTitle) {
        spaceTitle.textContent = `${currentSpace.name} - Vera Desktop`;
    }

    // Update space icon and name
    const spaceIcon = document.getElementById('space-icon');
    if (spaceIcon) {
        if (currentSpace.icon && currentSpace.icon.startsWith('<img')) {
            spaceIcon.innerHTML = currentSpace.icon;
            spaceIcon.style.backgroundColor = 'transparent';
        } else {
            spaceIcon.textContent = currentSpace.name.charAt(0).toUpperCase();
            spaceIcon.style.backgroundColor = currentSpace.color;
        }
    }

    const spaceName = document.getElementById('space-name');
    if (spaceName) {
        spaceName.textContent = currentSpace.name;
    }

    // Update welcome screen
    const welcomeSpaceName = document.getElementById('welcome-space-name');
    if (welcomeSpaceName) {
        welcomeSpaceName.textContent = currentSpace.name;
    }

    // Re-render quick actions if chatbot is initialized and type changed
    if (window.veraWidget) {
        console.log('[Vera Debug] Calling updateChatbotQuickActions from updateSpaceInfo. currentSpace:', currentSpace, 'window.veraWidget:', !!window.veraWidget);
        updateChatbotQuickActions();
    }
}

// Load subspaces for current space
async function loadSubspaces() {
    if (!currentSpace) return;

    try {
        subspaces = await window.veraAPI.getSubspaces(currentSpace.id);
        console.log('Loaded subspaces:', subspaces);
    } catch (error) {
        console.error('Error loading subspaces:', error);
        subspaces = [];
    }
}

// Load app catalog
async function loadAppCatalog() {
    try {
        appCatalog = await window.veraAPI.getAppCatalog();
        renderAppCatalog();
    } catch (error) {
        console.error('Error loading app catalog:', error);
        appCatalog = [];
    }
}

// Render subspaces in sidebar
function renderSubspaces() {
    const subspacesList = document.getElementById('subspaces-list');
    if (!subspacesList) return;

    // Also render in welcome screen grid
    renderWelcomeSubspaces();

    if (subspaces.length === 0) {
        subspacesList.innerHTML = `
            <div class="empty-subspaces">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" class="empty-icon">
                    <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="2" opacity="0.3"/>
                    <path d="M24 16 L24 32 M16 24 L32 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
                </svg>
                <p>No subspaces yet</p>
                <button class="secondary-button" onclick="showModal('add-subspace-modal')">
                    <svg width="16" height="16" viewBox="0 0 16 16">
                        <path d="M8 3 L8 13 M3 8 L13 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    Add an App
                </button>
            </div>
        `;
        return;
    }

    subspacesList.innerHTML = subspaces.map((subspace, index) => {
        const isActive = activeSubspace?.id === subspace.id;
        const bgColor = isActive ? '#4a90e2' : 'transparent';
        const textColor = isActive ? 'white' : 'inherit';

        return `
        <div class="subspace-item ${isActive ? 'active' : ''}" 
             id="subspace-${subspace.id}"
             data-subspace-id="${subspace.id}"
             data-index="${index}"
             draggable="true"
             onclick="openSubspace('${subspace.id}')"
             onmouseover="if(!this.classList.contains('active')){ this.style.backgroundColor='rgba(0,0,0,0.05)'; this.style.transform='translateX(2px)'; } this.querySelector('.subspace-actions').style.opacity='1';"
             onmouseout="if(!this.classList.contains('active')){ this.style.backgroundColor='transparent'; this.style.transform='translateX(0)'; } this.querySelector('.subspace-actions').style.opacity='0';"
             style="display: flex; align-items: center; gap: 12px; width: calc(100% - 16px); min-height: 54px; padding: 12px 14px; margin: 4px 8px; border-radius: 10px; cursor: pointer; position: relative; transition: all 0.2s ease; background-color: ${bgColor}; color: ${textColor};">
            <div class="subspace-icon" style="flex-shrink: 0; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: ${isActive ? 'rgba(255,255,255,0.2)' : '#e8e8e8'}; border-radius: 8px; font-size: 18px;">${subspace.icon || '🌐'}</div>
            <div class="subspace-info" style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center;">
                <div class="subspace-name" style="font-size: 16px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.4;">${subspace.name}</div>
                <div class="subspace-url" style="font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: ${isActive ? 'rgba(255,255,255,0.9)' : '#666666'}; line-height: 1.3;">${new URL(subspace.url).hostname}</div>
            </div>
            <div class="subspace-actions" style="margin-left: auto; flex-shrink: 0; display: flex; opacity: 0; transition: opacity 0.2s ease;">
                <button class="subspace-action" onclick="event.stopPropagation(); removeSubspace('${subspace.id}')" title="Remove" 
                        style="width: 32px; height: 32px; border: none; background: transparent; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s ease;"
                        onmouseover="this.style.backgroundColor='rgba(220,53,69,0.1)'; this.style.transform='scale(1.1)';"
                        onmouseout="this.style.backgroundColor='transparent'; this.style.transform='scale(1)';">
                    <svg viewBox="0 0 16 16" fill="none" style="width: 16px; height: 16px;">
                        <path d="M5 5 L11 11 M11 5 L5 11" stroke="${isActive ? 'white' : 'currentColor'}" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>
                    </svg>
                </button>
            </div>
        </div>
        `;
    }).join('');

    // Set up drag and drop
    setupDragAndDrop();
}

// Render subspaces in welcome screen grid
function renderWelcomeSubspaces() {
    const grid = document.getElementById('welcome-subspaces-grid');
    if (!grid) return;

    if (subspaces.length === 0) {
        grid.style.display = 'none';
        return;
    }

    grid.style.display = 'grid';
    grid.innerHTML = subspaces.map(subspace => `
        <div class="welcome-subspace-item" onclick="openSubspace('${subspace.id}')">
            <div class="welcome-subspace-icon">${subspace.icon || '🌐'}</div>
            <div class="welcome-subspace-name">${subspace.name}</div>
        </div>
    `).join('');
}

// Set up drag and drop functionality
function setupDragAndDrop() {
    const items = document.querySelectorAll('.subspace-item');
    let draggedElement = null;
    let draggedIndex = null;

    items.forEach(item => {
        item.addEventListener('dragstart', (e) => {
            draggedElement = item;
            draggedIndex = parseInt(item.dataset.index);
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            const afterElement = getDragAfterElement(document.getElementById('subspaces-list'), e.clientY);
            if (afterElement == null) {
                document.getElementById('subspaces-list').appendChild(draggedElement);
            } else {
                document.getElementById('subspaces-list').insertBefore(draggedElement, afterElement);
            }
        });

        item.addEventListener('drop', async (e) => {
            e.preventDefault();
            const dropIndex = parseInt(item.dataset.index);

            if (draggedIndex !== dropIndex) {
                // Reorder the subspaces array
                const [movedItem] = subspaces.splice(draggedIndex, 1);
                const newIndex = dropIndex > draggedIndex ? dropIndex - 1 : dropIndex;
                subspaces.splice(newIndex, 0, movedItem);

                // Save the new order
                await saveSubspacesOrder();

                // Re-render to update indices
                renderSubspaces();
            }
        });
    });
}

// Get the element after which the dragged element should be inserted
function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.subspace-item:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;

        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Save the reordered subspaces
async function saveSubspacesOrder() {
    if (!currentSpace) return;

    try {
        // Update the space with the new subspaces order
        await window.veraAPI.updateSpace(currentSpace.id, {
            subspaces: subspaces
        });
        console.log('Subspaces order saved');
    } catch (error) {
        console.error('Error saving subspaces order:', error);
    }
}

// Render app catalog in modal
function renderAppCatalog() {
    const appCatalogContainer = document.getElementById('app-catalog');
    if (!appCatalogContainer) return;

    appCatalogContainer.innerHTML = appCatalog.map(app => `
        <div class="catalog-app" onclick="addSubspaceFromCatalog('${app.id}')">
            <div class="catalog-app-icon">${app.icon}</div>
            <div class="catalog-app-info">
                <div class="catalog-app-name">${app.name}</div>
                <div class="catalog-app-url">${app.url}</div>
            </div>
        </div>
    `).join('');
}

// Filter catalog apps
function filterCatalogApps(searchTerm) {
    const appCatalogContainer = document.getElementById('app-catalog');
    if (!appCatalogContainer) return;

    const filteredApps = appCatalog.filter(app =>
        app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.url.toLowerCase().includes(searchTerm.toLowerCase())
    );

    appCatalogContainer.innerHTML = filteredApps.map(app => `
        <div class="catalog-app" onclick="addSubspaceFromCatalog('${app.id}')">
            <div class="catalog-app-icon">${app.icon}</div>
            <div class="catalog-app-info">
                <div class="catalog-app-name">${app.name}</div>
                <div class="catalog-app-url">${app.url}</div>
            </div>
        </div>
    `).join('');
}

// Open a subspace
function openSubspace(subspaceId) {
    const subspace = subspaces.find(s => s.id === subspaceId);
    if (!subspace) return;

    activeSubspace = subspace;

    // Update UI
    renderSubspaces();
    hideWelcomeScreen();

    // Show or create webview
    showOrCreateWebview(subspace);
}

// Show existing webview or create new one
function showOrCreateWebview(subspace) {
    const webviewContainer = document.getElementById('webview-container');
    if (!webviewContainer) return;

    // Hide all webviews
    webviewsMap.forEach((webview, id) => {
        if (id !== subspace.id) {
            webview.style.display = 'none';
        }
    });

    // Check if webview already exists
    let webview = webviewsMap.get(subspace.id);

    if (webview) {
        // Show existing webview
        webview.style.display = 'flex';
        webviewContainer.style.display = 'block';
        webview.focus();
        console.log('[space.js] Focused existing webview for subspace:', subspace.name);
    } else {
        // Create new webview
        webview = document.createElement('webview');
        webview.src = subspace.url;
        webview.partition = subspace.partition;
        webview.allowpopups = true;
        webview.webpreferences = 'contextIsolation=yes,nodeIntegration=no';
        webview.style.width = '100%';
        webview.style.height = '100%';
        webview.style.display = 'flex';

        // Set user agent if specified
        if (subspace.userAgent) {
            webview.useragent = subspace.userAgent;
        }

        // Add event listeners
        webview.addEventListener('dom-ready', () => {
            console.log('Webview DOM ready:', subspace.name);

            // Inject Vera AI if enabled
            if (veraAIEnabled) {
                console.log('[Vera Debug] Attempting to inject Vera AI into webview:', subspace.name);
                injectVeraAIIntoWebview(webview);
            }
        });

        webview.addEventListener('page-title-updated', (e) => {
            // Could update title or show loading state
        });

        webview.addEventListener('new-window', (e) => {
            // Handle new window requests
            window.veraAPI.openExternal(e.url);
        });

        // Add to container and map
        webviewContainer.appendChild(webview);
        webviewsMap.set(subspace.id, webview);
        webviewContainer.style.display = 'block';
        webview.focus();
        console.log('[space.js] Focused new webview for subspace:', subspace.name);
    }
    // Show nav bar
    const navBar = document.getElementById('webview-nav-bar');
    if (navBar) navBar.style.display = 'flex';
}

// Add subspace from catalog
async function addSubspaceFromCatalog(appId) {
    const app = appCatalog.find(a => a.id === appId);
    if (!app || !currentSpace) return;

    try {
        const subspaceConfig = {
            name: app.name,
            url: app.url,
            icon: app.icon
        };

        const newSubspace = await window.veraAPI.createSubspace(currentSpace.id, subspaceConfig);
        subspaces.push(newSubspace);

        // Update UI
        renderSubspaces();
        closeModal('add-subspace-modal');

        // Open the new subspace
        openSubspace(newSubspace.id);

        console.log('Subspace added from catalog:', newSubspace);
    } catch (error) {
        console.error('Error adding subspace from catalog:', error);
        alert('Failed to add subspace');
    }
}

// Add custom subspace
async function addCustomSubspace() {
    const nameInput = document.getElementById('subspace-name-input');
    const urlInput = document.getElementById('subspace-url-input');
    const iconInput = document.getElementById('subspace-icon-input');

    if (!nameInput?.value.trim() || !urlInput?.value.trim() || !currentSpace) {
        alert('Please fill in all required fields');
        return;
    }

    try {
        const subspaceConfig = {
            name: nameInput.value.trim(),
            url: urlInput.value.trim(),
            icon: iconInput?.value.trim() || '🌐'
        };

        const newSubspace = await window.veraAPI.createSubspace(currentSpace.id, subspaceConfig);
        subspaces.push(newSubspace);

        // Update UI
        renderSubspaces();
        closeModal('add-subspace-modal');

        // Reset form
        document.getElementById('custom-subspace-form')?.reset();

        // Open the new subspace
        openSubspace(newSubspace.id);

        console.log('Custom subspace added:', newSubspace);
    } catch (error) {
        console.error('Error adding custom subspace:', error);
        alert('Failed to add subspace');
    }
}

// Remove subspace
async function removeSubspace(subspaceId) {
    const subspace = subspaces.find(s => s.id === subspaceId);
    if (!subspace) return;

    if (!confirm(`Are you sure you want to remove "${subspace.name}"?`)) return;

    try {
        await window.veraAPI.deleteSubspace(currentSpace.id, subspaceId);
        subspaces = subspaces.filter(s => s.id !== subspaceId);

        // Remove webview from map and DOM
        const webview = webviewsMap.get(subspaceId);
        if (webview) {
            webview.remove();
            webviewsMap.delete(subspaceId);
        }

        // If this was the active subspace, clear it
        if (activeSubspace?.id === subspaceId) {
            activeSubspace = null;
            showWelcomeScreen();
        }

        // Update UI
        renderSubspaces();

        console.log('Subspace removed:', subspaceId);
    } catch (error) {
        console.error('Error removing subspace:', error);
        alert('Failed to remove subspace');
    }
}

// Show welcome screen
function showWelcomeScreen() {
    const welcomeScreen = document.getElementById('welcome-screen');
    const webviewContainer = document.getElementById('webview-container');
    const navBar = document.getElementById('webview-nav-bar');

    if (welcomeScreen) welcomeScreen.style.display = 'flex';
    if (webviewContainer) webviewContainer.style.display = 'none';
    if (navBar) navBar.style.display = 'none';
}

// Hide welcome screen
function hideWelcomeScreen() {
    const welcomeScreen = document.getElementById('welcome-screen');
    const webviewContainer = document.getElementById('webview-container');
    const navBar = document.getElementById('webview-nav-bar');

    if (welcomeScreen) welcomeScreen.style.display = 'none';
    if (webviewContainer) webviewContainer.style.display = 'block';
    if (navBar) navBar.style.display = 'flex';
}

// Switch tabs in modal
function switchTab(tabName) {
    console.log('[switchTab] Switching to tab:', tabName);
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[onclick="switchTab('${tabName}')"]`)?.classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
        content.style.display = 'none';
    });

    const activeContent = document.getElementById(`${tabName}-tab`);
    if (activeContent) {
        activeContent.classList.add('active');
        activeContent.style.display = 'block';
        // Focus first input if custom tab
        if (tabName === 'custom') {
            const firstInput = activeContent.querySelector('input[type="text"]');
            if (firstInput) {
                setTimeout(() => {
                    firstInput.focus();
                    console.log('[switchTab] Focused input:', firstInput.id);
                }, 100);
            }
        }
    }
}

// Show modal
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        console.log('[showModal] Showing modal:', modalId);
        // Reset to catalog tab
        if (modalId === 'add-subspace-modal') {
            switchTab('catalog');
        }
    }
}

// Close modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        console.log('[closeModal] Closed modal:', modalId);
    }
}

// Show pod settings
function showSpaceSettings() {
    if (!currentSpace) return;

    // Create settings modal dynamically
    const existingModal = document.getElementById('space-settings-modal');
    if (existingModal) {
        existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'space-settings-modal';
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Pod Settings</h3>
                <button class="close-button" onclick="closeModal('space-settings-modal')">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label for="space-name-edit">Space Name</label>
                    <input type="text" id="space-name-edit" value="${currentSpace.name}" 
                           style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 14px;">
                </div>
                <div class="form-group">
                    <label for="space-color-edit">Pod Color</label>
                    <input type="color" id="space-color-edit" value="${currentSpace.color}" 
                           style="width: 100%; height: 40px; border: 1px solid var(--border-color); border-radius: 8px; cursor: pointer;">
                </div>
                <div class="form-group">
                    <label for="space-chatbot-type-edit">Chatbot Type</label>
                    <select id="space-chatbot-type-edit" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 14px;">
                        <option value="generic" ${currentSpace.chatbotType === 'generic' ? 'selected' : ''}>Generic</option>
                        <option value="job_search" ${currentSpace.chatbotType === 'job_search' ? 'selected' : ''}>Job Search</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="space-personal-data-edit">Personal Data (for AI context)</label>
                    <textarea id="space-personal-data-edit" rows="6" placeholder="Enter any personal data or context Vera should remember for this Pod (e.g., your resume, project details, personal preferences). This data is local to this Pod and will be used to enhance AI responses.">${currentSpace.personalData || ''}</textarea>
                </div>
                <div class="form-group">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="checkbox" id="space-adblock-edit" ${currentSpace.settings?.adBlockEnabled ? 'checked' : ''}>
                        Enable Ad Blocking
                    </label>
                </div>
                <div class="form-group" style="margin-top: 32px; padding-top: 32px; border-top: 1px solid var(--border-color);">
                    <h4 style="margin: 0 0 16px 0; color: var(--danger-color);">Danger Zone</h4>
                    <button class="secondary-button" onclick="deleteSpace()" 
                            style="background: var(--danger-color); color: white; border-color: var(--danger-color);">
                        Delete This Space
                    </button>
                </div>
            </div>
            <div class="modal-footer">
                <button class="secondary-button" onclick="closeModal('space-settings-modal')">Cancel</button>
                <button class="primary-button" onclick="saveSpaceSettings()">Save Changes</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

// Save pod settings
async function saveSpaceSettings() {
    const nameInput = document.getElementById('space-name-edit');
    const colorInput = document.getElementById('space-color-edit');
    const adBlockInput = document.getElementById('space-adblock-edit');
    const personalDataInput = document.getElementById('space-personal-data-edit');
    const chatbotTypeSelect = document.getElementById('space-chatbot-type-edit');

    if (!nameInput || !colorInput || !personalDataInput || !chatbotTypeSelect || !currentSpace) return;

    try {
        const updates = {
            name: nameInput.value.trim(),
            color: colorInput.value,
            personalData: personalDataInput.value.trim(),
            chatbotType: chatbotTypeSelect.value,
            settings: {
                ...currentSpace.settings,
                adBlockEnabled: adBlockInput.checked
            }
        };

        const updatedSpace = await window.veraAPI.updateSpace(currentSpace.id, updates);
        if (updatedSpace) {
            currentSpace = updatedSpace;
            updateSpaceInfo();
            closeModal('space-settings-modal');

            // Re-render quick actions if chatbot is initialized and type changed
            if (window.veraWidget) {
                console.log('[Vera Debug] Calling updateChatbotQuickActions from saveSpaceSettings. currentSpace:', currentSpace, 'window.veraWidget:', !!window.veraWidget);
                updateChatbotQuickActions();
            }
        }
    } catch (error) {
        console.error('Error updating space:', error);
        alert('Failed to update pod settings');
    }
}

// Delete current space
async function deleteSpace() {
    if (!currentSpace) return;

    if (!confirm(`Are you sure you want to delete "${currentSpace.name}"? This will remove all subspaces and cannot be undone.`)) {
        return;
    }

    try {
        await window.veraAPI.deleteSpace(currentSpace.id);
        // Close the window after deletion
        window.veraAPI.windowClose();
    } catch (error) {
        console.error('Error deleting space:', error);
        alert('Failed to delete space');
    }
}

// Handle icon upload
function handleIconUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
        alert('Please upload a valid image file (SVG, PNG, or JPG)');
        return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
        alert('File size must be less than 2MB');
        return;
    }

    // Create a unique filename
    const timestamp = Date.now();
    const extension = file.name.split('.').pop();
    const filename = `custom-icon-${timestamp}.${extension}`;

    // Read the file and create preview
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            // Save the file to the images directory
            const iconPath = await window.veraAPI.saveCustomIcon(filename, e.target.result);

            // Update the icon input with the path
            const iconInput = document.getElementById('subspace-icon-input');
            iconInput.value = `<img src="${iconPath}" alt="Custom Icon" class="app-icon">`;

            // Show preview
            const preview = document.getElementById('icon-preview');
            const previewImage = document.getElementById('preview-image');
            previewImage.src = iconPath;
            preview.style.display = 'flex';
        } catch (error) {
            console.error('Error saving icon:', error);
            alert('Failed to save icon');
        }
    };
    reader.readAsArrayBuffer(file);
}

// Clear icon preview
function clearIconPreview() {
    const iconInput = document.getElementById('subspace-icon-input');
    const preview = document.getElementById('icon-preview');
    const previewImage = document.getElementById('preview-image');
    const fileInput = document.getElementById('subspace-icon-upload');

    iconInput.value = '';
    previewImage.src = '';
    preview.style.display = 'none';
    fileInput.value = '';
}

// Global functions for HTML onclick handlers
window.openSubspace = openSubspace;
window.removeSubspace = removeSubspace;
window.addSubspaceFromCatalog = addSubspaceFromCatalog;
window.addCustomSubspace = addCustomSubspace;
window.switchTab = switchTab;
window.showModal = showModal;
window.closeModal = closeModal;
window.showSpaceSettings = showSpaceSettings;
window.saveSpaceSettings = saveSpaceSettings;
window.deleteSpace = deleteSpace;
window.clearIconPreview = clearIconPreview;

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

// Theme toggle logic
function setThemeToggleIcon(isDark) {
    const iconSpan = document.getElementById('theme-toggle-icon');
    if (!iconSpan) return;
    if (isDark) {
        iconSpan.innerHTML = `<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 0 1 12.79 3a1 1 0 0 0-1.13 1.32A7 7 0 1 0 19.68 13.92a1 1 0 0 0 1.32-1.13Z" fill="currentColor"/></svg>`;
    } else {
        iconSpan.innerHTML = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="currentColor"/><g stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></g></svg>`;
    }
}

async function toggleTheme() {
    const isDark = !document.body.classList.contains('dark-theme');
    document.body.classList.toggle('dark-theme', isDark);
    setThemeToggleIcon(isDark);
    try {
        await window.veraAPI.updateSettings({ theme: isDark ? 'dark' : 'light' });
    } catch (error) {
        console.error('Error updating theme:', error);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
        setThemeToggleIcon(document.body.classList.contains('dark-theme'));
    }
});

// Update chatbot quick actions based on current space's chatbot type
function updateChatbotQuickActions() {
    if (currentSpace && currentSpace.chatbotType && window.veraWidget) {
        const actions = CHATBOT_QUICK_ACTIONS[currentSpace.chatbotType] || [];
        window.veraWidget.renderQuickActions(actions);
        // Update the chatbot type display
        window.veraWidget.updateChatbotType(currentSpace.chatbotType);
    } else if (window.veraWidget) {
        // If no specific chatbot type or currentSpace, clear actions and set generic type
        window.veraWidget.renderQuickActions([]);
        window.veraWidget.updateChatbotType('generic');
    }
}

// Add Vera AI initialization function
async function initializeVeraAI() {
    console.log('[Vera Debug] initializeVeraAI called');

    // Prevent multiple initializations
    if (veraAIInitialized || window.veraWidgetCreated) {
        console.log('[Vera Debug] Vera AI already initialized (flag or global), skipping');
        return;
    }

    try {
        // Get Vera AI settings
        veraAISettings = await window.veraAPI.getVeraAISettings();
        veraAIEnabled = veraAISettings.enabled && veraAISettings.apiKey;

        if (veraAIEnabled) {
            // Load Vera AI widget
            const widgetScript = document.createElement('script');
            widgetScript.src = '../vera-ai/widget.js';
            widgetScript.onload = () => {
                setTimeout(() => {
                    if (window.VeraWidget) {
                        // Remove any existing widget
                        const existingWidget = document.getElementById('vera-ai-widget');
                        if (existingWidget) {
                            console.warn('[Vera Debug] Existing Vera AI widget found, removing before creating new one.');
                            existingWidget.remove();
                        }
                        if (!window.veraWidgetCreated) {
                            console.log('[Vera Debug] VeraWidget class found, creating widget');
                            // Determine chatbot type - use currentSpace's type or default to generic
                            const chatbotType = (currentSpace && currentSpace.chatbotType) ? currentSpace.chatbotType : 'generic';
                            console.log('[Vera Debug] Initializing widget with chatbot type:', chatbotType);
                            window.veraWidget = new window.VeraWidget(chatbotType);
                            window.veraWidget.createWidget();
                            window.veraWidgetCreated = true;
                            console.log('[Vera Debug] VeraWidget created and global flag set');
                            // Set up message handler
                            window.veraWidget.onSendMessage = async (message) => {
                                handleVeraAIMessage(message);
                            };
                            veraAIInitialized = true;

                            // Now that widget is created and initialized, render quick actions
                            updateChatbotQuickActions();

                        } else {
                            console.warn('[Vera Debug] Widget already created (global flag), skipping creation.');
                            veraAIInitialized = true;
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
        }

        // Listen for Vera AI updates
        window.veraAPI.onVeraAIUpdate((settings) => {
            veraAISettings = settings;
            veraAIEnabled = settings.enabled && settings.apiKey;
            // Could refresh widget here if needed
        });

        // Listen for message processing
        window.veraAPI.onVeraAIProcessMessage(async (data) => {
            if (window.veraWidget) {
                if (data.type === 'chunk') {
                    window.veraWidget.updateStreamingResponse(data.content);
                } else if (data.type === 'complete') {
                    window.veraWidget.finishStreamingResponse();
                } else if (data.type === 'error') {
                    window.veraWidget.addMessage('assistant', `Sorry, I encountered an error: ${data.error}`);
                    window.veraWidget.finishStreamingResponse();
                }
            }
        });
    } catch (error) {
        console.error('Error initializing Vera AI:', error);
    }
}

// Handle Vera AI message from main window
async function handleVeraAIMessage(message) {
    try {
        // Start streaming response
        window.veraWidget.startStreamingResponse();

        // Get active webview context if available
        let context = null;
        if (activeSubspace) {
            const webview = webviewsMap.get(activeSubspace.id);
            if (webview) {
                try {
                    context = await extractWebviewContext(webview);
                } catch (error) {
                    console.error('Error extracting webview context:', error);
                }
            }
        }

        let fullContext = context ? formatContextForAI(context) : '';
        if (currentSpace && currentSpace.personalData) {
            fullContext += `\n\nPersonal Data for this Pod:\n${currentSpace.personalData}`;
        }

        // Define AI instructions based on chatbot type
        let aiInstructions = ``;
        if (currentSpace && currentSpace.chatbotType) {
            switch (currentSpace.chatbotType) {
                case 'job_search':
                    aiInstructions = `\n\nYou are a specialized AI assistant for job searching. Your primary goal is to help the user with job applications, resume analysis, and interview preparation related to the current webpage content. Use the provided personal data (like resume information) to tailor your responses. Focus on generating relevant content like cover letters, evaluating job fit, and suggesting interview questions.`;
                    break;
                // Add more chatbot types here in the future
                case 'generic':
                default:
                    aiInstructions = ``; // No special instructions for generic
                    break;
            }
        }

        // Call OpenAI API
        const response = await callOpenAI(message, fullContext, veraAISettings.apiKey, aiInstructions);

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

// Extract context from webview
async function extractWebviewContext(webview) {
    // Load the enhanced extraction script
    const ContentExtractorScript = `
        (function() {
            const config = ${JSON.stringify({
        maxLength: 10000,
        selectors: {
            article: 'article, main, [role="main"], #main-content, .main-content',
            headings: 'h1, h2, h3, h4, h5, h6',
            paragraphs: 'p',
            lists: 'ul, ol',
            exclude: 'script, style, nav, header, footer, aside, .ad, .advertisement, .sidebar'
        }
    })};
            
            // Helper function to get text content
            function getTextContent(element) {
                if (!element) return '';
                
                // Clone the element to avoid modifying the original
                const clone = element.cloneNode(true);
                
                // Remove excluded elements
                const excludeSelectors = config.selectors.exclude;
                clone.querySelectorAll(excludeSelectors).forEach(el => el.remove());
                
                return clone.textContent.trim();
            }
            
            // Helper function to check if element is visible
            function isElementVisible(element) {
                if (!element) return false;
                
                const style = window.getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                
                return style.display !== 'none' && 
                       style.visibility !== 'hidden' && 
                       style.opacity !== '0' &&
                       rect.width > 0 && 
                       rect.height > 0;
            }
            
            // Helper function to detect modals and popups
            function findVisibleModals() {
                const modalSelectors = [
                    '[role="dialog"]',
                    '[role="alertdialog"]',
                    '[aria-modal="true"]',
                    '.modal:not(.modal-backdrop)',
                    '.popup',
                    '.dialog',
                    '.overlay-content',
                    '.lightbox',
                    '.popover',
                    '.tooltip[role="tooltip"]',
                    '[class*="modal"][class*="open"]',
                    '[class*="modal"][class*="show"]',
                    '[class*="popup"][class*="open"]',
                    '[class*="popup"][class*="show"]',
                    '.MuiDialog-root', // Material-UI
                    '.ant-modal-wrap', // Ant Design
                    '.modal-content', // Bootstrap
                    '[data-testid="modal"]',
                    '[data-modal="true"]'
                ];
                
                const modals = [];
                
                // Check each selector
                modalSelectors.forEach(selector => {
                    try {
                        const elements = document.querySelectorAll(selector);
                        elements.forEach(el => {
                            if (isElementVisible(el) && !modals.some(m => m.element === el)) {
                                // Get z-index to prioritize
                                const zIndex = parseInt(window.getComputedStyle(el).zIndex) || 0;
                                modals.push({ element: el, zIndex });
                            }
                        });
                    } catch (e) {
                        // Ignore selector errors
                    }
                });
                
                // Also check for high z-index elements that might be modals
                const allElements = document.querySelectorAll('*');
                allElements.forEach(el => {
                    const style = window.getComputedStyle(el);
                    const zIndex = parseInt(style.zIndex);
                    
                    if (zIndex > 999 && isElementVisible(el)) {
                        // Check if it's likely a modal/popup based on size and position
                        const rect = el.getBoundingClientRect();
                        const isOverlay = (
                            style.position === 'fixed' || style.position === 'absolute'
                        ) && (
                            rect.width > 200 && rect.height > 100
                        );
                        
                        if (isOverlay && !modals.some(m => m.element === el)) {
                            modals.push({ element: el, zIndex });
                        }
                    }
                });
                
                // Sort by z-index (highest first)
                return modals.sort((a, b) => b.zIndex - a.zIndex);
            }
            
            // Extract content from a modal/popup
            function extractModalContent(modal) {
                const element = modal.element;
                
                // Try to find title
                let title = '';
                const titleSelectors = [
                    '[role="heading"]',
                    '.modal-title',
                    '.modal-header h1, .modal-header h2, .modal-header h3',
                    '.dialog-title',
                    '.popup-title',
                    'h1, h2, h3',
                    '[class*="title"]'
                ];
                
                for (const selector of titleSelectors) {
                    const titleEl = element.querySelector(selector);
                    if (titleEl) {
                        title = titleEl.textContent.trim();
                        if (title) break;
                    }
                }
                
                // Extract body content
                let bodyContent = '';
                const bodySelectors = [
                    '.modal-body',
                    '.dialog-content',
                    '.popup-content',
                    '[class*="content"]',
                    'main',
                    'article'
                ];
                
                for (const selector of bodySelectors) {
                    const bodyEl = element.querySelector(selector);
                    if (bodyEl) {
                        bodyContent = getTextContent(bodyEl);
                        if (bodyContent.length > 50) break;
                    }
                }
                
                // If no specific body found, get all content
                if (!bodyContent) {
                    bodyContent = getTextContent(element);
                }
                
                // Extract any form fields or interactive elements
                const formData = [];
                const inputs = element.querySelectorAll('input[type="text"], input[type="email"], textarea, select');
                inputs.forEach(input => {
                    const label = input.labels?.[0]?.textContent || 
                                input.placeholder || 
                                input.getAttribute('aria-label') || 
                                input.name || '';
                    if (label) {
                        formData.push({
                            label: label.trim(),
                            value: input.value || '',
                            type: input.tagName.toLowerCase()
                        });
                    }
                });
                
                // Extract buttons/actions
                const actions = [];
                const buttons = element.querySelectorAll('button, [role="button"], input[type="submit"]');
                buttons.forEach(btn => {
                    const text = btn.textContent.trim();
                    if (text && text.length < 50) {
                        actions.push(text);
                    }
                });
                
                return {
                    type: 'modal',
                    title,
                    content: bodyContent,
                    formData,
                    actions,
                    zIndex: modal.zIndex
                };
            }
            
            // Get page title
            const title = document.title || '';
            
            // Get page URL
            const url = window.location.href;
            
            // Extract visible modals/popups first
            const visibleModals = findVisibleModals();
            const modalContents = visibleModals.map(modal => extractModalContent(modal));
            
            // Try to find main content area
            let mainContent = '';
            const articleSelectors = config.selectors.article.split(', ');
            
            for (const selector of articleSelectors) {
                const element = document.querySelector(selector);
                if (element) {
                    mainContent = getTextContent(element);
                    if (mainContent.length > 100) break; // Found substantial content
                }
            }
            
            // If no main content found, extract from body
            if (!mainContent) {
                mainContent = getTextContent(document.body);
            }
            
            // Extract headings for structure
            const headings = Array.from(document.querySelectorAll(config.selectors.headings))
                .filter(h => !h.closest(config.selectors.exclude))
                .map(h => ({
                    level: parseInt(h.tagName[1]),
                    text: h.textContent.trim()
                }))
                .filter(h => h.text.length > 0);
            
            // Extract metadata
            const metadata = {
                description: document.querySelector('meta[name="description"]')?.content || '',
                keywords: document.querySelector('meta[name="keywords"]')?.content || '',
                author: document.querySelector('meta[name="author"]')?.content || ''
            };
            
            // Truncate content if too long
            if (mainContent.length > config.maxLength) {
                mainContent = mainContent.substring(0, config.maxLength) + '...';
            }
            
            return {
                title,
                url,
                content: mainContent,
                headings,
                metadata,
                modals: modalContents,
                hasActiveModals: modalContents.length > 0,
                extractedAt: new Date().toISOString()
            };
        })();
    `;

    return await webview.executeJavaScript(ContentExtractorScript);
}

// Format context for AI
function formatContextForAI(context) {
    if (!context) return '';

    let formatted = `Page Title: ${context.title}\n`;
    formatted += `URL: ${context.url}\n\n`;

    if (context.metadata?.description) {
        formatted += `Description: ${context.metadata.description}\n\n`;
    }

    // Add modal/popup content if present
    if (context.hasActiveModals && context.modals?.length > 0) {
        formatted += '=== ACTIVE POPUPS/MODALS ===\n';
        context.modals.forEach((modal, index) => {
            formatted += `\nModal ${index + 1}${modal.title ? ': ' + modal.title : ''}\n`;
            formatted += '-'.repeat(30) + '\n';

            if (modal.content) {
                formatted += 'Content: ' + modal.content.substring(0, 500);
                if (modal.content.length > 500) formatted += '...';
                formatted += '\n';
            }

            if (modal.formData && modal.formData.length > 0) {
                formatted += '\nForm Fields:\n';
                modal.formData.forEach(field => {
                    formatted += `  - ${field.label}: ${field.value || '(empty)'}\n`;
                });
            }

            if (modal.actions && modal.actions.length > 0) {
                formatted += '\nAvailable Actions: ' + modal.actions.join(', ') + '\n';
            }
        });
        formatted += '\n=== END OF POPUPS/MODALS ===\n\n';
    }

    if (context.headings && context.headings.length > 0) {
        formatted += 'Page Structure:\n';
        context.headings.forEach(h => {
            const indent = '  '.repeat(h.level - 1);
            formatted += `${indent}${h.text}\n`;
        });
        formatted += '\n';
    }

    formatted += 'Main Content:\n';
    formatted += context.content;

    return formatted;
}

// Call OpenAI API (shared with main.js)
async function callOpenAI(message, context, apiKey, aiInstructions = '') {
    const messages = [
        {
            role: 'system',
            content: `You are Vera, a helpful AI assistant integrated into the Vera Desktop application. 
You have access to the content of the webpage the user is currently viewing. 
When users ask questions, you should consider the page context and provide relevant, helpful answers.
Be conversational, friendly, and concise in your responses.${context ? '\n\nCurrent page context:\n' + context : ''}${aiInstructions}`
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
            model: veraAISettings.model || 'gpt-4-turbo-preview',
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

// Stream OpenAI response (shared with main.js)
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