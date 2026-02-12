import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    FileText,
    FileCode,
    FileImage,
    FileVideo,
    FileAudio,
    FileArchive,
    File,
    FolderOpen,
    ExternalLink,
    Check,
    AlertCircle,
    Loader
} from 'lucide-react';

export interface FileInfo {
    path: string;
    name: string;
    size?: number;
    file_type?: string;
    is_workspace?: boolean;
    description?: string;
}

interface FileCardProps {
    file: FileInfo;
    action?: 'created' | 'shared';
}

// Map file extensions to icons and colors
const getFileStyle = (fileType?: string) => {
    const type = fileType?.toLowerCase() || '';

    // Code files
    if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'cs', 'go', 'rs', 'rb', 'php', 'swift', 'kt', 'scala', 'sh', 'bash', 'ps1', 'sql', 'html', 'css', 'scss', 'sass', 'less', 'vue', 'svelte'].includes(type)) {
        return { icon: FileCode, color: '#818cf8', bgColor: 'rgba(129, 140, 248, 0.15)' };
    }

    // Document/text files
    if (['txt', 'md', 'markdown', 'rst', 'doc', 'docx', 'odt', 'rtf', 'tex', 'log'].includes(type)) {
        return { icon: FileText, color: '#60a5fa', bgColor: 'rgba(96, 165, 250, 0.15)' };
    }

    // PDF
    if (type === 'pdf') {
        return { icon: FileText, color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.15)' };
    }

    // Image files
    if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp', 'ico', 'tiff'].includes(type)) {
        return { icon: FileImage, color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.15)' };
    }

    // Video files
    if (['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v'].includes(type)) {
        return { icon: FileVideo, color: '#f97316', bgColor: 'rgba(249, 115, 22, 0.15)' };
    }

    // Audio files
    if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a'].includes(type)) {
        return { icon: FileAudio, color: '#a855f7', bgColor: 'rgba(168, 85, 247, 0.15)' };
    }

    // Archive files
    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(type)) {
        return { icon: FileArchive, color: '#eab308', bgColor: 'rgba(234, 179, 8, 0.15)' };
    }

    // Data files
    if (['json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'csv', 'tsv'].includes(type)) {
        return { icon: FileCode, color: '#14b8a6', bgColor: 'rgba(20, 184, 166, 0.15)' };
    }

    // Default
    return { icon: File, color: '#94a3b8', bgColor: 'rgba(148, 163, 184, 0.15)' };
};

// Format file size
const formatSize = (bytes?: number): string => {
    if (!bytes) return '';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    return unitIndex === 0 ? `${size} ${units[unitIndex]}` : `${size.toFixed(1)} ${units[unitIndex]}`;
};

// Get file type display name
const getFileTypeName = (fileType?: string): string => {
    if (!fileType) return 'File';
    const type = fileType.toUpperCase();
    const typeNames: Record<string, string> = {
        'PDF': 'PDF Document',
        'TXT': 'Text File',
        'MD': 'Markdown',
        'JSON': 'JSON Data',
        'XML': 'XML Data',
        'CSV': 'CSV Spreadsheet',
        'PY': 'Python Script',
        'JS': 'JavaScript',
        'TS': 'TypeScript',
        'TSX': 'TypeScript React',
        'JSX': 'JavaScript React',
        'HTML': 'HTML Page',
        'CSS': 'Stylesheet',
        'PNG': 'PNG Image',
        'JPG': 'JPEG Image',
        'JPEG': 'JPEG Image',
        'GIF': 'GIF Image',
        'SVG': 'SVG Image',
        'MP4': 'Video',
        'MP3': 'Audio',
        'ZIP': 'ZIP Archive',
    };
    return typeNames[type] || `${type} File`;
};

