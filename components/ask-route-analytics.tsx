'use client';
import {useEffect} from 'react';
import {trackEvent} from '@/lib/analytics/track';
import {ANALYTICS_EVENTS} from '@/lib/analytics/events';
import type {AskIntelObservation} from '@/lib/network/ask-intel-observability';
import {askIntelAnalyticsProps} from '@/lib/network/ask-intel-observability';
export function AskRouteAnalytics({observation}:{observation:AskIntelObservation}){useEffect(()=>{trackEvent(observation.surface==='JOURNEY'?ANALYTICS_EVENTS.ASK_JOURNEY_RENDERED:ANALYTICS_EVENTS.ASK_ROUTE_RENDERED,askIntelAnalyticsProps(observation))},[observation]);return null}
