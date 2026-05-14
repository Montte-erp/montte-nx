import type { CSSProperties } from "react";

interface AnimatedTextureProps {
   section: "footer" | "hero";
}

const videoTone: CSSProperties = {
   background:
      "linear-gradient(to bottom, var(--background) 0%, color-mix(in oklch, var(--secondary) 28%, var(--background)) 46%, var(--background) 100%)",
};

const heroFallback: CSSProperties = {
   backgroundImage: [
      "radial-gradient(ellipse at 74% 45%, color-mix(in oklch, var(--primary) 34%, transparent) 0%, transparent 36%)",
      "radial-gradient(ellipse at 62% 26%, color-mix(in oklch, var(--chart-2) 18%, transparent) 0%, transparent 34%)",
      "radial-gradient(ellipse at 86% 68%, color-mix(in oklch, var(--chart-5) 12%, transparent) 0%, transparent 34%)",
   ].join(", "),
};

const heroVideoMask: CSSProperties = {
   maskImage:
      "linear-gradient(to bottom, transparent 0%, black 10%, black 70%, transparent 100%)",
   WebkitMaskImage:
      "linear-gradient(to bottom, transparent 0%, black 10%, black 70%, transparent 100%)",
};

const footerVideoMask: CSSProperties = {
   maskImage:
      "linear-gradient(to bottom, transparent 0%, black 18%, black 100%)",
   WebkitMaskImage:
      "linear-gradient(to bottom, transparent 0%, black 18%, black 100%)",
};

export function AnimatedTexture(props: AnimatedTextureProps) {
   const isFooter = props.section === "footer";

   return (
      <>
         <div
            className="absolute inset-0 -z-30"
            style={videoTone}
            aria-hidden="true"
         />
         <div
            className="absolute inset-0 -z-20 opacity-70 mix-blend-screen"
            style={heroFallback}
            aria-hidden="true"
         />
         <div
            className="absolute inset-0 -z-20 overflow-hidden"
            style={isFooter ? footerVideoMask : heroVideoMask}
            aria-hidden="true"
         >
            <video
               className="size-full object-cover"
               src="/videos/montte-hero-bg.webm"
               autoPlay
               loop
               muted
               playsInline
               preload="metadata"
            />
         </div>
         <div
            className="absolute inset-0 -z-10"
            style={{
               background: isFooter
                  ? "linear-gradient(to bottom, color-mix(in oklch, var(--background) 90%, transparent) 0%, color-mix(in oklch, var(--background) 46%, transparent) 38%, color-mix(in oklch, var(--background) 68%, transparent) 100%)"
                  : "linear-gradient(to right, color-mix(in oklch, var(--background) 64%, transparent) 0%, color-mix(in oklch, var(--background) 34%, transparent) 40%, transparent 74%), linear-gradient(to bottom, color-mix(in oklch, var(--background) 8%, transparent) 0%, transparent 30%, color-mix(in oklch, var(--background) 76%, transparent) 100%)",
            }}
            aria-hidden="true"
         />
      </>
   );
}
