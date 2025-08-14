/**
 * Assert the given condition is `true`, throwing an error with the
 * optional `msg` if otherwise.
 *
 * @param condition The condition to check at runtime.
 * @msg msg An optional message to raise if the assertion fails.
 */
export default function assert(condition: unknown, msg?: string): asserts condition {
  if (condition === false) throw new Error(msg);
}
