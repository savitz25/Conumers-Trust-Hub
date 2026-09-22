import { MY_TRUSTHUB_EVENTS } from './my-trusthub-contract.ts';

export const TRUSTHUB_HUB = 'ask' as const;

export const TRUSTHUB_EVENTS = {
  SEARCH_SUBMITTED: 'search_submitted',
  SEARCH_RESULTS_RETURNED: 'search_results_returned',
  SEARCH_RESULT_OPENED: 'search_result_opened',
  SPECIALIST_HANDOFF_STARTED: 'specialist_handoff_started',
  PROFILE_VIEWED: 'profile_viewed',
  PROFILE_SAVED: MY_TRUSTHUB_EVENTS.PROFILE_SAVED,
  ACCOUNT_SIGNUP_STARTED: 'account_signup_started',
  ACCOUNT_LOGIN_STARTED: 'account_login_started',
  ACCOUNT_CREATED: 'account_created',
  PROJECT_CREATED: MY_TRUSTHUB_EVENTS.PROJECT_CREATED,
  // ATH-OBS-002D canonical My TrustHub journey events (contract: lib/analytics/my-trusthub-contract.ts)
  PROFILE_SAVE_INTENT: MY_TRUSTHUB_EVENTS.PROFILE_SAVE_INTENT,
  PROFILE_SAVE_FAILED: MY_TRUSTHUB_EVENTS.PROFILE_SAVE_FAILED,
  AUTH_CONTINUATION_STARTED: MY_TRUSTHUB_EVENTS.AUTH_CONTINUATION_STARTED,
  AUTH_CONTINUATION_COMPLETED: MY_TRUSTHUB_EVENTS.AUTH_CONTINUATION_COMPLETED,
  AUTH_CONTINUATION_FAILED: MY_TRUSTHUB_EVENTS.AUTH_CONTINUATION_FAILED,
  PROJECT_CREATE_FAILED: MY_TRUSTHUB_EVENTS.PROJECT_CREATE_FAILED,
  PROJECT_ITEM_ADDED: MY_TRUSTHUB_EVENTS.PROJECT_ITEM_ADDED,
  WATCH_CREATED: MY_TRUSTHUB_EVENTS.WATCH_CREATED,
  WATCH_CREATE_FAILED: MY_TRUSTHUB_EVENTS.WATCH_CREATE_FAILED,
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
