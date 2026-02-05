// apps/landing-page/src/lib/scroll-tracker.ts

import type { TrackingContext } from "./analytics";
import { trackSectionViewed } from "./analytics";

const SCROLL_THRESHOLD = [0.1, 0.25, 0.5, 0.75, 0.9];
const DEBOUNCE_MS = 300;

export class ScrollTracker {
   private context: TrackingContext;
   private observers: Map<string, IntersectionObserver> = new Map();
   private viewedSections: Set<string> = new Set();
   private maxScrollDepth = 0;
   private debounceTimer: number | null = null;

   constructor(context: TrackingContext) {
      this.context = context;
   }

   trackSection(element: HTMLElement, sectionName: string) {
      if (this.observers.has(sectionName)) return;

      const observer = new IntersectionObserver(
         (entries) => {
            entries.forEach((entry) => {
               if (
                  entry.isIntersecting &&
                  !this.viewedSections.has(sectionName)
               ) {
                  this.viewedSections.add(sectionName);

                  const scrollDepth = this.calculateScrollDepth();
                  this.maxScrollDepth = Math.max(
                     this.maxScrollDepth,
                     scrollDepth,
                  );

                  if (this.debounceTimer) {
                     clearTimeout(this.debounceTimer);
                  }

                  this.debounceTimer = window.setTimeout(() => {
                     trackSectionViewed(this.context, sectionName, scrollDepth);
                  }, DEBOUNCE_MS);
               }
            });
         },
         { threshold: SCROLL_THRESHOLD },
      );

      observer.observe(element);
      this.observers.set(sectionName, observer);
   }

   private calculateScrollDepth(): number {
      const scrollTop = window.scrollY;
      const docHeight =
         document.documentElement.scrollHeight - window.innerHeight;
      return Math.round((scrollTop / docHeight) * 100);
   }

   getMaxScrollDepth(): number {
      return this.maxScrollDepth;
   }

   destroy() {
      for (const observer of this.observers.values()) {
         observer.disconnect();
      }
      this.observers.clear();
      if (this.debounceTimer) {
         clearTimeout(this.debounceTimer);
      }
   }
}
