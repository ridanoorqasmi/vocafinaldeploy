/**
 * Performance Monitoring
 * Tracks response times and helps identify bottlenecks
 */

interface PerformanceMetrics {
  operation: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

const metrics: PerformanceMetrics[] = [];
const MAX_METRICS = 1000; // Keep last 1000 metrics

/**
 * Log a performance metric
 */
export function logPerformance(
  operation: string,
  duration: number,
  metadata?: Record<string, any>
): void {
  metrics.push({
    operation,
    duration,
    timestamp: Date.now(),
    metadata
  });

  // Keep only recent metrics
  if (metrics.length > MAX_METRICS) {
    metrics.shift();
  }
}

/**
 * Get average performance for an operation
 */
export function getAveragePerformance(operation: string): number | null {
  const operationMetrics = metrics.filter(m => m.operation === operation);
  if (operationMetrics.length === 0) return null;

  const total = operationMetrics.reduce((sum, m) => sum + m.duration, 0);
  return total / operationMetrics.length;
}

/**
 * Get performance summary
 */
export function getPerformanceSummary(): Record<string, { avg: number; count: number; min: number; max: number }> {
  const summary: Record<string, { total: number; count: number; min: number; max: number }> = {};

  for (const metric of metrics) {
    if (!summary[metric.operation]) {
      summary[metric.operation] = {
        total: 0,
        count: 0,
        min: Infinity,
        max: -Infinity
      };
    }

    const stat = summary[metric.operation];
    stat.total += metric.duration;
    stat.count++;
    stat.min = Math.min(stat.min, metric.duration);
    stat.max = Math.max(stat.max, metric.duration);
  }

  const result: Record<string, { avg: number; count: number; min: number; max: number }> = {};
  for (const [operation, stat] of Object.entries(summary)) {
    result[operation] = {
      avg: stat.total / stat.count,
      count: stat.count,
      min: stat.min,
      max: stat.max
    };
  }

  return result;
}

/**
 * Clear all metrics
 */
export function clearMetrics(): void {
  metrics.length = 0;
}












