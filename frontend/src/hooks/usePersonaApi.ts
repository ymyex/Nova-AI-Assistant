import { useState, useCallback } from 'react';
import {
    apiFetch,
    encodeJid,
    ApiError,
    transformStyleProfile,
    transformCategory,
    transformPersonalInfo,
    transformChatAutoResponseConfig,
    transformPendingApproval,
    transformResponseLogEntry,
    transformGlobalAutoResponseSettings
} from '../utils/api';
import type {
    StyleProfile,
    StyleProfileFull,
    StyleProfileUpdate,
    StyleProfileListResponse,
    AvailableChat,
    AvailableChatsResponse,
    PersonalInfo,
    PersonalInfoUpdate,
    PersonalInfoListResponse,
    PersonalInfoSearchResponse,
    Category,
    CategoryCreate,
    CategoryUpdate,
    CategoriesResponse,
    GlobalAutoResponseSettings,
    ChatAutoResponseConfig,
    ChatConfigUpdate,
    ChatConfigsResponse,
    ResponseLogEntry,
    ResponseHistoryFilters,
    ResponseHistoryResponse,
    PendingApprovalsResponse,
    ApprovalResult,
    BatchJob,
    BatchStartResponse,
} from '../types/persona';

const BASE_URL = '/api/persona';

export interface UsePersonaApiReturn {
    // Loading states
    isLoading: boolean;
    error: string | null;
    clearError: () => void;

    // Style Profiles
    fetchProfiles: (search?: string, limit?: number, offset?: number) => Promise<StyleProfileListResponse>;
    fetchAvailableChats: (search?: string, minMessages?: number) => Promise<AvailableChatsResponse>;
    fetchProfile: (chatJid: string) => Promise<StyleProfileFull>;
    generateProfile: (chatJid: string, force?: boolean) => Promise<StyleProfile>;
    generateAllProfiles: (overwriteExisting?: boolean, minMessageCount?: number) => Promise<BatchStartResponse>;
    getBatchStatus: () => Promise<BatchJob>;
    updateProfile: (chatJid: string, updates: StyleProfileUpdate) => Promise<StyleProfile>;
    deleteProfile: (chatJid: string) => Promise<void>;

    // Personal Info
    fetchPersonalInfo: (category?: string, limit?: number, offset?: number) => Promise<PersonalInfoListResponse>;
    searchPersonalInfo: (query: string, limit?: number) => Promise<PersonalInfoSearchResponse>;
    addPersonalInfo: (text: string) => Promise<PersonalInfo>;
    updatePersonalInfo: (id: string, updates: PersonalInfoUpdate) => Promise<PersonalInfo>;
    deletePersonalInfo: (id: string) => Promise<void>;

    // Categories
    fetchCategories: () => Promise<CategoriesResponse>;
    createCategory: (data: CategoryCreate) => Promise<Category>;
    updateCategory: (id: string, updates: CategoryUpdate) => Promise<Category>;
    deleteCategory: (id: string, reassignTo?: string) => Promise<void>;

    // Auto-Response Config
    fetchGlobalSettings: () => Promise<GlobalAutoResponseSettings>;
    updateGlobalSettings: (settings: Partial<GlobalAutoResponseSettings>) => Promise<GlobalAutoResponseSettings>;
    fetchChatConfigs: () => Promise<ChatConfigsResponse>;
    fetchChatConfig: (chatJid: string) => Promise<ChatAutoResponseConfig>;
    updateChatConfig: (chatJid: string, config: ChatConfigUpdate) => Promise<ChatAutoResponseConfig>;

    // Response History
    fetchResponseHistory: (filters?: ResponseHistoryFilters) => Promise<ResponseHistoryResponse>;
    fetchResponseDetail: (id: string) => Promise<ResponseLogEntry>;

    // Pending Approvals
    fetchPendingApprovals: () => Promise<PendingApprovalsResponse>;
    approveResponse: (id: string, customResponse?: string) => Promise<ApprovalResult>;
    rejectResponse: (id: string, reason?: string) => Promise<ApprovalResult>;
}

