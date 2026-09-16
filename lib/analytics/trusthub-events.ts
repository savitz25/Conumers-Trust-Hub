export const TRUSTHUB_HUB = 'ask' as const;

export const TRUSTHUB_EVENTS = {
  SEARCH_SUBMITTED: 'search_submitted',
  SEARCH_RESULTS_RETURNED: 'search_results_returned',
  SEARCH_RESULT_OPENED: 'search_result_opened',
  SPECIALIST_HANDOFF_STARTED: 'specialist_handoff_started',
  PROFILE_VIEWED: 'profile_viewed',
  PROFILE_SAVED: 'profile_saved',
  ACCOUNT_SIGNUP_STARTED: 'account_signup_started',
  ACCOUNT_CREATED: 'account_created',
  PROJECT_CREATED: 'project_created',
  CLAIM_STARTED: 'claim_started',
  PAGEVIEW: '$pageview',
} as const;

export type TrustHubEventName = (typeof TRUSTHUB_EVENTS)[keyof typeof TRUSTHUB_EVENTS];

export type TrustHubCommonProperties = {
  hub: typeof TRUSTHUB_HUB;
  environment: 'production' | 'preview' | 'development';
  surface?: string;
  authenticated?: boolean;
  specialist_hub?: string;
  state?: string;
  capability?: string;
  result_count?: number;
  capability_state?: string;
  success?: boolean;
};

export type TrustHubEventProperties = TrustHubCommonProperties &
  Record<string, string | number | boolean | undefined>;
