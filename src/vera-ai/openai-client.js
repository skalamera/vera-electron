const config = require('./config');

class OpenAIClient {
    constructor(apiKey) {
        this.apiKey = apiKey || config.openai.apiKey;
        this.model = config.openai.model;
        this.baseURL = 'https://api.openai.com/v1';
    }

    async sendMessage(messages, pageContext = '') {
        try {
            // Prepare the messages array with system prompt and context
            const systemMessage = {
                role: 'system',
                content: config.openai.systemPrompt +
                    (pageContext ? `\n\nCurrent page content:\n${pageContext}` : '')
            };

            const allMessages = [systemMessage, ...messages];

            const response = await fetch(`${this.baseURL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: allMessages,
                    max_tokens: config.openai.maxTokens,
                    temperature: config.openai.temperature,
                    stream: true
                })
            });

            if (!response.ok) {
                throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
            }

            return response;
        } catch (error) {
            console.error('Error sending message to OpenAI:', error);
            throw error;
        }
    }

    async *streamResponse(response) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

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
                                yield content;
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
}

module.exports = OpenAIClient; 