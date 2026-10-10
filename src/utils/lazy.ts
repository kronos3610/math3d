import { createElement, lazy, type ComponentType, type LazyExoticComponent } from 'react';

export type PreloadableComponent<T extends ComponentType> = LazyExoticComponent<T> & {
    preload: () => Promise<{ default: T }>;
};

export function lazyWithPreload<T extends ComponentType>(
    factory: () => Promise<{ default: T }>
): PreloadableComponent<T> {
    let pending: Promise<{ default: T }> | undefined;
    const load = () => {
        if (pending) return pending;
        const request = Promise.resolve().then(factory);
        pending = request;
        // Ignored speculative loads must not produce an unhandled rejection
        // or retain a failed request when the user subsequently visits.
        void request.catch(() => { if (pending === request) pending = undefined; });
        return request;
    };
    const Component = lazy(load) as PreloadableComponent<T>;
    Component.preload = load;
    return Component;
}

/** A shared numerical lab can expose distinct lessons without eager scene imports. */
export function lazyWithMode<M extends string>(factory: () => Promise<{ default: ComponentType<{ mode?: M }> }>, mode: M): PreloadableComponent<ComponentType> {
    return lazyWithPreload(() => factory().then(({ default: Component }) => ({ default: () => createElement(Component, { mode }) })));
}
