/**
 * Persona Agent Type Definitions
 * Types for Style Profiles, Personal Info, Auto-Response, and Approvals
 */

// =============================================================================
// Style Profile Types
// =============================================================================

export interface StyleProfile {
    chatJid: string;
    contactName: string;
    formalityLevel: number;         // 0.0 (casual) to 1.0 (formal)
    emojiFrequency: number;         // 0.0 (none) to 1.0 (frequent)
    avgMessageLength: number;
    commonGreetings: string[];
    commonClosings: string[];
    vocabularyPatterns: string[];
    responseTimePattern: 'instant' | 'quick' | 'delayed' | 'variable';
    languagePreferences: string[];  // ISO 639-1 codes
    createdAt: string;              // ISO 8601
    updatedAt: string;              // ISO 8601
    messageCountAnalyzed: number;
}

export interface StyleProfileUpdate {
    formalityLevel?: number;
    emojiFrequency?: number;
    commonGreetings?: string[];
    commonClosings?: string[];
    vocabularyPatterns?: string[];
}

// Full profile data from Gemini analysis
export interface StyleProfileData {
    version?: string;
    languages?: {
        primary?: string;
        secondary?: string[];
        code_switching?: boolean;
        code_switching_pattern?: string;
    };
    dialect?: {
        region?: string;
        specific?: string;
        transliteration_style?: string;
        examples?: string[];
    };
    vocabulary?: {
        frequent_words?: string[];
        filler_words?: string[];
        intensifiers?: string[];
        unique_expressions?: string[];
    };
    greetings?: {
        openers?: string[];
        closers?: string[];
        time_based?: {
            morning?: string;
            evening?: string;
        };
    };
    emoji_usage?: {
        frequency?: string;
        favorites?: string[];
        patterns?: {
            laughing?: string;
            affection?: string;
            emphasis?: string;
        };
        sticker_usage?: string;
    };
    tone?: {
        overall?: string;
        formality_level?: number;
        humor_style?: string;
        emotional_expression?: string;
        directness?: string;
    };
    abbreviations?: {
        common?: Record<string, string>;
        contact_specific?: Record<string, string>;
    };
    message_patterns?: {
        average_length?: string;
        length_range?: string;
        sentence_structure?: string;
        punctuation?: string;
        capitalization?: string;
    };
    response_patterns?: {
        acknowledgments?: string[];
        agreements?: string[];
        disagreements?: string[];
    };
    topic_variations?: {
        work?: { tone?: string; language?: string };
        personal?: { tone?: string; language?: string };
        serious?: { tone?: string; language?: string };
    };
    voice_patterns?: {
        uses_voice_messages?: boolean;
        voice_frequency?: string;
        voice_characteristics?: string;
        typical_voice_content?: string;
    };
    media_sharing?: {
        shares_images?: boolean;
        shares_videos?: boolean;
        shares_documents?: boolean;
        image_types?: string[];
        media_with_captions?: string;
    };
    example_messages?: Array<{
        context?: string;
        message?: string;
        type?: string;
    }>;
    metadata?: {
        relationship_type?: string;
        interaction_frequency?: string;
        typical_topics?: string[];
        media_analyzed?: {
            text_count?: number;
            voice_count?: number;
            image_count?: number;
            video_count?: number;
            document_count?: number;
        };
    };
}

// Full style profile including raw profile data
export interface StyleProfileFull extends StyleProfile {
    profileData: StyleProfileData;
}

export interface StyleProfileListResponse {
    profiles: StyleProfile[];
    total: number;
    limit: number;
    offset: number;
}

export interface AvailableChat {
    chatJid: string;
    contactName: string;
    messageCount: number;
    hasProfile: boolean;
}

export interface AvailableChatsResponse {
    chats: AvailableChat[];
    total: number;
}

// =============================================================================
// Personal Information Types
// =============================================================================

export type InfoSource = 'manual' | 'voice' | 'extracted';

export interface PersonalInfo {
    id: string;
    category: string;
    subcategory: string | null;
    content: string;
    keywords: string[];
    source: InfoSource;
    transcription?: string;         // Only for voice entries
    createdAt: string;
    updatedAt: string;
}

export interface PersonalInfoCreate {
    text: string;
}

export interface PersonalInfoUpdate {
    content?: string;
    category?: string;
    subcategory?: string;
    keywords?: string[];
}

export interface PersonalInfoListResponse {
    items: PersonalInfo[];
    total: number;
    limit: number;
    offset: number;
}

export interface PersonalInfoSearchResult extends PersonalInfo {
    relevanceScore: number;
}

export interface PersonalInfoSearchResponse {
    results: PersonalInfoSearchResult[];
    total: number;
    query: string;
}

export interface ProcessedInfo {
    suggestedCategory: string;
    extractedFacts: string[];
    confidence: number;
}

// =============================================================================
// Category Types
// =============================================================================

export interface Category {
    id: string;
    name: string;
    description: string;
    isSensitive: boolean;
    isSystem: boolean;
    subcategories: string[];
    itemCount: number;
}

export interface CategoryCreate {
    name: string;
    description?: string;
    isSensitive?: boolean;
}

export interface CategoryUpdate {
    description?: string;
    isSensitive?: boolean;
}

export interface CategoriesResponse {
    categories: Category[];
}

// =============================================================================
// Auto-Response Configuration Types
// =============================================================================

export interface GlobalAutoResponseSettings {
    enabled: boolean;
    defaultThreshold: number;       // 0.0 to 1.0
    maxResponsesPerHour: number;
    quietHours: {
        enabled: boolean;
        start: string;              // HH:MM format
        end: string;                // HH:MM format
    };
}

