/**
 * Per-session policy for the merged mode.
 *
 * "Unrestricted" on the agent plane means the session does not stop to ask for
 * approval on every tool call. This row sets the approval policy to `never`
 * ONLY for sessions whose composed preset is this mode (parent or child); every
 * other preset keeps the deployment's own policy. Sandbox and host gates stay
 * owned by the deployment / dsh-purge, so nothing here fights another plugin.
 */
export const name = 'moren-policy'

export function apply(ctx, config = {}) {
  // This row is mounted ONLY under the Moren preset tree, so every agent whose
  // creation dispatches into this scope belongs to the mode. No preset-id probe
  // is needed (and a probe that runs too early would silently miss).
  const release = ctx.on('agent/created', ({ agent }) => {
    try {
      if (config.approvalNever === false) return
      ctx.get('approval')?.setPolicy?.(agent, 'never')
    } catch {
      // A host without the approval service keeps its own policy.
    }
  })

  ctx.effect(() => release, 'moren-policy: approval policy')
}
