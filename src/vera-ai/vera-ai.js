// Vera AI Main Integration
const OpenAIClient = require('./openai-client');
const ContentExtractor = require('./content-extractor');

class VeraAI {
    constructor() {
        this.openaiClient = null;
        this.contentExtractor = new ContentExtractor();
        this.widget = null;
        this.messages = [];
        this.currentContext = '';
        this.apiKey = '';
    }

    // Initialize Vera AI with API key
    initialize(apiKey) {
        this.apiKey = apiKey;
        this.openaiClient = new OpenAIClient(apiKey);

        // Initialize widget if in renderer process
        if (typeof document !== 'undefined') {
            this.initializeWidget();
        }
    }

    // Initialize the widget in the renderer
    initializeWidget() {
        // Dynamically load widget script
        const script = document.createElement('script');
        script.textContent = `
            ${this.getWidgetScript()}
            
            // Initialize Vera Widget
            window.veraWidget = new VeraWidget();
            window.veraWidget.createWidget();
            
            // Set up message handler
            window.veraWidget.onSendMessage = async (message) => {
                window.veraAPI.sendChatMessage(message);
            };
        `;
        document.head.appendChild(script);

        // Add styles
        const style = document.createElement('style');
        style.textContent = this.getWidgetStyles();
        document.head.appendChild(style);
    }

    // Get widget script as string
    getWidgetScript() {
        // Return the widget.js content as a string
        return require('fs').readFileSync(require('path').join(__dirname, 'widget.js'), 'utf8');
    }

    // Get widget styles as string
    getWidgetStyles() {
        // Return the widget.css content as a string
        return require('fs').readFileSync(require('path').join(__dirname, 'widget.css'), 'utf8');
    }

    // Handle incoming chat message
    async handleChatMessage(message, webview = null) {
        try {
            // Add user message to history
            this.messages.push({ role: 'user', content: message });

            // Extract page context if webview is provided
            if (webview) {
                this.currentContext = await this.contentExtractor.extractFromWebview(webview);
            }

            // Send to OpenAI and get streaming response
            const response = await this.openaiClient.sendMessage(this.messages, this.currentContext);

            // Stream the response
            let fullResponse = '';
            for await (const chunk of this.openaiClient.streamResponse(response)) {
                fullResponse += chunk;
                // Send update to widget
                if (typeof window !== 'undefined' && window.veraWidget) {
                    window.veraWidget.updateStreamingResponse(fullResponse);
                }
            }

            // Add assistant message to history
            this.messages.push({ role: 'assistant', content: fullResponse });

            // Finish streaming in widget
            if (typeof window !== 'undefined' && window.veraWidget) {
                window.veraWidget.finishStreamingResponse();
            }

            return fullResponse;
        } catch (error) {
            console.error('Error handling chat message:', error);
            throw error;
        }
    }

    // Update page context
    async updateContext(webview) {
        if (webview) {
            this.currentContext = await this.contentExtractor.extractFromWebview(webview);
        }
    }

    // Clear chat history
    clearHistory() {
        this.messages = [];
    }

    // Get chat history
    getHistory() {
        return this.messages;
    }
}

module.exports = VeraAI; 