export interface ChatAutoResponseConfig {
    chatJid: string;
    contactName: string;
    enabled: boolean;
    confidenceThreshold: number;
    usesDefaultThreshold: boolean;
    allowedCategories?: string[];
    blockedCategories?: string[];
    totalResponses: number;
    approvedResponses?: number;
    rejectedResponses?: number;
    lastResponseAt: string | null;
}

export interface ChatConfigUpdate {
    enabled?: boolean;
    confidenceThreshold?: number;
    allowedCategories?: string[];
    blockedCategories?: string[];
}

export interface ChatConfigsResponse {
    configs: ChatAutoResponseConfig[];
}

// =============================================================================
// Sensitive Permissions Types
// =============================================================================

export interface SensitivePermissions {
    chatJid: string;
    contactName: string;
    permissions: Record<string, boolean>;   // Category ID to boolean
    defaultPermission: boolean;
}

export interface SensitivePermissionsUpdate {
    permissions: Record<string, boolean>;
}

// =============================================================================
// Response History Types
// =============================================================================

export type ResponseStatus = 'sent' | 'pending' | 'rejected' | 'expired';

export type ResponseAction =
    | 'sent_auto'
    | 'sent_approved'
    | 'sent_modified'
    | 'rejected'
    | 'expired';

export interface ResponseLogEntry {
    id: string;
    chatJid: string;
    contactName: string;
    incomingMessage: string;
    generatedResponse: string;
    finalResponse?: string;
    confidenceScore: number;
    confidenceReasons: string[];
    action: ResponseAction;
    status: ResponseStatus;
    categoriesUsed: string[];
    personalInfoUsed: string[] | PersonalInfoSummary[];
    styleProfileUsed?: Partial<StyleProfile>;
    decisionReasoning?: string;
    createdAt: string;
    sentAt: string | null;
    responseTimeMs?: number;
}

export interface PersonalInfoSummary {
    id: string;
    content: string;
}

export interface ResponseHistoryFilters {
    status?: ResponseStatus;
    chatJid?: string;
    fromDate?: string;              // ISO 8601
    toDate?: string;                // ISO 8601
    limit?: number;
    offset?: number;
}

export interface ResponseHistoryResponse {
    responses: ResponseLogEntry[];
    total: number;
    limit: number;
    offset: number;
}

export interface ResponseStats {
    totalResponses: number;
    sentAuto: number;
    sentApproved: number;
    sentModified: number;
    rejected: number;
    expired: number;
    averageConfidence: number;
    averageResponseTimeMs: number;
}

// =============================================================================
// Pending Approvals Types
// =============================================================================

export interface PendingApproval {
    id: string;
    chatJid: string;
    contactName: string;
    incomingMessage: string;
    generatedResponse: string;
    confidenceScore: number;
    confidenceReasons: string[];
    reasonForReview: string;
    categoriesInvolved: string[];
    createdAt: string;
    expiresAt: string;
    timeRemainingSeconds: number;
}

export interface PendingApprovalsResponse {
    approvals: PendingApproval[];
    total: number;
}

export interface ApprovalAction {
    customResponse?: string;
}

export interface RejectionAction {
    reason?: string;
    saveFeedback?: boolean;
}

export interface ApprovalResult {
    id: string;
    status: 'sent' | 'rejected';
    responseSent?: string;
    sentAt?: string;
    wasModified?: boolean;
    rejectedAt?: string;
}

// =============================================================================
// Batch Job Types
// =============================================================================

export type BatchJobStatus = 'idle' | 'started' | 'in_progress' | 'completed' | 'failed';

export interface BatchJob {
    jobId: string;
    status: BatchJobStatus;
    processed: number;
    total: number;
    successful: number;
    failed: number;
    errors: BatchError[];
    startedAt?: string;
    completedAt?: string;
    estimatedDurationSeconds?: number;
}

export interface BatchError {
    chatJid: string;
    error: string;
}

export interface BatchStartResponse {
    jobId: string;
    status: 'started';
    totalChats: number;
    estimatedDurationSeconds: number;
}

// =============================================================================
// API Error Types
// =============================================================================

export interface ApiErrorResponse {
    error: string;
    message: string;
    details?: Record<string, unknown>;
}

export interface FieldError {
    field: string;
    message: string;
    received?: unknown;
}

export interface ValidationErrorDetails {
    fieldErrors: FieldError[];
}

// =============================================================================
// UI State Types
// =============================================================================

export type ViewMode = 'grid' | 'list';

export interface PersonaPageState {
    isLoading: boolean;
    error: string | null;
}

export interface StyleProfilesPageState extends PersonaPageState {
    profiles: StyleProfile[];
    viewMode: ViewMode;
    searchQuery: string;
    selectedProfileJid: string | null;
    batchStatus: BatchJob | null;
}

export interface PersonalInfoPageState extends PersonaPageState {
    entries: PersonalInfo[];
    categories: Category[];
    selectedCategoryId: string | null;
    searchQuery: string;
}

export interface AutoResponsePageState extends PersonaPageState {
    globalSettings: GlobalAutoResponseSettings | null;
    chatConfigs: ChatAutoResponseConfig[];
    searchQuery: string;
}

export interface ResponseHistoryPageState extends PersonaPageState {
    responses: ResponseLogEntry[];
    filters: ResponseHistoryFilters;
    selectedResponseId: string | null;
    total: number;
}

export interface PendingApprovalsState {
    approvals: PendingApproval[];
    count: number;
    isLoading: boolean;
    error: string | null;
}
