/**
 * SALLY — SALES AGENT (V1)
 *
 * Responsibilities:
 * - Generate sales content inside workspaces
 * - Coach and refine sales messaging
 * - Guide manual sales execution via Playbooks
 *
 * Explicitly excluded:
 * - Lead analysis
 * - CRM behavior
 * - Automation
 * - Data enrichment
 *
 * Sally is a human-in-the-loop sales assistant,
 * not an autonomous sales agent.
 *
 * Execution Mode: CONTENT_AND_GUIDED_EXECUTION_V1
 * 
 * Central export point for Sally module
 */

export * from './types';
export * from './context';
export * from './generator';
export * from './strategy-selector';
export * from './execution-mode';

