import type { Catalog } from './en';

/**
 * The shape a translation has to have.
 *
 * The English catalog is `as const`, so its keys are known exactly, and this
 * maps them to plain strings. A missing or spare key then fails the build
 * instead of leaving a hole for somebody to find later.
 */
export type Translation = DeepStrings<Catalog>;

type DeepStrings<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStrings<T[K]>;
};
