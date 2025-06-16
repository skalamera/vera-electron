// Vera AI Webview Injection Script Generator
const fs = require('fs');
const path = require('path');
const ContentExtractor = require('./content-extractor');

// Generate the injection script with widget code and styles
function generateInjectionScript() {
    // Read widget script and styles
    const widgetScript = fs.readFileSync(path.join(__dirname, 'widget.js'), 'utf8');
    const widgetStyles = fs.readFileSync(path.join(__dirname, 'widget.css'), 'utf8');

    // Get the content extraction script from ContentExtractor
    const contentExtractor = new ContentExtractor();
    const extractionScript = contentExtractor.extractPageContent();

    // Generate the complete injection script
    const injectionScript = `
(function() {
    // Check if already injected
    if (window.__veraAIInjected) return;
    window.__veraAIInjected = true;

    // Widget class definition
    ${widgetScript}

    // Widget styles
    const style = document.createElement('style');
    style.textContent = \`${widgetStyles.replace(/`/g, '\\`')}\`;
    document.head.appendChild(style);

    // Initialize widget
    const veraWidget = new VeraWidget();
    veraWidget.createWidget();

    // Communication with parent window
    veraWidget.onSendMessage = (message) => {
        // Extract page context including modals
        const extractPageContext = function() {
            return ${extractionScript};
        };
        
        const context = extractPageContext();
        
        // Send message to parent window
        window.parent.postMessage({
            type: 'vera-ai-message',
            message: message,
            context: context
        }, '*');
    };

    // Listen for responses from parent
    window.addEventListener('message', (event) => {
        if (event.data.type === 'vera-ai-response') {
            if (event.data.streaming) {
                veraWidget.updateStreamingResponse(event.data.content);
            } else if (event.data.complete) {
                veraWidget.finishStreamingResponse();
            } else if (event.data.error) {
                veraWidget.addMessage('assistant', 'Sorry, I encountered an error: ' + event.data.error);
                veraWidget.finishStreamingResponse();
            }
        }
    });

    // Auto-hide widget on certain pages
    const restrictedDomains = ['banking', 'bank', 'secure', 'payment'];
    const currentDomain = window.location.hostname.toLowerCase();
    
    if (restrictedDomains.some(domain => currentDomain.includes(domain))) {
        document.getElementById('vera-ai-widget').style.display = 'none';
    }
})();
    `;

    return injectionScript;
}

// Generate a simpler version for direct browser injection (without file system access)
function generateBrowserInjectionScript(widgetScriptContent, widgetStylesContent) {
    return `
(function() {
    // Check if already injected
    if (window.__veraAIInjected) return;
    window.__veraAIInjected = true;

    // Widget class definition
    ${widgetScriptContent}

    // Widget styles
    const style = document.createElement('style');
    style.textContent = \`${widgetStylesContent.replace(/`/g, '\\`')}\`;
    document.head.appendChild(style);

    // Initialize widget
    const veraWidget = new VeraWidget();
    veraWidget.createWidget();

    // Communication with parent window
    veraWidget.onSendMessage = (message) => {
        // Use IPC to communicate with parent
        console.log('Sending message from webview:', message);
        // In a webview context, we might use different communication methods
    };
})();
    `;
}

module.exports = {
    generateInjectionScript,
    generateBrowserInjectionScript
}; 