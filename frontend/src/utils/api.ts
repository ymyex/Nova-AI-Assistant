/**
 * API Utility Functions for CODA AI Frontend
 */

/**
 * URL-encode a WhatsApp JID for use in API paths.
 * Example: "+96560979542@s.whatsapp.net" -> "%2B96560979542%40s.whatsapp.net"
 */
export function encodeJid(jid: string): string {
    return encodeURIComponent(jid);
}

/**
 * API Error class with status code and details
 */
export class ApiError extends Error {
    status: number;
    details?: unknown;

    constructor(message: string, status: number, details?: unknown) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.details = details;
    }
}

/**
 * Generic fetch wrapper with error handling.
 */
export async function apiFetch<T>(
    url: string,
    options?: RequestInit
): Promise<T> {
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers
        }
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new ApiError(
            error.message || error.detail || `Request failed: ${response.status}`,
            response.status,
            error.details || error
        );
    }

    // Handle 204 No Content
    if (response.status === 204) {
        return {} as T;
    }

    return response.json();
}

/**
 * Format a date string for display
 */
export function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // Less than 1 minute
    if (diff < 60000) {
        return 'Just now';
    }

    // Less than 1 hour
    if (diff < 3600000) {
        const mins = Math.floor(diff / 60000);
        return `${mins}m ago`;
    }

    // Less than 24 hours
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours}h ago`;
    }

    // Less than 7 days
    if (diff < 604800000) {
        const days = Math.floor(diff / 86400000);
        return `${days}d ago`;
    }

    // Format as date
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
}

/**
 * Format time remaining for countdown
 */
export function formatTimeRemaining(seconds: number): string {
    if (seconds <= 0) return 'Expired';

    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;

    if (mins === 0) {
        return `${secs}s`;
    }

    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
}

/**
 * Extract display name from JID
 */
export function extractPhoneFromJid(jid: string): string {
    // Remove @s.whatsapp.net or @lid suffix
    const phone = jid.split('@')[0];
    // Format the phone number if it starts with a country code
    if (phone.length > 10) {
        return `+${phone}`;
    }
    return phone;
}

/**
 * Transform backend style profile response (snake_case) to frontend format (camelCase).
 * Also handles type mismatches (strings to arrays/numbers).
 *
 * The backend returns profiles with a nested `profile_data` field containing the
 * full Gemini analysis response with structure like:
 * - languages: { primary: string, secondary: string[], ... }
 * - emoji_usage: { frequency: string, favorites: string[], ... }
 * - tone: { overall: string, formality_level: number, ... }
 * - greetings: { openers: string[], closers: string[], ... }
 * - vocabulary: { frequent_words: string[], ... }
 */
export function transformStyleProfile(raw: Record<string, unknown>): Record<string, unknown> {
    // Get profile_data which contains the detailed Gemini analysis
    const profileData = raw.profile_data as Record<string, unknown> | undefined;

    // Extract emoji frequency as a number (0-1)
    let emojiFrequency = 0.5;
    const rawEmoji = raw.emoji_frequency;
    if (typeof rawEmoji === 'number') {
        emojiFrequency = rawEmoji;
    } else if (typeof rawEmoji === 'string') {
        // Convert string labels to numbers
        const emojiMap: Record<string, number> = {
            'none': 0, 'minimal': 0.2, 'rare': 0.2, 'light': 0.3, 'moderate': 0.5,
            'heavy': 0.7, 'frequent': 0.8, 'excessive': 1.0, 'unknown': 0.5
        };
        emojiFrequency = emojiMap[rawEmoji.toLowerCase()] ?? 0.5;
    }
    // Also check profile_data.emoji_usage.frequency
    if (profileData) {
        const emojiUsage = profileData.emoji_usage as Record<string, unknown> | undefined;
        if (emojiUsage?.frequency) {
            const freq = String(emojiUsage.frequency).toLowerCase();
            const emojiMap: Record<string, number> = {
                'none': 0, 'minimal': 0.2, 'rare': 0.2, 'light': 0.3, 'moderate': 0.5,
                'heavy': 0.7, 'frequent': 0.8, 'excessive': 1.0, 'unknown': 0.5
            };
            emojiFrequency = emojiMap[freq] ?? 0.5;
        }
    }

    // Extract formality level as a number (0-1)
    let formalityLevel = 0.5;
    const rawTone = raw.tone;
    if (typeof rawTone === 'number') {
        formalityLevel = rawTone;
    } else if (typeof rawTone === 'string') {
        const toneMap: Record<string, number> = {
            'casual': 0.2, 'informal': 0.3, 'neutral': 0.5, 'mixed': 0.5,
            'formal': 0.8, 'professional': 0.9, 'unknown': 0.5
        };
        formalityLevel = toneMap[rawTone.toLowerCase()] ?? 0.5;
    }
    // Also check profile_data.tone
    if (profileData) {
        const tone = profileData.tone as Record<string, unknown> | undefined;
        if (tone) {
            // Check formality_level (1-5 scale) or overall
            if (typeof tone.formality_level === 'number') {
                formalityLevel = (tone.formality_level as number) / 5; // Convert 1-5 to 0-1
            } else if (typeof tone.overall === 'string') {
                const toneMap: Record<string, number> = {
                    'casual': 0.2, 'informal': 0.3, 'neutral': 0.5, 'mixed': 0.5,
                    'formal': 0.8, 'professional': 0.9
                };
                formalityLevel = toneMap[tone.overall.toLowerCase()] ?? 0.5;
            }
        }
    }

    // Extract languages as an array
    let languagePreferences: string[] = [];
    const rawLangs = raw.languages;
    if (Array.isArray(rawLangs)) {
        languagePreferences = rawLangs;
    } else if (typeof rawLangs === 'string' && rawLangs !== 'unknown') {
        languagePreferences = [rawLangs];
    }
    // Also check profile_data.languages
    if (profileData) {
        const langs = profileData.languages as Record<string, unknown> | string[] | undefined;
        if (Array.isArray(langs)) {
            languagePreferences = langs as string[];
        } else if (typeof langs === 'object' && langs !== null) {
            const langObj = langs as Record<string, unknown>;
            const result: string[] = [];
            if (langObj.primary) result.push(String(langObj.primary));
            if (Array.isArray(langObj.secondary)) {
                result.push(...(langObj.secondary as string[]));
            }
            if (result.length > 0) languagePreferences = result;
        }
    }

    // Extract greetings (openers) from profile_data
    let commonGreetings: string[] = [];
    if (profileData) {
        const greetings = profileData.greetings as Record<string, unknown> | undefined;
        if (greetings?.openers && Array.isArray(greetings.openers)) {
            commonGreetings = greetings.openers as string[];
        }
    }

    // Extract closings from profile_data
    let commonClosings: string[] = [];
    if (profileData) {
        const greetings = profileData.greetings as Record<string, unknown> | undefined;
        if (greetings?.closers && Array.isArray(greetings.closers)) {
            commonClosings = greetings.closers as string[];
        }
    }

    // Extract vocabulary patterns from profile_data
    let vocabularyPatterns: string[] = [];
    if (profileData) {
        const vocab = profileData.vocabulary as Record<string, unknown> | undefined;
        if (vocab) {
            const patterns: string[] = [];
            if (Array.isArray(vocab.frequent_words)) {
                patterns.push(...(vocab.frequent_words as string[]).slice(0, 5));
            }
            if (Array.isArray(vocab.unique_expressions)) {
                patterns.push(...(vocab.unique_expressions as string[]).slice(0, 5));
            }
            if (Array.isArray(vocab.filler_words)) {
                patterns.push(...(vocab.filler_words as string[]).slice(0, 3));
            }
            vocabularyPatterns = patterns;
        }
    }

    // Extract average message length
    let avgMessageLength = 50;
    if (profileData) {
        const msgPatterns = profileData.message_patterns as Record<string, unknown> | undefined;
        if (msgPatterns?.average_length) {
            const lengthMap: Record<string, number> = {
                'very_short': 15, 'short': 30, 'medium': 60, 'long': 120
            };
            avgMessageLength = lengthMap[String(msgPatterns.average_length).toLowerCase()] ?? 50;
        }
    }

    // Extract response time pattern from metadata or voice patterns
    let responseTimePattern = 'variable';
    if (profileData) {
        const metadata = profileData.metadata as Record<string, unknown> | undefined;
        if (metadata?.interaction_frequency) {
            const freqMap: Record<string, string> = {
                'daily': 'quick', 'weekly': 'delayed', 'monthly': 'delayed', 'rare': 'delayed'
            };
            responseTimePattern = freqMap[String(metadata.interaction_frequency).toLowerCase()] ?? 'variable';
        }
    }

    return {
        chatJid: raw.chat_jid ?? '',
        contactName: raw.contact_name ?? 'Unknown',
        formalityLevel,
        emojiFrequency,
        avgMessageLength,
        commonGreetings,
        commonClosings,
        vocabularyPatterns,
        responseTimePattern,
        languagePreferences,
        createdAt: (raw.created_at as string) ?? new Date().toISOString(),
        updatedAt: (raw.updated_at ?? raw.last_analyzed) as string ?? new Date().toISOString(),
        messageCountAnalyzed: (raw.message_count as number) ?? 0
    };
}

/**
 * Transform backend category response (snake_case) to frontend format (camelCase).
 * Handles integer booleans (0|1) and missing fields.
 */
export function transformCategory(raw: Record<string, unknown>): Record<string, unknown> {
    return {
        id: raw.id ?? '',
        name: raw.name ?? '',
        description: (raw.description as string) ?? '',
        isSensitive: Boolean(raw.is_sensitive),
        isSystem: Boolean(raw.is_system),
        subcategories: (raw.subcategories as string[]) ?? [],
        // Backend may return entry_count or item_count, fallback to 0
        itemCount: (raw.entry_count as number) ?? (raw.item_count as number) ?? 0
    };
}

/**
 * Transform backend personal info response (snake_case) to frontend format (camelCase).
 */
export function transformPersonalInfo(raw: Record<string, unknown>): Record<string, unknown> {
    return {
        id: raw.id ?? '',
        category: (raw.category_name as string) ?? (raw.category as string) ?? '',
        subcategory: raw.subcategory ?? null,
        content: (raw.content as string) ?? '',
        keywords: (raw.keywords as string[]) ?? [],
        source: (raw.source as string) ?? 'manual',
        transcription: raw.transcription as string | undefined,
        createdAt: (raw.created_at as string) ?? new Date().toISOString(),
        updatedAt: (raw.updated_at as string) ?? new Date().toISOString(),
        // Additional fields from backend
        categoryId: raw.category_id,
        categoryIcon: raw.category_icon,
        isSensitive: Boolean(raw.is_sensitive),
        confidence: raw.confidence
    };
}

/**
 * Transform backend auto-response chat config (snake_case) to frontend format (camelCase).
 */
export function transformChatAutoResponseConfig(raw: Record<string, unknown>): Record<string, unknown> {
    return {
        chatJid: raw.chat_jid ?? '',
        contactName: (raw.chat_name as string) ?? (raw.contact_name as string) ?? 'Unknown',
        enabled: Boolean(raw.enabled),
        confidenceThreshold: (raw.confidence_threshold as number) ?? 0.85,
        usesDefaultThreshold: raw.uses_default_threshold !== false,
        allowedCategories: raw.allowed_categories as string[] | undefined,
        blockedCategories: raw.blocked_categories as string[] | undefined,
        totalResponses: (raw.total_responses as number) ?? 0,
        approvedResponses: raw.approved_responses as number | undefined,
        rejectedResponses: raw.rejected_responses as number | undefined,
        lastResponseAt: raw.last_response_at as string | null,
        createdAt: raw.created_at as string,
        updatedAt: raw.updated_at as string
    };
}

/**
 * Transform backend pending approval (snake_case) to frontend format (camelCase).
 */
export function transformPendingApproval(raw: Record<string, unknown>): Record<string, unknown> {
    // Calculate time remaining from expires_at
    const expiresAt = raw.expires_at as string;
    let timeRemainingSeconds = 0;
    if (expiresAt) {
        const expiresTime = new Date(expiresAt).getTime();
        const now = Date.now();
        timeRemainingSeconds = Math.max(0, Math.floor((expiresTime - now) / 1000));
    }

    return {
        id: raw.id ?? '',
        chatJid: raw.chat_jid ?? '',
        contactName: (raw.contact_name as string) ?? (raw.chat_name as string) ?? 'Unknown',
        incomingMessage: (raw.incoming_message as string) ?? '',
        generatedResponse: (raw.generated_response as string) ?? '',
        confidenceScore: (raw.confidence_score as number) ?? 0,
        confidenceReasons: (raw.confidence_reasons as string[]) ?? [],
        reasonForReview: (raw.reason_for_review as string) ?? '',
        categoriesInvolved: (raw.categories_involved as string[]) ?? [],
        createdAt: (raw.created_at as string) ?? new Date().toISOString(),
        expiresAt: expiresAt ?? new Date().toISOString(),
        timeRemainingSeconds
    };
}

/**
 * Transform backend response log entry (snake_case) to frontend format (camelCase).
 */
export function transformResponseLogEntry(raw: Record<string, unknown>): Record<string, unknown> {
    return {
        id: raw.id ?? '',
        chatJid: raw.chat_jid ?? '',
        contactName: (raw.contact_name as string) ?? 'Unknown',
        incomingMessage: (raw.incoming_message as string) ?? '',
        generatedResponse: (raw.generated_response as string) ?? '',
        finalResponse: raw.final_response as string | undefined,
        confidenceScore: (raw.confidence_score as number) ?? 0,
        confidenceReasons: (raw.confidence_reasons as string[]) ?? [],
        action: (raw.action as string) ?? 'sent_auto',
        status: (raw.status as string) ?? 'sent',
        categoriesUsed: (raw.categories_used as string[]) ?? [],
        personalInfoUsed: (raw.personal_info_used as unknown[]) ?? [],
        styleProfileUsed: raw.style_profile_used,
        decisionReasoning: raw.decision_reasoning as string | undefined,
        createdAt: (raw.created_at as string) ?? new Date().toISOString(),
        sentAt: raw.sent_at as string | null,
        responseTimeMs: raw.response_time_ms as number | undefined
    };
}

/**
 * Transform backend global auto-response settings to frontend format.
 * The backend returns camelCase but may be missing some fields like quietHours.
 */
export function transformGlobalAutoResponseSettings(raw: Record<string, unknown>): Record<string, unknown> {
    // Extract quietHours or provide default
    const quietHoursRaw = raw.quietHours as Record<string, unknown> | undefined;
    const quietHours = {
        enabled: Boolean(quietHoursRaw?.enabled ?? false),
        start: (quietHoursRaw?.start as string) ?? '22:00',
        end: (quietHoursRaw?.end as string) ?? '08:00'
    };

    return {
        enabled: Boolean(raw.enabled ?? false),
        defaultThreshold: (raw.defaultThreshold as number) ?? (raw.default_threshold as number) ?? 0.75,
        maxResponsesPerHour: (raw.maxResponsesPerHour as number) ?? (raw.max_responses_per_hour as number) ?? 60,
        approvalTimeoutMinutes: (raw.approvalTimeoutMinutes as number) ?? 5,
        maxPendingApprovals: (raw.maxPendingApprovals as number) ?? 10,
        quietHours
    };
}


