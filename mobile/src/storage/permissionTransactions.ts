/** Serializes local sharing consent and deletion intent writes across both stores. */
let chain: Promise<unknown> = Promise.resolve();
export function permissionMutation<T>(task: () => Promise<T>): Promise<T> {
  const result = chain.then(task, task);
  chain = result.catch(() => undefined);
  return result;
}
