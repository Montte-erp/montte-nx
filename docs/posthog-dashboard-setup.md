# PostHog A/B Test Dashboard Setup

This document provides step-by-step instructions for setting up the PostHog dashboard to monitor the ERP repositioning A/B test on the landing page.

## Overview

The landing page implements an A/B test comparing:
- **Variant A (Control)**: "Gestão Financeira Simples e Transparente"
- **Variant B (Treatment)**: "ERP Gratuito para Pequenas Empresas"

This test measures which positioning drives better engagement and conversions.

---

## 1. Feature Flag Configuration

### Create Feature Flag

1. Navigate to **Feature Flags** in PostHog
2. Click **New Feature Flag**
3. Configure the flag:
   - **Key**: `landing-page-erp-positioning`
   - **Name**: Landing Page ERP Positioning Test
   - **Description**: A/B test comparing financial management vs ERP positioning
   - **Release conditions**:
     - Type: **Percentage rollout**
     - Rollout: **50%** for variant A, **50%** for variant B
   - **Payload**:
     ```json
     {
       "variant_a": "financial-management",
       "variant_b": "erp-platform"
     }
     ```

### Targeting Rules

- **Geography**: All users
- **Device**: All devices (desktop, mobile, tablet)
- **Session-based**: Persist variant across session using `distinctId`

---

## 2. Custom Events

The landing page tracks 5 key events to measure engagement and conversion:

### Event 1: Page View
```typescript
posthog.capture('landing_page_view', {
  variant: 'financial-management' | 'erp-platform',
  page: 'homepage' | 'pricing' | 'enterprise' | 'features',
  scroll_depth: number,
  timestamp: ISO8601
})
```

### Event 2: CTA Click
```typescript
posthog.capture('cta_click', {
  variant: 'financial-management' | 'erp-platform',
  cta_location: 'hero' | 'problem-section' | 'features' | 'footer',
  cta_text: string,
  timestamp: ISO8601
})
```

### Event 3: Feature Navigation
```typescript
posthog.capture('feature_navigation', {
  variant: 'financial-management' | 'erp-platform',
  feature_clicked: 'financial-management' | 'planning' | 'automation' | 'inventory' | 'analytics',
  from_section: 'hero' | 'navigation' | 'features-grid',
  timestamp: ISO8601
})
```

### Event 4: Problem Section View
```typescript
posthog.capture('problem_section_view', {
  variant: 'financial-management' | 'erp-platform',
  problem_type: 'manual-work' | 'disconnected-tools' | 'no-visibility' | 'complex-erps',
  scroll_depth: number,
  timestamp: ISO8601
})
```

### Event 5: Signup Start
```typescript
posthog.capture('signup_start', {
  variant: 'financial-management' | 'erp-platform',
  entry_point: 'hero' | 'pricing' | 'features' | 'navigation',
  timestamp: ISO8601
})
```

---

## 3. Dashboard Panels

Create a new dashboard named **"ERP Positioning A/B Test"** with the following panels:

### Panel 1: Conversion Funnel
**Type**: Funnel Chart

**Steps**:
1. `landing_page_view` (Entry)
2. `cta_click` (Engagement)
3. `signup_start` (Conversion)

**Breakdown**: By `variant` property

**Goal**: Measure conversion rate from page view to signup for each variant

---

### Panel 2: Scroll Depth Heatmap
**Type**: Heatmap

**Event**: `landing_page_view`

**Y-axis**: `scroll_depth` (0-100%)

**X-axis**: Time of day (hourly buckets)

**Breakdown**: By `variant`

**Goal**: Identify which variant keeps users engaged longer

---

### Panel 3: CTA Performance
**Type**: Bar Chart

**Event**: `cta_click`

**Grouping**: By `cta_location`

**Breakdown**: By `variant`

**Goal**: Compare CTA click rates across different page sections

---

### Panel 4: Problem Section Engagement
**Type**: Trend Line

**Event**: `problem_section_view`

**Grouping**: By `problem_type`

**Breakdown**: By `variant`

**Time Range**: Last 30 days

**Goal**: Measure which problem sections resonate with each variant's audience

---

