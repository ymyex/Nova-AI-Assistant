import React from 'react';

interface ContactAvatarProps {
    name: string;
    size?: 'sm' | 'md' | 'lg';
    jid?: string;
}

// Generate consistent color from string
const getColorFromString = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    const colors = [
        'linear-gradient(135deg, #0ea5e9, #3b82f6)',  // Cyan to blue
        'linear-gradient(135deg, #8b5cf6, #6366f1)',  // Purple to indigo
        'linear-gradient(135deg, #10b981, #059669)',  // Emerald
        'linear-gradient(135deg, #f59e0b, #d97706)',  // Amber
        'linear-gradient(135deg, #ec4899, #db2777)',  // Pink
        'linear-gradient(135deg, #14b8a6, #0d9488)',  // Teal
        'linear-gradient(135deg, #f43f5e, #e11d48)',  // Rose
        'linear-gradient(135deg, #6366f1, #4f46e5)',  // Indigo
    ];

    return colors[Math.abs(hash) % colors.length];
};

const getInitials = (name: string): string => {
    if (!name) return '?';

    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
        return parts[0].charAt(0).toUpperCase();
    }
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

export const ContactAvatar: React.FC<ContactAvatarProps> = ({
    name,
    size = 'md',
    jid
}) => {
    const initials = getInitials(name);
    const background = getColorFromString(jid || name);

    const getSize = () => {
        switch (size) {
            case 'sm': return 32;
            case 'lg': return 56;
            default: return 40;
        }
    };

    const getFontSize = () => {
        switch (size) {
            case 'sm': return '0.75rem';
            case 'lg': return '1.25rem';
            default: return '0.875rem';
        }
    };

    const dimension = getSize();

    return (
        <div
            style={{
                width: dimension,
                height: dimension,
                borderRadius: '50%',
                background,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: getFontSize(),
                fontWeight: 600,
                color: 'white',
                textTransform: 'uppercase',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
            }}
            title={name}
        >
            {initials}
        </div>
    );
};
