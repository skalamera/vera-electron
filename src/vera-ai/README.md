# Vera AI Assistant

Vera is an intelligent, page-context aware AI assistant integrated into Vera Desktop. It helps users navigate and understand web content across all pods and the main application.

## Features

- **Page Context Awareness**: Vera can understand and reference the content of the webpage you're currently viewing
- **Floating Widget**: Accessible via a floating button on all pages and pods
- **Real-time Streaming**: Responses stream in real-time for a smooth chat experience
- **Dark Theme Support**: Automatically adapts to your theme preference
- **Privacy Focused**: Automatically hides on sensitive pages (banking, payment sites)

## Setup

1. **Get an OpenAI API Key**
   - Visit [OpenAI Platform](https://platform.openai.com/api-keys)
   - Create a new API key
   - Copy the key (it starts with `sk-`)

2. **Configure Vera in Settings**
   - Open Vera Desktop
   - Go to Settings
   - Find the "Vera AI Assistant" section
   - Enable Vera AI
   - Paste your API key
   - Choose your preferred model (GPT-4 Turbo recommended)
   - Save settings

3. **Start Using Vera**
   - Look for the purple chat button in the bottom-right corner
   - Click to open the chat
   - Ask questions about the page content or general help

## Usage Examples

### On a webpage in a pod:
- "Summarize this article"
- "What are the main points discussed here?"
- "Explain this concept in simpler terms"
- "Find information about [specific topic] on this page"

### On the main Vera Desktop page:
- "How do I create a new pod?"
- "What's the difference between pods?"
- "How can I add Gmail to my work pod?"
- "Explain what Vera Desktop does"

## Privacy & Security

- Your API key is stored locally and never shared
- Page content is only sent to OpenAI when you actively chat with Vera
- Vera automatically disables itself on sensitive domains
- All conversations are ephemeral - no chat history is stored

## Troubleshooting

**Vera widget doesn't appear:**
- Check that Vera AI is enabled in settings
- Verify your API key is entered correctly
- Refresh the page/pod

**API errors:**
- Verify your OpenAI account has credits
- Check your API key is valid
- Ensure you have internet connection

**Context not working:**
- Some websites may block content extraction
- Try asking more specific questions
- Refresh the page and try again

## Technical Details

Vera uses:
- OpenAI's Chat Completions API with streaming
- Dynamic content extraction from webviews
- Isolated widget injection for security
- Real-time message passing between processes 