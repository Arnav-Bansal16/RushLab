/** Serializable snapshot equality: object key order is irrelevant; array order is preserved. */
export function equalSnapshot(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== typeof right)
    return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => equalSnapshot(value, right[index]))
    );
  }
  if (typeof left !== "object" || typeof right !== "object") return false;
  const a = left as Record<string, unknown>,
    b = right as Record<string, unknown>;
  const keys = Object.keys(a).sort(),
    otherKeys = Object.keys(b).sort();
  return (
    keys.length === otherKeys.length &&
    keys.every(
      (key, index) => key === otherKeys[index] && equalSnapshot(a[key], b[key]),
    )
  );
}
