import { motion } from "motion/react";

type Logo = {
   href: string;
   label: string;
   src: string;
   width: number;
   height: number;
};

const logos: Logo[] = [
   {
      href: "https://licitei.com.br",
      label: "Licitei",
      src: "/logos/licitei.svg",
      width: 102,
      height: 22,
   },
   {
      href: "https://www.somahub.net.br/",
      label: "Soma Hub",
      src: "/logos/somahub.webp",
      width: 167,
      height: 40,
   },
];

const loop = [...logos, ...logos, ...logos, ...logos];

export function SocialProofMarquee() {
   return (
      <div
         className="relative w-full overflow-hidden"
         style={{
            maskImage:
               "linear-gradient(to right, transparent, black 12%, black 88%, transparent)",
            WebkitMaskImage:
               "linear-gradient(to right, transparent, black 12%, black 88%, transparent)",
         }}
      >
         <motion.div
            className="flex w-max items-center gap-12 sm:gap-16"
            animate={{ x: ["0%", "-50%"] }}
            transition={{
               duration: 20,
               repeat: Infinity,
               ease: "linear",
            }}
         >
            {loop.map((logo, i) => (
               <a
                  key={`${logo.label}-${i}`}
                  href={logo.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex shrink-0 items-center justify-center opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0"
                  aria-label={logo.label}
               >
                  <img
                     src={logo.src}
                     alt={logo.label}
                     width={logo.width}
                     height={logo.height}
                     loading="lazy"
                     decoding="async"
                     className="h-7 w-auto sm:h-8"
                  />
               </a>
            ))}
         </motion.div>
      </div>
   );
}
