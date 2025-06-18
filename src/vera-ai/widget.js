// Vera AI Widget
class VeraWidget {
    constructor(initialChatbotType = 'generic') {
        this.isExpanded = false;
        this.messages = [];
        this.isLoading = false;
        this.widget = null;
        this.chatContainer = null;
        this.inputField = null;
        this.sidebar = null;
        this.toggleButton = null;
        this.chatbotType = initialChatbotType;
    }

    // Create and inject the widget HTML
    createWidget() {
        const widgetHTML = `
            <!-- Sidebar Toggle Button -->
            <div id="vera-sidebar-toggle" class="vera-sidebar-toggle">
                <img src="styles/images/vera_logo.svg" alt="Vera" class="vera-toggle-icon" />
            </div>
            
            <!-- Sidebar Container -->
            <div id="vera-sidebar" class="vera-sidebar collapsed">
                <!-- Sidebar Header -->
                <div class="vera-sidebar-header">
                    <div class="vera-sidebar-header-left">
                        <img src="styles/images/vera_logo.svg" alt="Vera" class="vera-logo" />
                        <p class="vera-subtitle" id="vera-chatbot-type">AI Assistant</p>
                    </div>
                    <div class="vera-sidebar-header-right">
                        <button class="vera-header-btn" id="vera-refresh-btn" title="Refresh Context">
                            <img src="styles/images/reload.svg" alt="Refresh" class="vera-btn-icon" />
                        </button>
                        <button class="vera-header-btn" id="vera-close-btn" title="Close">
                            <img src="styles/images/xout.svg" alt="Close" class="vera-btn-icon" />
                        </button>
                    </div>
                </div>
                
                <!-- Chat Date -->
                <div class="vera-chat-date">
                    <span id="vera-current-date"></span>
                </div>
                
                <!-- Messages Container -->
                <div class="vera-messages" id="vera-messages">
                    <div class="vera-welcome-message">
                        <div class="vera-message assistant">
                            <div class="vera-message-bubble assistant-bubble" id="vera-welcome-message-content">
                                <!-- Welcome message will be set dynamically -->
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Quick Actions -->
                <div class="vera-quick-actions-container">
                    <div id="vera-quick-actions" class="vera-quick-actions">
                        <!-- Quick action buttons will be injected here -->
                    </div>
                </div>
                
                <!-- Input Container -->
                <div class="vera-input-container">
                    <div class="vera-input-wrapper">
                        <button class="vera-input-btn" id="vera-emoji-btn" title="Emoji">
                            <img src="styles/images/smiley.svg" alt="Emoji" class="vera-input-icon" />
                        </button>
                        <button class="vera-input-btn" id="vera-attach-btn" title="Attachments">
                            <img src="styles/images/attach.svg" alt="Attach" class="vera-input-icon" />
                        </button>
                        <input 
                            type="text" 
                            class="vera-input" 
                            id="vera-input" 
                            placeholder="Enter message"
                            autocomplete="off"
                        />
                        <button class="vera-send-btn" id="vera-send-btn" title="Send">
                            <img src="styles/images/send.svg" alt="Send" class="vera-send-icon" />
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Create a container div
        const container = document.createElement('div');
        container.innerHTML = widgetHTML;
        document.body.appendChild(container.firstElementChild);
        document.body.appendChild(container.lastElementChild);

        // Cache DOM elements
        this.toggleButton = document.getElementById('vera-sidebar-toggle');
        this.sidebar = document.getElementById('vera-sidebar');
        this.inputField = document.getElementById('vera-input');

        // Set current date
        this.updateCurrentDate();

        // Initialize chatbot type and welcome message
        this.updateChatbotType(this.chatbotType);
        this.setWelcomeMessage(this.chatbotType);

        // Set up event listeners
        this.setupEventListeners();
    }

    // Set welcome message based on chatbot type
    setWelcomeMessage(type) {
        const welcomeElement = document.getElementById('vera-welcome-message-content');
        if (welcomeElement) {
            let welcomeContent = '';
            switch (type) {
                case 'job_search':
                    welcomeContent = `Hi! I'm Vera, your AI assistant 🤖.\nI specialize in helping people complete job applications quickly, completely, and accurately! 😊⚡`;
                    break;
                case 'crypto_czar':
                    welcomeContent = `Hi! I'm Vera, your Crypto Czar 🤖💰.\nI specialize in cryptocurrency analysis, DeFi protocols, and trading strategies. Let's navigate the crypto markets together! 🚀📈`;
                    break;
                case 'generic':
                default:
                    welcomeContent = `Hi! I'm Vera, your AI assistant 🤖.\nI'm here to help you with any questions or tasks you have. How can I assist you today? 😊`;
                    break;
            }
            welcomeElement.innerHTML = `<span class="vera-message-content">${this.escapeHtml(welcomeContent)}</span><button class="vera-copy-btn" title="Copy" onclick="window.veraWidget.copyWelcomeMessage()"><svg class="vera-copy-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>`;
        }
    }

    // Update current date
    updateCurrentDate() {
        const dateElement = document.getElementById('vera-current-date');
        if (dateElement) {
            const now = new Date();
            const options = {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            };
            dateElement.textContent = now.toLocaleDateString('en-US', options);
        }
    }

    // Set up event listeners
    setupEventListeners() {
        // Toggle button
        this.toggleButton.addEventListener('click', () => {
            this.toggleSidebar();
        });

        // Close button
        document.getElementById('vera-close-btn').addEventListener('click', () => {
            this.toggleSidebar();
        });

        // Refresh button
        document.getElementById('vera-refresh-btn').addEventListener('click', () => {
            this.refreshContext();
        });

        // Send button
        document.getElementById('vera-send-btn').addEventListener('click', () => {
            this.sendMessage();
        });

        // Enter key in input
        this.inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Emoji button (placeholder for future functionality)
        document.getElementById('vera-emoji-btn').addEventListener('click', () => {
            console.log('Emoji picker would open here');
        });

        // Attach button (placeholder for future functionality)
        document.getElementById('vera-attach-btn').addEventListener('click', () => {
            console.log('File attachment would open here');
        });

        // Click outside to close
        document.addEventListener('click', (e) => {
            if (this.isExpanded &&
                !this.sidebar.contains(e.target) &&
                !this.toggleButton.contains(e.target)) {
                this.toggleSidebar();
            }
        });
    }

    // Toggle sidebar expanded/collapsed state
    toggleSidebar() {
        this.isExpanded = !this.isExpanded;

        if (this.isExpanded) {
            this.sidebar.classList.remove('collapsed');
            this.sidebar.classList.add('expanded');
            this.toggleButton.classList.add('active');
            // Focus input when opened
            setTimeout(() => this.inputField.focus(), 300);
        } else {
            this.sidebar.classList.remove('expanded');
            this.sidebar.classList.add('collapsed');
            this.toggleButton.classList.remove('active');
        }
    }

    // Refresh context
    refreshContext() {
        console.log('Refreshing context...');
        // This could trigger a re-extraction of page content
        if (this.onRefreshContext) {
            this.onRefreshContext();
        }
    }

    // Update chatbot type display
    updateChatbotType(type) {
        this.chatbotType = type; // Store the current type

        const typeElement = document.getElementById('vera-chatbot-type');
        if (typeElement) {
            const typeNames = {
                'generic': 'AI Assistant',
                'job_search': 'Job Application Assistant',
                'crypto_czar': 'Crypto Czar'
            };
            typeElement.textContent = typeNames[type] || 'AI Assistant';
        }

        // Update welcome message when type changes
        this.setWelcomeMessage(type);
    }

    // Render quick action buttons
    renderQuickActions(actions) {
        const quickActionsContainer = document.getElementById('vera-quick-actions');
        if (!quickActionsContainer) return;

        // Clear existing actions
        quickActionsContainer.innerHTML = '';

        if (actions && actions.length > 0) {
            actions.forEach(action => {
                const button = document.createElement('button');
                button.className = 'vera-quick-action-btn';
                button.textContent = action.label;
                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (this.onSendMessage) {
                        this.onSendMessage(action.message);
                    }
                });
                quickActionsContainer.appendChild(button);
            });
            document.querySelector('.vera-quick-actions-container').style.display = 'block';
        } else {
            document.querySelector('.vera-quick-actions-container').style.display = 'none';
        }
    }

    // Send a message
    async sendMessage() {
        const message = this.inputField.value.trim();
        if (!message || this.isLoading) return;

        // Add user message
        this.addMessage('user', message);
        this.inputField.value = '';

        // Show loading state
        this.setLoading(true);

        // Emit message event
        if (this.onSendMessage) {
            this.onSendMessage(message);
        }
    }

    // Add a message to the chat
    addMessage(role, content, isStreaming = false) {
        console.log('[Vera Debug] addMessage called:', { role, content: content.substring(0, 50), isStreaming });
        const messagesContainer = document.getElementById('vera-messages');

        if (isStreaming) {
            // Update existing streaming message
            const existingStreaming = messagesContainer.querySelector('.vera-message.assistant.streaming');
            if (existingStreaming) {
                const messageBubble = existingStreaming.querySelector('.vera-message-bubble');
                messageBubble.innerHTML = `<span class="vera-message-content">${this.escapeHtml(content)}</span>`;
                this.scrollToBottom();
                return;
            }
        }

        const escapedContent = this.escapeHtml(content);
        const messageHTML = role === 'user' ?
            `<div class="vera-message user">
                <div class="vera-message-bubble user-bubble"><span class="vera-message-content">${escapedContent}</span></div>
            </div>` :
            `<div class="vera-message assistant ${isStreaming ? 'streaming' : ''}">
                <div class="vera-message-bubble assistant-bubble">
                    <span class="vera-message-content">${escapedContent}</span>
                    ${!isStreaming ? `<button class="vera-copy-btn" title="Copy message" onclick="window.veraWidget.copyMessageToClipboard(this)"><svg class="vera-copy-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>` : ''}
                </div>
            </div>`;

        console.log('[Vera Debug] Message HTML being added:', messageHTML.substring(0, 200));
        messagesContainer.insertAdjacentHTML('beforeend', messageHTML);
        this.scrollToBottom();
    }

    // Start streaming response
    startStreamingResponse() {
        this.setLoading(false);
        this.addMessage('assistant', '', true);
    }

    // Update streaming response
    updateStreamingResponse(content) {
        this.addMessage('assistant', content, true);
    }

    // Finish streaming response
    finishStreamingResponse() {
        console.log('[Vera Debug] finishStreamingResponse called');
        const streamingMessage = document.querySelector('.vera-message.assistant.streaming');
        if (streamingMessage) {
            console.log('[Vera Debug] Found streaming message, removing streaming class and adding copy button');
            streamingMessage.classList.remove('streaming');
            // Add copy button after streaming is finished
            const messageBubble = streamingMessage.querySelector('.vera-message-bubble');
            const currentContent = messageBubble.querySelector('.vera-message-content');
            if (currentContent && !messageBubble.querySelector('.vera-copy-btn')) {
                console.log('[Vera Debug] Adding copy button to finished streaming message');
                messageBubble.insertAdjacentHTML('beforeend', `<button class="vera-copy-btn" title="Copy message" onclick="window.veraWidget.copyMessageToClipboard(this)"><svg class="vera-copy-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>`);
            }
        } else {
            console.log('[Vera Debug] No streaming message found');
        }
        this.setLoading(false);
    }

    // Set loading state
    setLoading(loading) {
        this.isLoading = loading;
        const sendBtn = document.getElementById('vera-send-btn');
        const input = document.getElementById('vera-input');

        if (loading) {
            sendBtn.disabled = true;
            input.disabled = true;
            sendBtn.classList.add('loading');
        } else {
            sendBtn.disabled = false;
            input.disabled = false;
            sendBtn.classList.remove('loading');
        }
    }

    // Scroll to bottom
    scrollToBottom() {
        const messagesContainer = document.getElementById('vera-messages');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    // Escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Show notification (for future use)
    showNotification(count = 1) {
        // Could add a notification badge to the toggle button
        console.log(`New message notification: ${count}`);
    }

    // Callback for sending messages
    onSendMessage(message) {
        console.log('Message to send:', message);
    }

    // Callback for refreshing context
    onRefreshContext() {
        console.log('Refresh context requested');
    }

    // Add this method to handle copy logic
    copyMessageToClipboard(button) {
        const bubble = button.closest('.vera-message-bubble');
        const textElement = bubble.querySelector('.vera-message-content');
        const text = textElement ? textElement.textContent : '';

        navigator.clipboard.writeText(text).then(() => {
            const btnText = button.querySelector('.vera-copy-btn-text');
            const original = btnText.textContent;
            btnText.textContent = 'Copied!';
            button.classList.add('copied');
            setTimeout(() => {
                btnText.textContent = original;
                button.classList.remove('copied');
            }, 1500);
        }).catch(err => {
            console.error('Failed to copy: ', err);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                const btnText = button.querySelector('.vera-copy-btn-text');
                const original = btnText.textContent;
                btnText.textContent = 'Copied!';
                button.classList.add('copied');
                setTimeout(() => {
                    btnText.textContent = original;
                    button.classList.remove('copied');
                }, 1500);
            } catch (err) {
                console.error('Fallback copy failed: ', err);
            }
            document.body.removeChild(textArea);
        });
    }

    // Add copy method for welcome message
    copyWelcomeMessage() {
        const welcomeElement = document.getElementById('vera-welcome-message-content');
        const textElement = welcomeElement.querySelector('.vera-message-content');
        const text = textElement ? textElement.textContent : '';

        navigator.clipboard.writeText(text).then(() => {
            const button = welcomeElement.querySelector('.vera-copy-btn');
            const btnText = button.querySelector('.vera-copy-btn-text');
            const original = btnText.textContent;
            btnText.textContent = 'Copied!';
            button.classList.add('copied');
            setTimeout(() => {
                btnText.textContent = original;
                button.classList.remove('copied');
            }, 1500);
        }).catch(err => {
            console.error('Failed to copy: ', err);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                const button = welcomeElement.querySelector('.vera-copy-btn');
                const btnText = button.querySelector('.vera-copy-btn-text');
                const original = btnText.textContent;
                btnText.textContent = 'Copied!';
                button.classList.add('copied');
                setTimeout(() => {
                    btnText.textContent = original;
                    button.classList.remove('copied');
                }, 1500);
            } catch (err) {
                console.error('Fallback copy failed: ', err);
            }
            document.body.removeChild(textArea);
        });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VeraWidget;
}
if (typeof window !== 'undefined') {
    window.VeraWidget = VeraWidget;
} 