### Panel 5: Feature Interest
**Type**: Pie Chart

**Event**: `feature_navigation`

**Grouping**: By `feature_clicked`

**Filters**: Split into two pie charts (one per variant)

**Goal**: Understand feature interest distribution for each positioning

---

### Panel 6: Time to Conversion
**Type**: Box Plot

**Metric**: Time between `landing_page_view` and `signup_start`

**Breakdown**: By `variant`

**Goal**: Measure how quickly each variant drives users to signup

---

### Panel 7: Bounce Rate
**Type**: Single Value

**Metric**: Percentage of sessions with only `landing_page_view` (no other events)

**Breakdown**: By `variant`

**Goal**: Identify which variant has better initial engagement

---

### Panel 8: Session Duration
**Type**: Histogram

**Metric**: Session duration (time between first and last event)

**Breakdown**: By `variant`

**Goal**: Compare overall engagement time between variants

---

## 4. Success Metrics

### Primary Metrics
- **Conversion Rate**: % of visitors who click "signup_start"
- **CTR (Call-to-Action)**: % of visitors who click any CTA
- **Bounce Rate**: % of visitors with only page view

### Secondary Metrics
- **Scroll Depth**: Average scroll depth per variant
- **Time to Conversion**: Median time from page view to signup
- **Problem Section Views**: Engagement with problem-oriented content
- **Feature Clicks**: Interest in specific features (inventory, automation, etc.)

### Statistical Significance
- **Minimum Sample Size**: 1,000 unique visitors per variant
- **Confidence Level**: 95%
- **Minimum Detectable Effect**: 10% relative improvement

---

## 5. Analysis Workflow

### Daily Checks
1. Monitor conversion rate for both variants
2. Check for anomalies in traffic distribution (should be 50/50)
3. Review bounce rate trends

### Weekly Reviews
1. Analyze funnel drop-off points
2. Compare CTA performance across sections
3. Review feature navigation patterns
4. Calculate statistical significance

### Decision Criteria
Declare a winner when:
- Statistical significance ≥95%
- Minimum 2,000 visitors per variant
- Consistent performance for 7+ days
- Conversion lift ≥10%

---

## 6. Implementation Checklist

- [ ] Create feature flag `landing-page-erp-positioning`
- [ ] Configure 50/50 split test
- [ ] Verify events are firing correctly (use PostHog live events)
- [ ] Create dashboard with 8 panels
- [ ] Set up automated weekly reports
- [ ] Document baseline metrics before launch
- [ ] Schedule weekly review meetings
- [ ] Set calendar reminder for statistical significance check

---

## 7. Troubleshooting

### Events not appearing
- Check PostHog initialization in `Landing.astro`
- Verify `VITE_POSTHOG_KEY` environment variable is set
- Confirm events are using correct property names
- Check browser console for PostHog errors

### Uneven traffic split
- Verify feature flag rollout percentage is 50/50
- Check for caching issues (CDN may cache variant assignment)
- Ensure `distinctId` is properly set for returning users

### Low statistical confidence
- Increase test duration (wait for more traffic)
- Review traffic sources (ensure diverse user base)
- Check for seasonal effects or external factors

---

## 8. Expected Outcomes

### If Variant B (ERP) Wins
- Roll out ERP positioning to 100% of users
- Update all marketing materials with ERP messaging
- Emphasize inventory, automation, and enterprise features
- Target small business owners and operations managers

### If Variant A (Financial Management) Wins
- Keep current positioning
- Focus on personal finance and SMB finance management
- Emphasize simplicity and ease of use
- Target freelancers, solopreneurs, and small teams

---

## Notes

- Test duration: Recommended 4-6 weeks for statistical significance
- Traffic requirements: Minimum 2,000 unique visitors per variant
- All events are automatically tracked via the scroll tracker and click handlers implemented in the landing page
- PostHog session replay is enabled for qualitative analysis of user behavior

---

## References

- PostHog Feature Flags: https://posthog.com/docs/feature-flags
- PostHog Experimentation: https://posthog.com/docs/experiments
- Statistical Significance Calculator: https://posthog.com/docs/experiments/significance
