import { motion } from "motion/react";

const KW = "text-chart-6";
const FN = "text-chart-2";
const STR = "text-chart-5";
const KEY = "text-primary";
const COM = "text-muted-foreground";

const code = [
   {
      n: 1,
      html: `<span class="${KW}">import</span> { hyprpay } <span class="${KW}">from</span> <span class="${STR}">"@/lib/hyprpay"</span>;`,
   },
   {
      n: 2,
      html: `<span class="${KW}">import</span> { ok, err, safeTry } <span class="${KW}">from</span> <span class="${STR}">"neverthrow"</span>;`,
   },
   { n: 3, html: "&nbsp;" },
   {
      n: 4,
      html: `<span class="${COM}">// Cobra por uso, dentro do seu próprio código. Zero throws.</span>`,
   },
   {
      n: 5,
      html: `<span class="${KW}">export const</span> <span class="${FN}">generateAI</span> = (<span class="${KEY}">input</span>: <span class="${FN}">string</span>) =&gt;`,
   },
   {
      n: 6,
      html: `&nbsp;&nbsp;<span class="${FN}">safeTry</span>(<span class="${KW}">async function</span>* () {`,
   },
   {
      n: 7,
      html: `&nbsp;&nbsp;&nbsp;&nbsp;<span class="${KW}">const</span> { allowed, remaining } = <span class="${KW}">yield</span>* hyprpay.api.<span class="${FN}">check</span>({`,
   },
   {
      n: 8,
      html: `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="${KEY}">feature</span>: <span class="${STR}">"ai_tokens"</span>,`,
   },
   { n: 9, html: "&nbsp;&nbsp;&nbsp;&nbsp;});" },
   { n: 10, html: "&nbsp;" },
   {
      n: 11,
      html: `&nbsp;&nbsp;&nbsp;&nbsp;<span class="${KW}">if</span> (!allowed) <span class="${KW}">return</span> <span class="${FN}">err</span>(<span class="${KW}">new</span> <span class="${FN}">QuotaError</span>(remaining));`,
   },
   { n: 12, html: "&nbsp;" },
   {
      n: 13,
      html: `&nbsp;&nbsp;&nbsp;&nbsp;<span class="${KW}">const</span> result = <span class="${KW}">await</span> ai.<span class="${FN}">generate</span>(input);`,
   },
   { n: 14, html: "&nbsp;" },
   {
      n: 15,
      html: `&nbsp;&nbsp;&nbsp;&nbsp;<span class="${KW}">yield</span>* hyprpay.api.<span class="${FN}">track</span>({`,
   },
   {
      n: 16,
      html: `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="${KEY}">feature</span>: <span class="${STR}">"ai_tokens"</span>,`,
   },
   {
      n: 17,
      html: `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="${KEY}">value</span>: result.<span class="${KEY}">tokens</span>,`,
   },
   { n: 18, html: "&nbsp;&nbsp;&nbsp;&nbsp;});" },
   { n: 19, html: "&nbsp;" },
   {
      n: 20,
      html: `&nbsp;&nbsp;&nbsp;&nbsp;<span class="${KW}">return</span> <span class="${FN}">ok</span>(result);`,
   },
   { n: 21, html: "&nbsp;&nbsp;});" },
];

export function HeroCodeMock() {
   return (
      <motion.figure
         className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-border/40 bg-background shadow-2xl shadow-background/70"
         initial={{ opacity: 0, y: 32, scale: 0.97 }}
         animate={{ opacity: 1, y: 0, scale: 1 }}
         transition={{ duration: 0.7, delay: 0.1, ease: [0.32, 0.72, 0, 1] }}
      >
         <pre className="max-w-full overflow-x-auto p-2 text-xs leading-6 text-foreground sm:p-4 sm:text-sm">
            <code>
               {code.map((line, i) => (
                  <motion.div
                     key={line.n}
                     className="flex gap-4 whitespace-nowrap"
                     initial={{ opacity: 0, x: -8 }}
                     animate={{ opacity: 1, x: 0 }}
                     transition={{ duration: 0.3, delay: 0.3 + i * 0.03 }}
                  >
                     <span className="w-6 shrink-0 text-right text-muted-foreground">
                        {line.n}
                     </span>
                     <span dangerouslySetInnerHTML={{ __html: line.html }} />
                  </motion.div>
               ))}
            </code>
         </pre>
      </motion.figure>
   );
}
