import { Component, type ReactNode } from 'react';

interface SceneErrorBoundaryProps { children: ReactNode; fallback: ReactNode; }

/** React's error-boundary lifecycle needs a class; scenes remain hook components. */
export default class SceneErrorBoundary extends Component<SceneErrorBoundaryProps, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
