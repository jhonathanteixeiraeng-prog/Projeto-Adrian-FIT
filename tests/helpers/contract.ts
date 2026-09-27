import { expect } from 'vitest';

/**
 * Contract checks for the iOS app (ios/AdrianFit/AdrianFit/Core). Swift's JSONDecoder rejects the whole response
 * when a non-optional property is missing, null or of another JSON type, so these shapes mirror the Swift
 * Codable models: `String` → 'string', `Int`/`Double` → 'number', `Bool` → 'boolean', `String?` → 'string?'.
 * Dates are plain `String`s in the models (the decoder has no date strategy), so they are 'string' here too.
 *
 * - 'any': required, any non-null value (JSON the app decodes by itself).
 * - `{ field: shape }`: a required object; only the listed fields are checked, extra fields are fine.
 * - `[shape]`: a required array whose items all match `shape`.
 * - `optional(shape)`: a Swift `Type?` object or array, which may be absent or null.
 */
type Scalar = 'string' | 'number' | 'boolean' | 'any';
const OPTIONAL: unique symbol = Symbol('optional');
interface OptionalShape {
    readonly [OPTIONAL]: Shape;
}
interface ObjectShape {
    readonly [field: string]: Shape;
}
export type Shape = Scalar | `${Scalar}?` | [Shape] | OptionalShape | ObjectShape;

export function optional(shape: Shape): OptionalShape {
    return { [OPTIONAL]: shape };
}

function isOptional(shape: Shape): shape is OptionalShape {
    return typeof shape === 'object' && OPTIONAL in shape;
}

/** Every field the iOS decoder would reject, with its JSON path. */
function mismatches(value: unknown, shape: Shape, path: string): string[] {
    if (isOptional(shape)) {
        return value === undefined || value === null ? [] : mismatches(value, shape[OPTIONAL], path);
    }
    if (typeof shape === 'string') {
        const nullable = shape.endsWith('?');
        const type = (nullable ? shape.slice(0, -1) : shape) as Scalar;
        if (value === undefined || value === null) return nullable ? [] : [`${path}: ausente ou null (esperado ${type})`];
        if (type === 'any' || typeof value === type) return [];
        return [`${path}: ${JSON.stringify(value)} é ${typeof value} (esperado ${type})`];
    }
    if (Array.isArray(shape)) {
        if (!Array.isArray(value)) return [`${path}: esperado array`];
        return value.flatMap((item, index) => mismatches(item, shape[0], `${path}[${index}]`));
    }
    if (value === undefined || value === null || typeof value !== 'object' || Array.isArray(value)) {
        return [`${path}: esperado objeto`];
    }
    return Object.entries(shape).flatMap(([field, fieldShape]) =>
        mismatches((value as Record<string, unknown>)[field], fieldShape, `${path}.${field}`)
    );
}

/** Fails listing every field the iOS app couldn't decode (the paths go in the message, not a truncated diff). */
export function expectShape(value: unknown, shape: Shape) {
    const problems = mismatches(value, shape, '$');
    expect(problems, `o app iOS não conseguiria ler:\n${problems.join('\n')}`).toEqual([]);
}

/**
 * APIClient.get/post/put decode `{ success, data }` and throw when success is false or data is null.
 * Returns `data`, so the test can check its shape.
 */
export function envelopeData(body: unknown) {
    expectShape(body, { success: 'boolean', data: 'any' });
    expect((body as { success: unknown }).success).toBe(true);
    return (body as { data: unknown }).data;
}

/** APIClient.putAck/patchAck (Swift APIAck): `{ success: true }`, no data needed. */
export function expectAck(body: unknown) {
    expectShape(body, { success: 'boolean', error: 'string?' });
    expect((body as { success: unknown }).success).toBe(true);
}
