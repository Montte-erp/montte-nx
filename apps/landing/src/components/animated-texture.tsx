import type { CSSProperties } from "react";
import { useReducedMotion } from "motion/react";

interface AnimatedTextureProps {
   section: "footer" | "hero";
}

const footerTone: CSSProperties = {
   background:
      "linear-gradient(to bottom, var(--background) 0%, color-mix(in oklch, var(--secondary) 28%, var(--background)) 46%, var(--background) 100%)",
};

const heroFallback: CSSProperties = {
   backgroundImage: [
      "url('/videos/montte-hero-bg.webp')",
      "radial-gradient(ellipse at 74% 45%, color-mix(in oklch, var(--primary) 20%, transparent) 0%, transparent 36%)",
   ].join(", "),
   backgroundSize: "cover, auto",
   backgroundPosition: "center, center",
};

const heroVideoMask: CSSProperties = {
   maskImage:
      "linear-gradient(to bottom, black 0%, black 82%, transparent 100%)",
   WebkitMaskImage:
      "linear-gradient(to bottom, black 0%, black 82%, transparent 100%)",
};

const footerVideoMask: CSSProperties = {
   maskImage:
      "linear-gradient(to bottom, transparent 0%, black 18%, black 100%)",
   WebkitMaskImage:
      "linear-gradient(to bottom, transparent 0%, black 18%, black 100%)",
};

export function AnimatedTexture(props: AnimatedTextureProps) {
   const isFooter = props.section === "footer";
   const shouldReduceMotion = useReducedMotion();

   return (
      <>
         {isFooter && (
            <div
               className="absolute inset-0 -z-30"
               style={footerTone}
               aria-hidden="true"
            />
         )}
         {(!isFooter || shouldReduceMotion) && (
            <div
               className="absolute inset-0 -z-30 opacity-95"
               style={heroFallback}
               aria-hidden="true"
            />
         )}
         {!shouldReduceMotion && (
            <div
               className="absolute inset-0 -z-20 overflow-hidden opacity-95"
               style={isFooter ? footerVideoMask : heroVideoMask}
               aria-hidden="true"
            >
               <img
                  className="size-full object-cover"
                  src="/videos/montte-hero-bg.webp"
                  alt=""
                  loading="eager"
               />
            </div>
         )}
         <div
            className="absolute inset-0 -z-10"
            style={{
               background: isFooter
                  ? "linear-gradient(to bottom, color-mix(in oklch, var(--background) 90%, transparent) 0%, color-mix(in oklch, var(--background) 46%, transparent) 38%, color-mix(in oklch, var(--background) 68%, transparent) 100%)"
                  : "linear-gradient(to right, color-mix(in oklch, var(--background) 38%, transparent) 0%, color-mix(in oklch, var(--background) 18%, transparent) 40%, transparent 78%), linear-gradient(to bottom, color-mix(in oklch, var(--background) 6%, transparent) 0%, transparent 56%, color-mix(in oklch, var(--background) 70%, transparent) 100%)",
            }}
            aria-hidden="true"
         />
      </>
   );
}
