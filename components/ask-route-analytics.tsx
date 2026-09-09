'use client';
import {useEffect} from 'react';
import {trackEvent} from '@/lib/analytics/track';
import {ANALYTICS_EVENTS} from '@/lib/analytics/events';
import type {AskIntelObservation} from '@/lib/network/ask-intel-observability';
import {askIntelAnalyticsProps,searchTerminalAnalyticsProps} from '@/lib/network/ask-intel-observability';
export function AskRouteAnalytics({observation,terminal=true}:{observation:AskIntelObservation;terminal?:boolean}){useEffect(()=>{trackEvent(observation.surface==='JOURNEY'?ANALYTICS_EVENTS.ASK_JOURNEY_RENDERED:ANALYTICS_EVENTS.ASK_ROUTE_RENDERED,askIntelAnalyticsProps(observation));if(terminal)trackEvent(ANALYTICS_EVENTS.SEARCH_TERMINAL_OUTCOME,searchTerminalAnalyticsProps(observation))},[observation,terminal]);return null}
