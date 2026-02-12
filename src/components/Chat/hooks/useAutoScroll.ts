import { useCallback, useRef } from 'react';

interface UseAutoScrollOptions {
    /** Distance from bottom (in pixels) within which auto-scroll will trigger */
    threshold?: number;
}

interface UseAutoScrollReturn {
    /** Ref to attach to the scrollable container */
    containerRef: React.RefObject<HTMLDivElement | null>;
    /** Scroll to bottom of container */
    scrollToBottom: (animated?: boolean, force?: boolean) => void;
}

/**
 * Hook for managing auto-scroll behavior in a chat container.
 * Only scrolls when user is near the bottom, unless forced.
 */
export function useAutoScroll(options: UseAutoScrollOptions = {}): UseAutoScrollReturn {
    const { threshold = 150 } = options;
    const containerRef = useRef<HTMLDivElement | null>(null);

    const scrollToBottom = useCallback((animated: boolean = true, force: boolean = false) => {
        if (!containerRef.current) return;

        const container = containerRef.current;
        const targetScroll = container.scrollHeight - container.clientHeight;

        // Check if user is near the bottom - if not, don't auto-scroll unless forced
        const isNearBottom = container.scrollTop >= targetScroll - threshold;
        if (!isNearBottom && !force) {
            return;
        }

        if (!animated) {
            container.scrollTop = targetScroll;
            return;
        }

        // Quick scroll, not a long animation that fights user input
        container.scrollTo({
            top: targetScroll,
            behavior: 'smooth'
        });
    }, [threshold]);

    return {
        containerRef,
        scrollToBottom
    };
}
