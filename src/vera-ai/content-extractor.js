const config = require('./config');

class ContentExtractor {
    constructor() {
        this.config = config.contentExtraction;
    }

    // Extract content from the current page (runs in webview context)
    extractPageContent() {
        const extractorScript = `
            (function() {
                const config = ${JSON.stringify(this.config)};
                
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
                
                // Get page title
                const title = document.title || '';
                
                // Get page URL
                const url = window.location.href;
                
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
                    extractedAt: new Date().toISOString()
                };
            })();
        `;

        return extractorScript;
    }

    // Format extracted content for AI context
    formatForContext(extractedData) {
        if (!extractedData) return '';

        let context = `Page Title: ${extractedData.title}\n`;
        context += `URL: ${extractedData.url}\n\n`;

        if (extractedData.metadata.description) {
            context += `Description: ${extractedData.metadata.description}\n\n`;
        }

        if (extractedData.headings && extractedData.headings.length > 0) {
            context += 'Page Structure:\n';
            extractedData.headings.forEach(h => {
                const indent = '  '.repeat(h.level - 1);
                context += `${indent}${h.text}\n`;
            });
            context += '\n';
        }

        context += 'Main Content:\n';
        context += extractedData.content;

        return context;
    }

    // Extract content from a webview
    async extractFromWebview(webview) {
        try {
            const script = this.extractPageContent();
            const result = await webview.executeJavaScript(script);
            return this.formatForContext(result);
        } catch (error) {
            console.error('Error extracting content from webview:', error);
            return '';
        }
    }
}

module.exports = ContentExtractor; 