'use client';

import { useEffect } from 'react';
import { captureTrustEvent } from '@/lib/analytics/trusthub';
import { TRUSTHUB_EVENTS } from '@/lib/analytics/trusthub-events';
import { MY_TRUSTHUB_EVENTS, boundedJourneyProperties, type MyTrustHubEventName } from '@/lib/analytics/my-trusthub-contract';

type ResultsProps = {
  specialistHub?: string;
  capability?: string;
  capabilityState?: string;
  resultCount?: number;
  success?: boolean;
  surface?: string;
  state?: string;
};

export function AskSearchSubmitted({
  surface,
  specialistHub,
}: {
  surface: string;
  specialistHub?: string;
}) {
  useEffect(() => {
    captureTrustEvent(TRUSTHUB_EVENTS.SEARCH_SUBMITTED, {
      surface,
      specialist_hub: specialistHub,
      success: true,
    });
  }, [surface, specialistHub]);
  return null;
}

export function AskSearchResultsReturned(props: ResultsProps) {
  useEffect(() => {
    captureTrustEvent(TRUSTHUB_EVENTS.SEARCH_RESULTS_RETURNED, {
      surface: props.surface,
      specialist_hub: props.specialistHub,
      capability: props.capability,
      capability_state: props.capabilityState,
      result_count: props.resultCount,
      success: props.success,
      state: props.state,
    });
  }, [
    props.surface,
    props.specialistHub,
    props.capability,
    props.capabilityState,
    props.resultCount,
    props.success,
    props.state,
  ]);
  return null;
}

export function captureSearchSubmitted(surface: string, specialistHub?: string): void {
  captureTrustEvent(
    TRUSTHUB_EVENTS.SEARCH_SUBMITTED,
    {
      surface,
      specialist_hub: specialistHub,
      success: true,
    },
    { sendBeforeUnload: true },
  );
}

export function captureResultOpened(specialistHub?: string, surface = 'ask_results'): void {
  captureTrustEvent(
    TRUSTHUB_EVENTS.SEARCH_RESULT_OPENED,
    {
      surface,
      specialist_hub: specialistHub,
      success: true,
    },
    { sendBeforeUnload: true },
  );
}

export function captureSpecialistHandoff(specialistHub?: string, surface = 'ask_results'): void {
  captureTrustEvent(
    TRUSTHUB_EVENTS.SPECIALIST_HANDOFF_STARTED,
    {
      surface,
      specialist_hub: specialistHub,
      success: true,
    },
    { sendBeforeUnload: true },
  );
}

/**
 * ATH-OBS-002D. A form SUBMIT is an intent, never a success: `profile_saved` / `project_created`
 * used to fire here with `success: true` before the server had done anything. Confirmed outcomes are
 * now emitted by components/analytics/my-trusthub-outcomes.tsx from server-set markers.
 */
export function captureMyTrustHubJourneyEvent(event: MyTrustHubEventName, properties: Record<string, unknown>): void {
  captureTrustEvent(event, boundedJourneyProperties(properties));
}

export function captureProfileSaveIntent(): void {
  captureMyTrustHubJourneyEvent(MY_TRUSTHUB_EVENTS.PROFILE_SAVE_INTENT, { surface: 'my_saved', action_source: 'my_saved_form', auth_state: 'authenticated', outcome: 'intent' });
}

export function captureGuestImportSaveIntent(projectContextPresent: boolean): void {
  captureMyTrustHubJourneyEvent(MY_TRUSTHUB_EVENTS.PROFILE_SAVE_INTENT, { surface: 'my_saved', action_source: 'guest_import', auth_state: 'authenticated', outcome: 'intent', project_context_present: projectContextPresent });
}

export function captureProjectItemAdded(surface: 'my_saved' | 'my_project_detail'): void {
  captureMyTrustHubJourneyEvent(MY_TRUSTHUB_EVENTS.PROJECT_ITEM_ADDED, { surface, auth_state: 'authenticated', outcome: 'success', project_context_present: true });
}

/** Sign-in link requested (pre-existing event name). An intent: delivery and sign-in are not yet known. */
export function captureSignupStarted(surface = 'my_sign_in'): void {
  captureTrustEvent(TRUSTHUB_EVENTS.ACCOUNT_SIGNUP_STARTED, { surface, auth_state: 'guest', outcome: 'intent' });
}
