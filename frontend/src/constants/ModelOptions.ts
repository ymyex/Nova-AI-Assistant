import { Zap, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Model configuration options shared across the application.
 * Used in ConfigForm for permanent settings and AgentChat for session overrides.
 */
export interface ModelOption {
    id: string;
    name: string;
    description: string;
    icon: LucideIcon;
    color: string;
    gradient: string;
}

export const MODEL_OPTIONS: ModelOption[] = [
    {
        id: 'gemini-3-flash-preview',
        name: 'Gemini 3 Flash',
        description: 'Fast responses, optimized for speed',
        icon: Zap,
        color: '#fbbf24',
        gradient: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)'
    },
    {
        id: 'gemini-3-pro-preview',
        name: 'Gemini 3 Pro',
        description: 'Advanced reasoning, highest quality',
        icon: Sparkles,
        color: '#a78bfa',
        gradient: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)'
    }
];

export const getModelById = (id: string): ModelOption | undefined => {
    return MODEL_OPTIONS.find(m => m.id === id);
};

export const getDefaultModel = (): ModelOption => {
    return MODEL_OPTIONS[0];
};
