/**
 * Shared Markdown component styles for ReactMarkdown
 * Used across AgentChat, ChatMessage, and other components
 */
import type { Components } from 'react-markdown';

/**
 * Standard markdown components with consistent styling
 * Includes support for GFM tables, headings, code blocks, etc.
 */
export const markdownComponents: Components = {
    h1: ({ children }) => (
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '1rem 0 0.5rem 0', color: 'var(--text-main)' }}>{children}</h1>
    ),
    h2: ({ children }) => (
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '1rem 0 0.5rem 0', color: 'var(--text-main)' }}>{children}</h2>
    ),
    h3: ({ children }) => (
        <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0.75rem 0 0.5rem 0', color: 'var(--text-main)' }}>{children}</h3>
    ),
    p: ({ children }) => (
        <p style={{ margin: '0.5rem 0', lineHeight: 1.6 }}>{children}</p>
    ),
    ul: ({ children }) => (
        <ul style={{ marginLeft: '1.25rem', margin: '0.5rem 0', listStyleType: 'disc' }}>{children}</ul>
    ),
    ol: ({ children }) => (
        <ol style={{ marginLeft: '1.25rem', margin: '0.5rem 0', listStyleType: 'decimal' }}>{children}</ol>
    ),
    li: ({ children }) => (
        <li style={{ margin: '0.25rem 0' }}>{children}</li>
    ),
    strong: ({ children }) => (
        <strong style={{ fontWeight: 600, color: 'var(--text-main)' }}>{children}</strong>
    ),
    code: ({ children, className }) => {
        const isInline = !className;
        return isInline ? (
            <code style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '0.125rem 0.375rem',
                borderRadius: '0.25rem',
                fontSize: '0.85em',
                fontFamily: 'monospace',
                color: 'var(--accent)'
            }}>{children}</code>
        ) : (
            <code style={{
                display: 'block',
                background: 'rgba(0, 0, 0, 0.2)',
                padding: '0.75rem 1rem',
                borderRadius: '0.375rem',
                fontSize: '0.85em',
                fontFamily: 'monospace',
                marginTop: '0.5rem',
                marginBottom: '0.5rem',
                overflowX: 'auto',
                border: '1px solid var(--glass-border)'
            }}>{children}</code>
        );
    },
    pre: ({ children }) => (
        <pre style={{ margin: 0 }}>{children}</pre>
    ),
    a: ({ href, children }) => (
        <a href={href} target="_blank" rel="noopener noreferrer" style={{
            color: 'var(--primary)',
            textDecoration: 'underline',
            textDecorationThickness: '1px',
            textUnderlineOffset: '2px'
        }}>{children}</a>
    ),
    blockquote: ({ children }) => (
        <blockquote style={{
            borderLeft: '3px solid var(--primary)',
            paddingLeft: '1rem',
            margin: '0.75rem 0',
            color: 'var(--text-secondary)',
            fontStyle: 'italic'
        }}>{children}</blockquote>
    ),
    hr: () => (
        <hr style={{
            border: 'none',
            borderTop: '1px solid var(--glass-border)',
            margin: '1.5rem 0'
        }} />
    ),
    // Table components for GFM table support
    table: ({ children }) => (
        <div style={{
            overflowX: 'auto',
            margin: '1rem 0',
            borderRadius: '0.5rem',
            border: '1px solid var(--glass-border)'
        }}>
            <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.875rem',
                fontFamily: 'inherit'
            }}>{children}</table>
        </div>
    ),
    thead: ({ children }) => (
        <thead style={{
            background: 'rgba(56, 189, 248, 0.1)',
            borderBottom: '1px solid var(--glass-border)'
        }}>{children}</thead>
    ),
    tbody: ({ children }) => (
        <tbody>{children}</tbody>
    ),
    tr: ({ children }) => (
        <tr style={{
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
        }}>{children}</tr>
    ),
    th: ({ children }) => (
        <th style={{
            padding: '0.75rem 1rem',
            textAlign: 'left',
            fontWeight: 600,
            color: 'var(--text-main)',
            whiteSpace: 'nowrap'
        }}>{children}</th>
    ),
    td: ({ children }) => (
        <td style={{
            padding: '0.75rem 1rem',
            color: 'var(--text-secondary)',
            verticalAlign: 'top'
        }}>{children}</td>
    )
};

/**
 * Simplified markdown components for compact displays (e.g., process steps)
 */
export const compactMarkdownComponents: Components = {
    p: ({ children }) => (
        <p style={{ margin: '0 0 0.5rem 0', lineHeight: 1.5 }}>{children}</p>
    ),
    a: ({ href, children }) => (
        <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>{children}</a>
    ),
    code: ({ children, className }) => {
        const isInline = !className;
        return isInline ? (
            <code style={{ background: 'rgba(255,255,255,0.05)', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', fontFamily: 'monospace', fontSize: '0.85em', border: '1px solid rgba(255,255,255,0.1)' }}>{children}</code>
        ) : (
            <code style={{ display: 'block', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '0.375rem', margin: '0.5rem 0', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.85em', border: '1px solid var(--glass-border)' }}>{children}</code>
        );
    },
    ul: ({ children }) => <ul style={{ marginLeft: '1rem', marginBottom: '0.5rem', listStyleType: 'disc' }}>{children}</ul>,
    ol: ({ children }) => <ol style={{ marginLeft: '1rem', marginBottom: '0.5rem', listStyleType: 'decimal' }}>{children}</ol>,
    li: ({ children }) => <li style={{ marginBottom: '0.25rem' }}>{children}</li>,
    // Compact table styles
    table: ({ children }) => (
        <div style={{
            overflowX: 'auto',
            margin: '0.5rem 0',
            borderRadius: '0.375rem',
            border: '1px solid var(--glass-border)'
        }}>
            <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.8125rem'
            }}>{children}</table>
        </div>
    ),
    thead: ({ children }) => (
        <thead style={{
            background: 'rgba(56, 189, 248, 0.08)',
            borderBottom: '1px solid var(--glass-border)'
        }}>{children}</thead>
    ),
    tbody: ({ children }) => (
        <tbody>{children}</tbody>
    ),
    tr: ({ children }) => (
        <tr style={{
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
        }}>{children}</tr>
    ),
    th: ({ children }) => (
        <th style={{
            padding: '0.5rem 0.75rem',
            textAlign: 'left',
            fontWeight: 600,
            color: 'var(--text-main)',
            whiteSpace: 'nowrap'
        }}>{children}</th>
    ),
    td: ({ children }) => (
        <td style={{
            padding: '0.5rem 0.75rem',
            color: 'var(--text-secondary)'
        }}>{children}</td>
    )
};