export function usePersonaApi(): UsePersonaApiReturn {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const clearError = useCallback(() => setError(null), []);

    // Wrapper for API calls with loading/error handling
    const apiCall = useCallback(async <T>(fn: () => Promise<T>): Promise<T> => {
        setIsLoading(true);
        setError(null);
        try {
            return await fn();
        } catch (err) {
            const message = err instanceof ApiError ? err.message : 'An unexpected error occurred';
            setError(message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    // ==========================================================================
    // Style Profiles
    // ==========================================================================

    const fetchProfiles = useCallback(async (
        search?: string,
        limit = 20,
        offset = 0
    ): Promise<StyleProfileListResponse> => {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        params.set('limit', String(limit));
        params.set('offset', String(offset));
        return apiCall(async () => {
            const response = await apiFetch<{ profiles: Record<string, unknown>[]; total: number; limit: number; offset: number }>(`${BASE_URL}/style-profiles?${params}`);
            // Transform each profile from snake_case to camelCase
            const transformedProfiles = response.profiles.map(p => transformStyleProfile(p) as unknown as StyleProfile);
            return {
                profiles: transformedProfiles,
                total: response.total,
                limit: response.limit,
                offset: response.offset
            };
        });
    }, [apiCall]);

    const fetchAvailableChats = useCallback(async (
        search?: string,
        minMessages = 10
    ): Promise<{ chats: AvailableChat[]; total: number }> => {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        params.set('min_messages', String(minMessages));
        return apiCall(async () => {
            const response = await apiFetch<{ chats: Record<string, unknown>[]; total: number }>(`${BASE_URL}/style-profiles/available-chats?${params}`);
            // Transform each chat from snake_case to camelCase
            const transformedChats = (response.chats || []).map(c => ({
                chatJid: c.chat_jid as string,
                contactName: (c.contact_name as string) || (c.chat_jid as string).split('@')[0],
                messageCount: (c.message_count as number) || 0,
                hasProfile: Boolean(c.has_profile)
            }));
            return {
                chats: transformedChats,
                total: response.total
            };
        });
    }, [apiCall]);

    const fetchProfile = useCallback(async (chatJid: string): Promise<StyleProfileFull> => {
        return apiCall(async () => {
            const response = await apiFetch<Record<string, unknown>>(`${BASE_URL}/style-profiles/${encodeJid(chatJid)}`);
            const base = transformStyleProfile(response) as unknown as StyleProfile;
            // Include the raw profile_data for the detail page
            return {
                ...base,
                profileData: (response.profile_data as Record<string, unknown>) || {}
            } as StyleProfileFull;
        });
    }, [apiCall]);

    const generateProfile = useCallback(async (chatJid: string, force = false): Promise<StyleProfile> => {
        return apiCall(async () => {
            const response = await apiFetch<Record<string, unknown>>(`${BASE_URL}/style-profiles/generate`, {
                method: 'POST',
                body: JSON.stringify({ chat_jid: chatJid, force })
            });
            return transformStyleProfile(response) as unknown as StyleProfile;
        });
    }, [apiCall]);

    const generateAllProfiles = useCallback(async (
        overwriteExisting = false,
        minMessageCount = 50
    ): Promise<BatchStartResponse> => {
        return apiCall(() => apiFetch(`${BASE_URL}/style-profiles/generate-all`, {
            method: 'POST',
            body: JSON.stringify({
                overwrite_existing: overwriteExisting,
                min_message_count: minMessageCount
            })
        }));
    }, [apiCall]);

    const getBatchStatus = useCallback(async (): Promise<BatchJob> => {
        return apiCall(() => apiFetch(`${BASE_URL}/style-profiles/generate-status`));
    }, [apiCall]);

    const updateProfile = useCallback(async (
        chatJid: string,
        updates: StyleProfileUpdate
    ): Promise<StyleProfile> => {
        return apiCall(() => apiFetch(`${BASE_URL}/style-profiles/${encodeJid(chatJid)}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        }));
    }, [apiCall]);

    const deleteProfile = useCallback(async (chatJid: string): Promise<void> => {
        return apiCall(() => apiFetch(`${BASE_URL}/style-profiles/${encodeJid(chatJid)}`, {
            method: 'DELETE'
        }));
    }, [apiCall]);

    // ==========================================================================
    // Personal Info
    // ==========================================================================

    const fetchPersonalInfo = useCallback(async (
        category?: string,
        limit = 50,
        offset = 0
    ): Promise<PersonalInfoListResponse> => {
        const params = new URLSearchParams();
        if (category) params.set('category', category);
        params.set('limit', String(limit));
        params.set('offset', String(offset));
        return apiCall(async () => {
            const response = await apiFetch<{ entries: Record<string, unknown>[]; total: number; limit: number; offset: number }>(`${BASE_URL}/personal-info?${params}`);
            // Transform each entry from snake_case to camelCase, and rename entries to items
            const transformedItems = (response.entries || []).map(e => transformPersonalInfo(e) as unknown as PersonalInfo);
            return {
                items: transformedItems,
                total: response.total,
                limit: response.limit,
                offset: response.offset
            };
        });
    }, [apiCall]);

    const searchPersonalInfo = useCallback(async (
        query: string,
        limit = 20
    ): Promise<PersonalInfoSearchResponse> => {
        const params = new URLSearchParams();
        params.set('q', query);
        params.set('limit', String(limit));
        return apiCall(async () => {
            const response = await apiFetch<{ results: Record<string, unknown>[]; total: number; query: string }>(`${BASE_URL}/personal-info/search?${params}`);
            // Transform each result from snake_case to camelCase
            const transformedResults = (response.results || []).map(r => {
                const base = transformPersonalInfo(r) as Record<string, unknown>;
                return {
                    ...base,
                    relevanceScore: (r.relevance_score as number) ?? (r.score as number) ?? 0
                };
            }) as unknown as PersonalInfoSearchResponse['results'];
            return {
                results: transformedResults,
                total: response.total,
                query: response.query
            };
        });
    }, [apiCall]);

    const addPersonalInfo = useCallback(async (text: string): Promise<PersonalInfo> => {
        return apiCall(() => apiFetch(`${BASE_URL}/personal-info`, {
            method: 'POST',
            body: JSON.stringify({ text })
        }));
    }, [apiCall]);

    const updatePersonalInfo = useCallback(async (
        id: string,
        updates: PersonalInfoUpdate
    ): Promise<PersonalInfo> => {
        return apiCall(() => apiFetch(`${BASE_URL}/personal-info/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        }));
    }, [apiCall]);

    const deletePersonalInfo = useCallback(async (id: string): Promise<void> => {
        return apiCall(() => apiFetch(`${BASE_URL}/personal-info/${id}`, {
            method: 'DELETE'
        }));
    }, [apiCall]);

    // ==========================================================================
    // Categories
    // ==========================================================================

    const fetchCategories = useCallback(async (): Promise<CategoriesResponse> => {
        return apiCall(async () => {
            const rawCategories = await apiFetch<Record<string, unknown>[]>(`${BASE_URL}/categories`);
            // Backend returns array directly with snake_case, use shared transform function
            const categories = (rawCategories || []).map(c => transformCategory(c) as unknown as Category);
            return { categories };
        });
    }, [apiCall]);

    const createCategory = useCallback(async (data: CategoryCreate): Promise<Category> => {
        return apiCall(() => apiFetch(`${BASE_URL}/categories`, {
            method: 'POST',
            body: JSON.stringify(data)
        }));
    }, [apiCall]);

    const updateCategory = useCallback(async (
        id: string,
        updates: CategoryUpdate
    ): Promise<Category> => {
        return apiCall(() => apiFetch(`${BASE_URL}/categories/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(updates)
        }));
    }, [apiCall]);

    const deleteCategory = useCallback(async (
        id: string,
        reassignTo?: string
    ): Promise<void> => {
        const params = reassignTo ? `?reassign_to=${reassignTo}` : '';
        return apiCall(() => apiFetch(`${BASE_URL}/categories/${id}${params}`, {
            method: 'DELETE'
        }));
    }, [apiCall]);

    // ==========================================================================
    // Auto-Response Config
    // ==========================================================================

    const fetchGlobalSettings = useCallback(async (): Promise<GlobalAutoResponseSettings> => {
        return apiCall(async () => {
            const response = await apiFetch<Record<string, unknown>>(`${BASE_URL}/auto-response/settings`);
            return transformGlobalAutoResponseSettings(response) as unknown as GlobalAutoResponseSettings;
        });
    }, [apiCall]);

    const updateGlobalSettings = useCallback(async (
        settings: Partial<GlobalAutoResponseSettings>
    ): Promise<GlobalAutoResponseSettings> => {
        return apiCall(async () => {
            const response = await apiFetch<Record<string, unknown>>(`${BASE_URL}/auto-response/settings`, {
                method: 'PUT',
                body: JSON.stringify(settings)
            });
            return transformGlobalAutoResponseSettings(response) as unknown as GlobalAutoResponseSettings;
        });
    }, [apiCall]);

    const fetchChatConfigs = useCallback(async (): Promise<ChatConfigsResponse> => {
        return apiCall(async () => {
            const response = await apiFetch<{ configs: Record<string, unknown>[] }>(`${BASE_URL}/auto-response/configs`);
            // Transform each config from snake_case to camelCase
            const transformedConfigs = (response.configs || []).map(c => transformChatAutoResponseConfig(c) as unknown as ChatAutoResponseConfig);
            return {
                configs: transformedConfigs
            };
        });
    }, [apiCall]);

    const fetchChatConfig = useCallback(async (chatJid: string): Promise<ChatAutoResponseConfig> => {
        return apiCall(() => apiFetch(`${BASE_URL}/auto-response/configs/${encodeJid(chatJid)}`));
    }, [apiCall]);

    const updateChatConfig = useCallback(async (
        chatJid: string,
        config: ChatConfigUpdate
    ): Promise<ChatAutoResponseConfig> => {
        return apiCall(() => apiFetch(`${BASE_URL}/auto-response/configs/${encodeJid(chatJid)}`, {
            method: 'PUT',
            body: JSON.stringify(config)
        }));
    }, [apiCall]);

    // ==========================================================================
    // Response History
    // ==========================================================================

    const fetchResponseHistory = useCallback(async (
        filters?: ResponseHistoryFilters
    ): Promise<ResponseHistoryResponse> => {
        const params = new URLSearchParams();
        if (filters?.status) params.set('status', filters.status);
        if (filters?.chatJid) params.set('chat_jid', filters.chatJid);
        if (filters?.fromDate) params.set('from_date', filters.fromDate);
        if (filters?.toDate) params.set('to_date', filters.toDate);
        params.set('limit', String(filters?.limit || 50));
        params.set('offset', String(filters?.offset || 0));
        return apiCall(async () => {
            const response = await apiFetch<{ responses: Record<string, unknown>[]; total: number; limit: number; offset: number }>(`${BASE_URL}/auto-response/history/${encodeJid(filters?.chatJid || 'all')}?${params}`);
            // Transform each response from snake_case to camelCase
            const transformedResponses = (response.responses || []).map(r => transformResponseLogEntry(r) as unknown as ResponseLogEntry);
            return {
                responses: transformedResponses,
                total: response.total,
                limit: response.limit,
                offset: response.offset
            };
        });
    }, [apiCall]);

    const fetchResponseDetail = useCallback(async (id: string): Promise<ResponseLogEntry> => {
        // Response detail is fetched from the history endpoint with the log ID
        return apiCall(() => apiFetch(`${BASE_URL}/auto-response/approvals/${id}`));
    }, [apiCall]);

    // ==========================================================================
    // Pending Approvals
    // ==========================================================================

    const fetchPendingApprovals = useCallback(async (): Promise<PendingApprovalsResponse> => {
        return apiCall(async () => {
            const response = await apiFetch<{ approvals: Record<string, unknown>[]; count?: number; total?: number }>(`${BASE_URL}/auto-response/approvals`);
            // Transform each approval from snake_case to camelCase
            const transformedApprovals = (response.approvals || []).map(a => transformPendingApproval(a));
            return {
                approvals: transformedApprovals,
                total: response.count ?? response.total ?? transformedApprovals.length
            } as unknown as PendingApprovalsResponse;
        });
    }, [apiCall]);

    const approveResponse = useCallback(async (
        id: string,
        customResponse?: string
    ): Promise<ApprovalResult> => {
        return apiCall(() => apiFetch(`${BASE_URL}/auto-response/approvals/${id}`, {
            method: 'POST',
            body: JSON.stringify(
                customResponse
                    ? { action: 'custom', custom_response: customResponse }
                    : { action: 'approve' }
            )
        }));
    }, [apiCall]);

    const rejectResponse = useCallback(async (
        id: string,
        reason?: string
    ): Promise<ApprovalResult> => {
        return apiCall(() => apiFetch(`${BASE_URL}/auto-response/approvals/${id}`, {
            method: 'POST',
            body: JSON.stringify({ action: 'reject', reason })
        }));
    }, [apiCall]);

    return {
        isLoading,
        error,
        clearError,

        // Style Profiles
        fetchProfiles,
        fetchAvailableChats,
        fetchProfile,
        generateProfile,
        generateAllProfiles,
        getBatchStatus,
        updateProfile,
        deleteProfile,

        // Personal Info
        fetchPersonalInfo,
        searchPersonalInfo,
        addPersonalInfo,
        updatePersonalInfo,
        deletePersonalInfo,

        // Categories
        fetchCategories,
        createCategory,
        updateCategory,
        deleteCategory,

        // Auto-Response Config
        fetchGlobalSettings,
        updateGlobalSettings,
        fetchChatConfigs,
        fetchChatConfig,
        updateChatConfig,

        // Response History
        fetchResponseHistory,
        fetchResponseDetail,

        // Pending Approvals
        fetchPendingApprovals,
        approveResponse,
        rejectResponse,
    };
}

// Re-export types for convenience
export type { StyleProfileFull } from '../types/persona';
