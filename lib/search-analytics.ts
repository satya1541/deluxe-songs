export type SearchEventType = 
  | 'search_started'
  | 'search_submitted'
  | 'suggestion_impression'
  | 'suggestion_clicked'
  | 'top_result_clicked'
  | 'entity_clicked'
  | 'result_clicked'
  | 'search_zero_results'
  | 'search_corrected'
  | 'filter_reset'
  | 'search_abandoned'
  | 'provider_timeout'
  | 'provider_failure'
  | 'fallback_source_used';

export interface SearchAnalyticsEvent {
  event: SearchEventType;
  query?: string;
  intent?: string;
  latency?: number;
  resultCount?: number;
  entityType?: string;
  entityId?: string;
  provider?: string;
  error?: string;
  timestamp: number;
}

/**
 * Provider-agnostic analytics interface for tracking search behavior.
 * In a real production environment, this would post to an analytics backend.
 */
export function trackSearchEvent(payload: Omit<SearchAnalyticsEvent, 'timestamp'>) {
  const event: SearchAnalyticsEvent = {
    ...payload,
    timestamp: Date.now(),
  };

  // Safe console log for development monitoring
  if (process.env.NODE_ENV === 'development') {
    console.debug(`[Search Analytics] ${event.event}`, event);
  }

  // TODO: Post to real analytics backend (e.g. PostHog, Mixpanel)
  // fetch('/api/analytics', { method: 'POST', body: JSON.stringify(event) }).catch(() => {});
}
