// Vera AI Widget
class VeraWidget {
    constructor() {
        this.isExpanded = false;
        this.messages = [];
        this.isLoading = false;
        this.widget = null;
        this.chatContainer = null;
        this.inputField = null;
    }

    // Create and inject the widget HTML
    createWidget() {
        const widgetHTML = `
            <div id="vera-ai-widget" class="vera-widget collapsed">
                <div class="vera-widget-button" id="vera-toggle-btn">
                    <svg class="vera-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M8 9h8m-8 4h6m-9 5a9 9 0 1 1 18 0 9 9 0 0 1-18 0Z"/>
                    </svg>
                    <span class="vera-badge" id="vera-badge" style="display: none;">1</span>
                </div>
                
                <div class="vera-chat-container" id="vera-chat-container">
                    <div class="vera-header">
                        <div class="vera-header-info">
                            <div class="vera-avatar">V</div>
                            <div>
                                <h3 class="vera-title">Vera AI Assistant</h3>
                                <p class="vera-subtitle">Ask me about this page</p>
                            </div>
                        </div>
                        <button class="vera-close-btn" id="vera-close-btn">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M6 6l8 8M14 6l-8 8"/>
                            </svg>
                        </button>
                    </div>
                    
                    <div class="vera-messages" id="vera-messages">
                        <div class="vera-welcome-message">
                            <p>Hi! I'm Vera, your AI assistant. I can help you understand and navigate the content on this page. Feel free to ask me any questions!</p>
                        </div>
                    </div>
                    
                    <div class="vera-input-container">
                        <div id="vera-quick-actions" class="vera-quick-actions">
                            <!-- Quick action buttons will be injected here -->
                        </div>
                        <input 
                            type="text" 
                            class="vera-input" 
                            id="vera-input" 
                            placeholder="Ask about this page..."
                            autocomplete="off"
                        />
                        <button class="vera-send-btn" id="vera-send-btn">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M3 10h14m0 0l-5-5m5 5l-5 5"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Create a container div
        const container = document.createElement('div');
        container.innerHTML = widgetHTML;
        document.body.appendChild(container.firstElementChild);

        // Cache DOM elements
        this.widget = document.getElementById('vera-ai-widget');
        this.chatContainer = document.getElementById('vera-chat-container');
        this.inputField = document.getElementById('vera-input');

        // Set up event listeners
        this.setupEventListeners();
    }

    // Set up event listeners
    setupEventListeners() {
        // Toggle button
        document.getElementById('vera-toggle-btn').addEventListener('click', () => {
            this.toggleWidget();
        });

        // Close button
        document.getElementById('vera-close-btn').addEventListener('click', () => {
            this.toggleWidget();
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

        // Click outside to close
        document.addEventListener('click', (e) => {
            if (this.isExpanded &&
                !this.widget.contains(e.target) &&
                !e.target.closest('#vera-ai-widget')) {
                this.toggleWidget();
            }
        });
    }

    // Toggle widget expanded/collapsed state
    toggleWidget() {
        this.isExpanded = !this.isExpanded;

        if (this.isExpanded) {
            this.widget.classList.remove('collapsed');
            this.widget.classList.add('expanded');
            // Focus input when opened
            setTimeout(() => this.inputField.focus(), 300);
            // Hide badge when opened
            document.getElementById('vera-badge').style.display = 'none';
        } else {
            this.widget.classList.remove('expanded');
            this.widget.classList.add('collapsed');
        }
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
                        // Clear actions after one is clicked - REMOVED TO KEEP BUTTONS VISIBLE
                        // this.renderQuickActions([]);
                    }
                });
                quickActionsContainer.appendChild(button);
            });
            quickActionsContainer.style.display = 'flex'; // Show container if there are actions
        } else {
            quickActionsContainer.style.display = 'none'; // Hide container if no actions
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
        this.onSendMessage(message);
    }

    // Add a message to the chat
    addMessage(role, content, isStreaming = false) {
        const messagesContainer = document.getElementById('vera-messages');

        if (isStreaming) {
            // Update existing streaming message
            const existingStreaming = messagesContainer.querySelector('.vera-message.assistant.streaming');
            if (existingStreaming) {
                existingStreaming.querySelector('.vera-message-content').textContent = content;
                this.scrollToBottom();
                return;
            }
        }

        const messageHTML = `
            <div class="vera-message ${role} ${isStreaming ? 'streaming' : ''}">
                <div class="vera-message-avatar">${role === 'user' ? 'U' : 'V'}</div>
                <div class="vera-message-content">${this.escapeHtml(content)}</div>
            </div>
        `;

        messagesContainer.insertAdjacentHTML('beforeend', messageHTML);
        this.scrollToBottom();
    }

    // Start streaming a response
    startStreamingResponse() {
        this.addMessage('assistant', '', true);
    }

    // Update streaming response
    updateStreamingResponse(content) {
        this.addMessage('assistant', content, true);
    }

    // Finish streaming response
    finishStreamingResponse() {
        const streamingMessage = document.querySelector('.vera-message.assistant.streaming');
        if (streamingMessage) {
            streamingMessage.classList.remove('streaming');
        }
        this.setLoading(false);
    }

    // Set loading state
    setLoading(loading) {
        this.isLoading = loading;
        const sendBtn = document.getElementById('vera-send-btn');

        if (loading) {
            sendBtn.disabled = true;
            sendBtn.innerHTML = `
                <svg class="vera-spinner" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="10" cy="10" r="8" stroke-opacity="0.25"/>
                    <path d="M18 10a8 8 0 0 1-8 8" stroke-opacity="0.75"/>
                </svg>
            `;
        } else {
            sendBtn.disabled = false;
            sendBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 10h14m0 0l-5-5m5 5l-5 5"/>
                </svg>
            `;
        }
    }

    // Scroll to bottom of messages
    scrollToBottom() {
        const messagesContainer = document.getElementById('vera-messages');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Show notification badge
    showNotification(count = 1) {
        if (!this.isExpanded) {
            const badge = document.getElementById('vera-badge');
            badge.textContent = count;
            badge.style.display = 'flex';
        }
    }

    // Event handler (to be overridden)
    onSendMessage(message) {
        // This will be overridden by the parent
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VeraWidget;
}
if (typeof window !== 'undefined') {
    window.VeraWidget = VeraWidget;
} 