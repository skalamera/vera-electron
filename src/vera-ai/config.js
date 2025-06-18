// Vera AI Configuration
const config = {
    // OpenAI Configuration
    openai: {
        apiKey: process.env.OPENAI_API_KEY || '', // Will be set from settings
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        maxTokens: 2000,
        temperature: 0.7,
        systemPrompt: `You are Vera, a helpful AI assistant integrated into the Vera Desktop application. 
You have access to the content of the webpage the user is currently viewing. 
When users ask questions, you should consider the page context and provide relevant, helpful answers.
Be conversational, friendly, and concise in your responses.`
    },

    // Widget Configuration
    widget: {
        position: 'bottom-right',
        size: {
            collapsed: { width: 60, height: 60 },
            expanded: { width: 380, height: 500 }
        },
        animation: {
            duration: 300,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
        }
    },

    // Content Extraction Configuration
    contentExtraction: {
        maxLength: 10000, // Maximum characters to extract from page
        selectors: {
            // Priority selectors for main content
            article: 'article, main, [role="main"], #main-content, .main-content',
            headings: 'h1, h2, h3, h4, h5, h6',
            paragraphs: 'p',
            lists: 'ul, ol',
            // Exclude selectors
            exclude: 'script, style, nav, header, footer, aside, .ad, .advertisement, .sidebar'
        }
    }
};

module.exports = config; 