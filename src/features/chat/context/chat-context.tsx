'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface ChatContextType {
    messages: Message[];
    isLoading: boolean;
    sendMessage: (content: string) => Promise<void>;
    clearMessages: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const sendMessage = useCallback(async (content: string) => {
        try {
            setIsLoading(true);

            // Add user message
            const userMessage: Message = { role: 'user', content };
            setMessages(prev => [...prev, userMessage]);

            // Send message to main process
            const response = await window.veraAPI.sendChatMessage(content);

            // Add assistant message
            const assistantMessage: Message = { role: 'assistant', content: response };
            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Error sending message:', error);
            // Add error message
            const errorMessage: Message = {
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.'
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const clearMessages = useCallback(() => {
        setMessages([]);
    }, []);

    return (
        <ChatContext.Provider value={{ messages, isLoading, sendMessage, clearMessages }}>
            {children}
        </ChatContext.Provider>
    );
}

export function useChat() {
    const context = useContext(ChatContext);
    if (context === undefined) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
} 