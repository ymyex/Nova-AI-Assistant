import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch, transformPendingApproval } from '../utils/api';
import type { PendingApproval, ApprovalResult } from '../types/persona';

const BASE_URL = '/api/persona';

interface UsePendingApprovalsOptions {
    pollInterval?: number;  // Default: 10000 (10 seconds)
    enabled?: boolean;      // Default: true
}

interface UsePendingApprovalsReturn {
    approvals: PendingApproval[];
    count: number;
    isLoading: boolean;
    error: string | null;
    approve: (id: string, customResponse?: string) => Promise<ApprovalResult>;
    reject: (id: string, reason?: string) => Promise<ApprovalResult>;
    refresh: () => Promise<void>;
}

export function usePendingApprovals(
    options?: UsePendingApprovalsOptions
): UsePendingApprovalsReturn {
    const [approvals, setApprovals] = useState<PendingApproval[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const { pollInterval = 10000, enabled = true } = options || {};
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchApprovals = useCallback(async () => {
        try {
            const response = await apiFetch<{ approvals: Record<string, unknown>[]; total?: number; count?: number }>(
                `${BASE_URL}/auto-response/approvals`
            );
            // Transform each approval from snake_case to camelCase
            const transformedApprovals = (response.approvals || []).map(a => transformPendingApproval(a) as unknown as PendingApproval);
            setApprovals(transformedApprovals);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch approvals');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initial fetch and polling
    useEffect(() => {
        if (!enabled) {
            setApprovals([]);
            setIsLoading(false);
            return;
        }

        fetchApprovals();

        // Set up polling
        pollIntervalRef.current = setInterval(fetchApprovals, pollInterval);

        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }
        };
    }, [enabled, pollInterval, fetchApprovals]);

    // Update time remaining for each approval
    useEffect(() => {
        if (approvals.length === 0) return;

        const interval = setInterval(() => {
            setApprovals(prev => prev.map(approval => {
                const expiresAt = new Date(approval.expiresAt).getTime();
                const now = Date.now();
                const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
                return { ...approval, timeRemainingSeconds: remaining };
            }).filter(approval => approval.timeRemainingSeconds > 0));
        }, 1000);

        return () => clearInterval(interval);
    }, [approvals.length]);

    const approve = useCallback(async (
        id: string,
        customResponse?: string
    ): Promise<ApprovalResult> => {
        const result = await apiFetch<ApprovalResult>(
            `${BASE_URL}/auto-response/approvals/${id}`,
            {
                method: 'POST',
                body: JSON.stringify(
                    customResponse
                        ? { action: 'custom', custom_response: customResponse }
                        : { action: 'approve' }
                )
            }
        );
        // Remove from local state
        setApprovals(prev => prev.filter(a => a.id !== id));
        return result;
    }, []);

    const reject = useCallback(async (
        id: string,
        reason?: string
    ): Promise<ApprovalResult> => {
        const result = await apiFetch<ApprovalResult>(
            `${BASE_URL}/auto-response/approvals/${id}`,
            {
                method: 'POST',
                body: JSON.stringify({ action: 'reject', reason })
            }
        );
        // Remove from local state
        setApprovals(prev => prev.filter(a => a.id !== id));
        return result;
    }, []);

    return {
        approvals,
        count: approvals.length,
        isLoading,
        error,
        approve,
        reject,
        refresh: fetchApprovals
    };
}
