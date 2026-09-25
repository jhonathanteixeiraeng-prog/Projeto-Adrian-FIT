'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ChatProvider } from '@/components/personal/chat/chat-context';
import { ConversationList } from '@/components/personal/chat/conversation-list';

/**
 * Inbox layout: on desktop the conversation list stays on the left while conversations open on the right,
 * so switching conversations never loses the list. On mobile it is one pane at a time.
 *
 * Height: fills the viewport under the personal shell (header 4rem + its paddings/bottom nav = 9rem),
 * so only the message pane scrolls.
 */
export default function ChatLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const match = pathname?.match(/^\/personal\/chat\/([^/]+)/);
    const activeStudentId = match ? decodeURIComponent(match[1]) : null;

    return (
        <ChatProvider>
            <div
                className="-m-4 flex min-h-[420px] overflow-hidden bg-card lg:m-0 lg:-mb-8 lg:rounded-2xl lg:border lg:border-border lg:shadow-soft"
                style={{ height: 'calc(100dvh - 9rem - env(safe-area-inset-bottom, 0px))' }}
            >
                <aside
                    className={cn(
                        'min-h-0 w-full shrink-0 flex-col border-border lg:flex lg:w-[340px] lg:border-r',
                        activeStudentId ? 'hidden' : 'flex'
                    )}
                >
                    <ConversationList activeStudentId={activeStudentId} />
                </aside>
                <section className={cn('min-h-0 min-w-0 flex-1 flex-col', activeStudentId ? 'flex' : 'hidden lg:flex')}>
                    {children}
                </section>
            </div>
        </ChatProvider>
    );
}
