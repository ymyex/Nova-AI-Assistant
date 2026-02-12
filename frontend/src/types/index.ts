/**
 * Central type exports for CODA AI frontend.
 *
 * Import shared types from this barrel file:
 * ```
 * import { SessionStatus, SystemStatus, Message } from '../types';
 * ```
 */

// Re-export status types
export type { SessionStatus, SystemStatus } from './status';

// Re-export chat types
export type {
    ToolCall,
    Message,
    TraceLogEntry,
    Conversation,
    ConversationListItem,
    CreateConversationRequest,
    UpdateConversationRequest,
    ChatMessageRequest,
} from './chat';

// Re-export persona types
export type {
    StyleProfile,
    StyleProfileUpdate,
    StyleProfileListResponse,
    PersonalInfo,
    PersonalInfoCreate,
    PersonalInfoUpdate,
    PersonalInfoListResponse,
    PersonalInfoSearchResult,
    PersonalInfoSearchResponse,
    ProcessedInfo,
    Category,
    CategoryCreate,
    CategoryUpdate,
    CategoriesResponse,
    GlobalAutoResponseSettings,
    ChatAutoResponseConfig,
    ChatConfigUpdate,
    ChatConfigsResponse,
    SensitivePermissions,
    SensitivePermissionsUpdate,
    ResponseLogEntry,
    ResponseHistoryFilters,
    ResponseHistoryResponse,
    ResponseStats,
    PendingApproval,
    PendingApprovalsResponse,
    ApprovalAction,
    RejectionAction,
    ApprovalResult,
    BatchJob,
    BatchError,
    BatchStartResponse,
    ApiErrorResponse,
} from './persona';


