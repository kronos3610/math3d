import React from 'react';

interface SceneExplanationProps {
    title: string;
    summary: string;
    children?: React.ReactNode;
}

interface ExplanationSectionProps {
    title: string;
    children: React.ReactNode;
}

interface VisualLegendItem {
    label: string;
    description: string;
    color?: string;
}

interface VisualLegendProps {
    items: VisualLegendItem[];
}

export function SceneExplanation({ title, summary, children }: SceneExplanationProps) {
    return (
        <section className="scene-explanation" aria-label={`${title} explanation`}>
            <header className="scene-explanation-header">
                <h2>{title}</h2>
                <p>{summary}</p>
            </header>
            {children}
        </section>
    );
}

export function ExplanationSection({ title, children }: ExplanationSectionProps) {
    return (
        <section className="scene-explanation-section">
            <h3>{title}</h3>
            {children}
        </section>
    );
}

export function VisualLegend({ items }: VisualLegendProps) {
    return (
        <ul className="scene-visual-legend">
            {items.map((item) => (
                <li key={item.label}>
                    {item.color && (
                        <span
                            className="scene-visual-legend-swatch"
                            style={{ backgroundColor: item.color }}
                            aria-hidden="true"
                        />
                    )}
                    <span>
                        <strong>{item.label}</strong>
                        {' '}
                        {item.description}
                    </span>
                </li>
            ))}
        </ul>
    );
}
