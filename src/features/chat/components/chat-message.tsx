'use client';

import { useChat } from '../context/chat-context';
import { cn } from '@/lib/utils';

interface ChatMessageProps {
    className?: string;
}

export function ChatMessage({ className }: ChatMessageProps) {
    const { messages, isLoading } = useChat();

    return (
        <div className={cn('flex flex-col gap-4', className)}>
            {messages.map((message, index) => (
                <div
                    key={index}
                    className={cn(
                        'flex items-start gap-4',
                        message.role === 'user' && 'flex-row-reverse'
                    )}
                >
                    <div
                        className={cn(
                            'flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md border shadow',
                            message.role === 'user'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                        )}
                    >
                        {message.role === 'user' ? 'U' : 'V'}
                    </div>
                    <div
                        className={cn(
                            'flex-1 space-y-2 overflow-hidden px-4',
                            message.role === 'user' && 'text-right'
                        )}
                    >
                        <div
                            className={cn(
                                'rounded-lg px-4 py-2',
                                message.role === 'user'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted'
                            )}
                        >
                            {message.content}
                        </div>
                    </div>
                </div>
            ))}
            {isLoading && (
                <div className="flex items-start gap-4">
                    <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md border shadow bg-muted">
                        V
                    </div>
                    <div className="flex-1 space-y-2 overflow-hidden px-4">
                        <div className="rounded-lg px-4 py-2 bg-muted">
                            <div className="flex gap-1">
                                <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />
                                <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:0.2s]" />
                                <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:0.4s]" />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
} 