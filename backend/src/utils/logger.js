export function createChildLogger(fastify, bindings = {}) {
  return fastify.log.child(bindings);
}
