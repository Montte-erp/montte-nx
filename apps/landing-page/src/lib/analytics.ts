// apps/landing-page/src/lib/analytics.ts
import type { LandingPageVariant } from './variants';

declare global {
  interface Window {
    posthog?: {
      capture: (eventName: string, properties?: Record<string, unknown>) => void;
      isFeatureEnabled: (flagKey: string) => boolean;
      getFeatureFlag: (flagKey: string) => string | boolean | undefined;
    };
  }
}

export interface TrackingContext {
  variant: LandingPageVariant;
  page: string;
}

export function trackVariantAssigned(variant: LandingPageVariant, page: string) {
  if (!window.posthog) return;

  window.posthog.capture('landing_variant_assigned', {
    variant,
    page,
    timestamp: new Date().toISOString(),
  });
}

export function trackHeroCtaClicked(context: TrackingContext, ctaText: string) {
  if (!window.posthog) return;

  window.posthog.capture('hero_cta_clicked', {
    variant: context.variant,
    cta_text: ctaText,
    page: context.page,
  });
}

export function trackSectionViewed(
  context: TrackingContext,
  sectionName: string,
  scrollDepthPercent: number
) {
  if (!window.posthog) return;

  window.posthog.capture('section_viewed', {
    variant: context.variant,
    section_name: sectionName,
    scroll_depth_percent: scrollDepthPercent,
    page: context.page,
  });
}

export function trackFeatureCtaClicked(
  context: TrackingContext,
  sectionName: string,
  ctaText: string
) {
  if (!window.posthog) return;

  window.posthog.capture('feature_cta_clicked', {
    variant: context.variant,
    section_name: sectionName,
    cta_text: ctaText,
    page: context.page,
  });
}

export function trackPageExit(
  context: TrackingContext,
  timeOnPageSeconds: number,
  maxScrollDepth: number
) {
  if (!window.posthog) return;

  window.posthog.capture('page_exit', {
    variant: context.variant,
    time_on_page_seconds: timeOnPageSeconds,
    max_scroll_depth: maxScrollDepth,
    page: context.page,
  });
}