export const FileCard: React.FC<FileCardProps> = ({ file }) => {
    const [openLoading, setOpenLoading] = useState(false);
    const [openSuccess, setOpenSuccess] = useState(false);
    const [openError, setOpenError] = useState<string | null>(null);

    const style = getFileStyle(file.file_type);
    const IconComponent = style.icon;

    const handleOpen = async () => {
        setOpenLoading(true);
        setOpenError(null);
        try {
            const response = await fetch('/api/files/open', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: file.path })
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || 'Failed to open file');
            }
            setOpenSuccess(true);
            setTimeout(() => setOpenSuccess(false), 2000);
        } catch (err) {
            setOpenError(err instanceof Error ? err.message : 'Failed to open');
        } finally {
            setOpenLoading(false);
        }
    };

    const handleOpenFolder = async () => {
        try {
            await fetch('/api/files/open-folder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: file.path })
            });
        } catch (err) {
            console.error('Failed to open folder:', err);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
                background: style.bgColor,
                border: `1px solid ${style.color}33`,
                borderRadius: '0.5rem',
                padding: '0.75rem',
                marginTop: '0.5rem',
                marginBottom: '0.5rem',
            }}
        >
            {/* File Info Row */}
            <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
            }}>
                {/* File Icon */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '40px',
                    height: '40px',
                    borderRadius: '0.375rem',
                    background: `${style.color}22`,
                    flexShrink: 0,
                }}>
                    <IconComponent size={22} color={style.color} />
                </div>

                {/* File Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: 'var(--text-main)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}>
                        {file.name}
                    </div>
                    <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        marginTop: '0.125rem',
                    }}>
                        {getFileTypeName(file.file_type)}
                        {file.size ? ` • ${formatSize(file.size)}` : ''}
                        {file.is_workspace && (
                            <span style={{ color: style.color, marginLeft: '0.5rem' }}>
                                • Workspace
                            </span>
                        )}
                    </div>
                    {file.description && (
                        <div style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-secondary)',
                            marginTop: '0.25rem',
                        }}>
                            {file.description}
                        </div>
                    )}
                    <div style={{
                        fontSize: '0.65rem',
                        color: 'var(--text-muted)',
                        marginTop: '0.25rem',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        fontFamily: 'monospace',
                        opacity: 0.7,
                    }}>
                        {file.path}
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div style={{
                display: 'flex',
                gap: '0.5rem',
                marginTop: '0.75rem',
                borderTop: `1px solid ${style.color}22`,
                paddingTop: '0.75rem',
            }}>
                {/* Open Button */}
                <button
                    onClick={handleOpen}
                    disabled={openLoading}
                    style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        background: style.color,
                        border: 'none',
                        borderRadius: '0.375rem',
                        color: 'white',
                        fontSize: '0.8rem',
                        fontWeight: 500,
                        cursor: openLoading ? 'wait' : 'pointer',
                        opacity: openLoading ? 0.7 : 1,
                        transition: 'all 0.15s ease',
                    }}
                    onMouseOver={(e) => {
                        if (!openLoading) e.currentTarget.style.opacity = '0.9';
                    }}
                    onMouseOut={(e) => {
                        if (!openLoading) e.currentTarget.style.opacity = '1';
                    }}
                >
                    {openLoading ? (
                        <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : openSuccess ? (
                        <Check size={14} />
                    ) : (
                        <ExternalLink size={14} />
                    )}
                    {openSuccess ? 'Opened!' : 'Open'}
                </button>

                {/* Show in Folder Button */}
                <button
                    onClick={handleOpenFolder}
                    style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: `1px solid ${style.color}44`,
                        borderRadius: '0.375rem',
                        color: 'var(--text-main)',
                        fontSize: '0.8rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                    }}
                    onMouseOver={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                    }}
                >
                    <FolderOpen size={14} />
                    Show in Folder
                </button>
            </div>

            {/* Error message */}
            {openError && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    marginTop: '0.5rem',
                    padding: '0.375rem 0.5rem',
                    background: 'rgba(239, 68, 68, 0.15)',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                    color: '#ef4444',
                }}>
                    <AlertCircle size={12} />
                    {openError}
                </div>
            )}
        </motion.div>
    );
};

// Add spin keyframes to document if not exists
if (typeof document !== 'undefined') {
    const styleId = 'file-card-animations';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
}
