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
  const ids = new Set([config.parentId, config.childId].filter(Boolean))

  const presetOf = (agent) => {
    try {
      const registry = ctx.get('agentPresets')
      if (!registry) return undefined
      const bySession = registry.presetForSession?.(agent.session)
      if (bySession) return bySession
      return registry.composedPreset?.(agent.ctx)
    } catch {
      return undefined
    }
  }

  const release = ctx.on('agent/created', ({ agent }) => {
    try {
      if (!ids.has(presetOf(agent))) return
      if (config.approvalNever !== false) {
        const approval = ctx.get('approval')
        approval?.setPolicy?.(agent, 'never')
      }
    } catch {
      // A host without the approval service keeps its own policy.
    }
  })

  ctx.effect(() => release, 'moren-policy: approval policy')
}
