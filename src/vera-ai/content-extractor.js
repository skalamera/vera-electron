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

        // Add modal/popup content if present
        if (extractedData.hasActiveModals && extractedData.modals.length > 0) {
            context += '=== ACTIVE POPUPS/MODALS ===\n';
            extractedData.modals.forEach((modal, index) => {
                context += `\nModal ${index + 1}${modal.title ? ': ' + modal.title : ''}\n`;
                context += '-'.repeat(30) + '\n';

                if (modal.content) {
                    context += 'Content: ' + modal.content.substring(0, 500);
                    if (modal.content.length > 500) context += '...';
                    context += '\n';
                }

                if (modal.formData && modal.formData.length > 0) {
                    context += '\nForm Fields:\n';
                    modal.formData.forEach(field => {
                        context += `  - ${field.label}: ${field.value || '(empty)'}\n`;
                    });
                }

                if (modal.actions && modal.actions.length > 0) {
                    context += '\nAvailable Actions: ' + modal.actions.join(', ') + '\n';
                }
            });
            context += '\n=== END OF POPUPS/MODALS ===\n\n';
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