import { createElement, lazy, type ComponentType, type LazyExoticComponent } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PreloadableComponent<T extends ComponentType<any>> = LazyExoticComponent<T> & {
    preload: () => Promise<{ default: T }>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithPreload<T extends ComponentType<any>>(
    factory: () => Promise<{ default: T }>
): PreloadableComponent<T> {
    const Component = lazy(factory) as PreloadableComponent<T>;
    Component.preload = factory;
    return Component;
}

/** A shared numerical lab can expose distinct lessons without eager scene imports. */
export function lazyWithMode<M extends string>(factory: () => Promise<{ default: ComponentType<{ mode?: M }> }>, mode: M): PreloadableComponent<ComponentType> {
    let pending: Promise<{ default: ComponentType }> | undefined;
    return lazyWithPreload(() => pending ??= factory().then(({ default: Component }) => ({ default: () => createElement(Component, { mode }) })));
}
