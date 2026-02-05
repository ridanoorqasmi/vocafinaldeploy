/**
 * SALES PLAYBOOKS — EXECUTION V1
 *
 * Scope:
 * - Manual, linear playbook execution
 * - Step-based content generation
 * - Read-only step intelligence
 *
 * Explicitly excluded:
 * - Automation
 * - Branching
 * - Analytics
 * - CRM integration
 *
 * This module is workspace-independent by design.
 * Future extensions must preserve this contract.
 */

/**
 * Execution mode constant for Playbooks V1
 * 
 * This constant enforces the current execution model:
 * - Manual: All actions require explicit user interaction
 * - Linear: Steps execute sequentially, no branching
 * - Guidance-driven: Intelligence is read-only, no automation
 * 
 * Use this constant to:
 * - Gate execution logic
 * - Block future accidental additions
 * - Make scope explicit in code reviews
 */
export const PLAYBOOK_EXECUTION_MODE = 'MANUAL_LINEAR_V1' as const;

/**
 * Terminal states for playbook runs
 */
export type PlaybookRunStatus = 'ACTIVE' | 'COMPLETED' | 'ABANDONED';

/**
 * Step run statuses
 */
export type PlaybookStepRunStatus = 'PENDING' | 'GENERATED' | 'COMPLETED' | 'SKIPPED';

/**
 * Check if a run status is terminal (no further execution allowed)
 */
export function isTerminalStatus(status: string): boolean {
  return status === 'COMPLETED' || status === 'ABANDONED';
}

/**
 * Validate that execution is allowed for the given run status
 */
export function validateExecutionAllowed(status: string): void {
  if (isTerminalStatus(status)) {
    throw new Error(`Cannot execute on run with terminal status: ${status}`);
  }
}
