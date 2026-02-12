/**
 * TypeScript types for CODA AI system status.
 *
 * These types represent the status of WhatsApp sessions and overall system state.
 * Used throughout the dashboard, settings, and status display components.
 */

/**
 * Status of a single WhatsApp session (monitoring or replying).
 */
export interface SessionStatus {
    connected: boolean;
    paired: boolean;
    connecting: boolean;
    qr?: string;
}

/**
 * Overall system status including both WhatsApp sessions and AI connection.
 */
export interface SystemStatus {
    uptime_seconds: number;
    gemini_connected: boolean;
    monitoring: SessionStatus;
    replying: SessionStatus;
    total_suggestions: number;
    failed_suggestions: number;
}


