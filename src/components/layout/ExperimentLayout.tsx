import { useId, type ReactNode } from 'react';

interface ExperimentLayoutProps {
    title: string;
    subtitle?: string;
    children: ReactNode;
}

/** Scrollable experiments share the same scene navigation and learning drawer. */
export function ExperimentLayout({ title, subtitle, children }: ExperimentLayoutProps) {
    const headingId = useId();
    return (
        <section className="experiment-layout" aria-labelledby={headingId}>
            <div className="experiment-content">
                <header className="experiment-header">
                    <p className="experiment-eyebrow">Core concepts · Interactive experiment</p>
                    <h1 id={headingId}>{title}</h1>
                    {subtitle && <p>{subtitle}</p>}
                </header>
                {children}
            </div>
        </section>
    );
}
