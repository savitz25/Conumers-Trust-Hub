'use client';

import { useEffect } from 'react';
import { captureTrustEvent } from '@/lib/analytics/trusthub';
import { TRUSTHUB_EVENTS } from '@/lib/analytics/trusthub-events';

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
  captureTrustEvent(TRUSTHUB_EVENTS.SEARCH_SUBMITTED, {
    surface,
    specialist_hub: specialistHub,
    success: true,
  });
}

export function captureResultOpened(specialistHub?: string, surface = 'ask_results'): void {
  captureTrustEvent(TRUSTHUB_EVENTS.SEARCH_RESULT_OPENED, {
    surface,
    specialist_hub: specialistHub,
    success: true,
  });
}

export function captureSpecialistHandoff(specialistHub?: string, surface = 'ask_results'): void {
  captureTrustEvent(TRUSTHUB_EVENTS.SPECIALIST_HANDOFF_STARTED, {
    surface,
    specialist_hub: specialistHub,
    success: true,
  });
}

export function captureProfileSaved(surface = 'my_trusthub'): void {
  captureTrustEvent(TRUSTHUB_EVENTS.PROFILE_SAVED, { surface, success: true });
}

export function captureProjectCreated(surface = 'my_trusthub'): void {
  captureTrustEvent(TRUSTHUB_EVENTS.PROJECT_CREATED, { surface, success: true });
}

export function captureSignupStarted(surface = 'my_sign_in'): void {
  captureTrustEvent(TRUSTHUB_EVENTS.ACCOUNT_SIGNUP_STARTED, { surface, success: true });
}
