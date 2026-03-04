import {
   createFileRoute,
   Outlet,
   redirect,
   useLocation,
} from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
   beforeLoad: async ({ context, location }) => {
      // Get session from cache (prefetched in __root.tsx)
      const session = await context.queryClient.fetchQuery(
         context.orpc.session.getSession.queryOptions({}),
      );

      // If user is authenticated and not already on callback, redirect to callback
      // The callback route handles post-login routing (fetching orgs, etc.)
      if (session?.user && !location.pathname.includes("/auth/callback")) {
         throw redirect({ to: "/auth/callback" });
      }
   },
   component: AuthLayout,
});

function AuthLayout() {
   const location = useLocation();

   return (
      <div className="flex min-h-screen w-full overflow-hidden bg-background">
         {/* Form Panel - First on mobile and desktop */}
         <main className="flex flex-1 flex-col justify-center items-center px-4 py-8 md:px-8 lg:px-12 order-1 lg:order-1">
            {/* Mobile Logo */}
            <div className="lg:hidden mb-8">
               <div className="flex items-center gap-2">
                  <img alt="Montte" className="w-10 h-10" src="/favicon.svg" />
                  <span className="text-xl font-semibold">Montte</span>
               </div>
            </div>

            <section
               className="w-full max-w-md duration-500 animate-in slide-in-from-bottom-4 fade-in"
               key={location.pathname}
            >
               <section aria-label="Authentication">
                  <Outlet />
               </section>
            </section>
         </main>

         {/* Brand Panel - Hidden on mobile, on the right */}
         <aside className="hidden lg:flex lg:w-[40%] relative flex-col justify-between bg-gradient-to-br from-primary via-primary/95 to-primary/85 p-8 xl:p-12 order-2">
            {/* Background Pattern */}
            <div
               aria-hidden="true"
               className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.1)_1px,transparent_0)] bg-[size:32px_32px]"
            />

            {/* Content */}
            <div className="relative z-10">
               <div className="flex items-center gap-3">
                  <img
                     alt="Montte"
                     className="w-10 h-10 brightness-0 invert"
                     src="/favicon.svg"
                  />
                  <span className="text-xl font-semibold text-white">
                     Montte
                  </span>
               </div>
            </div>

            {/* Center Content - Illustration & Tagline */}
            <div className="relative z-10 space-y-8">
               {/* ERP Dashboard Illustration */}
               <div className="relative">
                  <svg
                     className="w-full max-w-md mx-auto opacity-90"
                     fill="none"
                     viewBox="0 0 400 300"
                     xmlns="http://www.w3.org/2000/svg"
                  >
                     <title>ERP inteligente com IA</title>

                     {/* Main dashboard window */}
                     <rect
                        height="190"
                        rx="8"
                        stroke="rgba(255,255,255,0.3)"
                        strokeWidth="2"
                        width="260"
                        x="70"
                        y="50"
                     />

                     {/* Dashboard title bar */}
                     <rect
                        fill="rgba(255,255,255,0.1)"
                        height="24"
                        rx="8"
                        width="260"
                        x="70"
                        y="50"
                     />
                     <circle
                        cx="85"
                        cy="62"
                        fill="rgba(255,255,255,0.3)"
                        r="4"
                     />
                     <circle
                        cx="98"
                        cy="62"
                        fill="rgba(255,255,255,0.2)"
                        r="4"
                     />
                     <circle
                        cx="111"
                        cy="62"
                        fill="rgba(255,255,255,0.15)"
                        r="4"
                     />

                     {/* KPI cards row */}
                     <rect
                        fill="rgba(255,255,255,0.12)"
                        height="40"
                        rx="4"
                        width="70"
                        x="82"
                        y="84"
                     />
                     <rect
                        fill="rgba(255,255,255,0.3)"
                        height="4"
                        rx="2"
                        width="40"
                        x="90"
                        y="92"
                     />
                     <rect
                        fill="rgba(255,255,255,0.5)"
                        height="6"
                        rx="3"
                        width="50"
                        x="90"
                        y="104"
                     />

                     <rect
                        fill="rgba(255,255,255,0.12)"
                        height="40"
                        rx="4"
                        width="70"
                        x="164"
                        y="84"
                     />
                     <rect
                        fill="rgba(255,255,255,0.3)"
                        height="4"
                        rx="2"
                        width="40"
                        x="172"
                        y="92"
                     />
                     <rect
                        fill="rgba(255,255,255,0.5)"
                        height="6"
                        rx="3"
                        width="50"
                        x="172"
                        y="104"
                     />

                     <rect
                        fill="rgba(255,255,255,0.12)"
                        height="40"
                        rx="4"
                        width="70"
                        x="246"
                        y="84"
                     />
                     <rect
                        fill="rgba(255,255,255,0.3)"
                        height="4"
                        rx="2"
                        width="40"
                        x="254"
                        y="92"
                     />
                     <rect
                        fill="rgba(255,255,255,0.5)"
                        height="6"
                        rx="3"
                        width="50"
                        x="254"
                        y="104"
                     />

                     {/* Bar chart */}
                     <rect
                        fill="rgba(255,255,255,0.35)"
                        height="55"
                        rx="2"
                        width="12"
                        x="90"
                        y="145"
                     />
                     <rect
                        fill="rgba(255,255,255,0.25)"
                        height="40"
                        rx="2"
                        width="12"
                        x="110"
                        y="160"
                     />
                     <rect
                        fill="rgba(255,255,255,0.4)"
                        height="65"
                        rx="2"
                        width="12"
                        x="130"
                        y="135"
                     />
                     <rect
                        fill="rgba(255,255,255,0.3)"
                        height="45"
                        rx="2"
                        width="12"
                        x="150"
                        y="155"
                     />
                     <rect
                        fill="rgba(255,255,255,0.45)"
                        height="70"
                        rx="2"
                        width="12"
                        x="170"
                        y="130"
                     />
                     <rect
                        fill="rgba(255,255,255,0.2)"
                        height="35"
                        rx="2"
                        width="12"
                        x="190"
                        y="165"
                     />

                     {/* Trend line overlay */}
                     <path
                        d="M96 150 L116 162 L136 138 L156 158 L176 132 L196 168"
                        fill="none"
                        stroke="rgba(255,255,255,0.6)"
                        strokeLinecap="round"
                        strokeWidth="2"
                     />

                     {/* Right side - mini table/list */}
                     <rect
                        fill="rgba(255,255,255,0.15)"
                        height="3"
                        rx="1.5"
                        width="80"
                        x="220"
                        y="140"
                     />
                     <rect
                        fill="rgba(255,255,255,0.1)"
                        height="3"
                        rx="1.5"
                        width="70"
                        x="220"
                        y="150"
                     />
                     <rect
                        fill="rgba(255,255,255,0.12)"
                        height="3"
                        rx="1.5"
                        width="75"
                        x="220"
                        y="160"
                     />
                     <rect
                        fill="rgba(255,255,255,0.1)"
                        height="3"
                        rx="1.5"
                        width="65"
                        x="220"
                        y="170"
                     />
                     <rect
                        fill="rgba(255,255,255,0.08)"
                        height="3"
                        rx="1.5"
                        width="72"
                        x="220"
                        y="180"
                     />

                     {/* AI sparkle icon */}
                     <g transform="translate(350, 95)">
                        <circle
                           cx="0"
                           cy="0"
                           fill="rgba(255,255,255,0.25)"
                           r="22"
                        />
                        <path
                           d="M0 -12 L2 -2 L12 0 L2 2 L0 12 L-2 2 L-12 0 L-2 -2 Z"
                           fill="rgba(255,255,255,0.7)"
                        />
                     </g>

                     {/* Secondary AI sparkle */}
                     <g transform="translate(45, 140)">
                        <circle
                           cx="0"
                           cy="0"
                           fill="rgba(255,255,255,0.15)"
                           r="14"
                        />
                        <path
                           d="M0 -7 L1.2 -1.2 L7 0 L1.2 1.2 L0 7 L-1.2 1.2 L-7 0 L-1.2 -1.2 Z"
                           fill="rgba(255,255,255,0.5)"
                        />
                     </g>

                     {/* Floating invoice/receipt card */}
                     <g transform="translate(20, 190)">
                        <rect
                           fill="rgba(255,255,255,0.1)"
                           height="55"
                           rx="6"
                           width="45"
                           x="0"
                           y="0"
                        />
                        <rect
                           fill="rgba(255,255,255,0.25)"
                           height="3"
                           rx="1.5"
                           width="30"
                           x="7"
                           y="10"
                        />
                        <rect
                           fill="rgba(255,255,255,0.12)"
                           height="2"
                           rx="1"
                           width="34"
                           x="7"
                           y="20"
                        />
                        <rect
                           fill="rgba(255,255,255,0.12)"
                           height="2"
                           rx="1"
                           width="28"
                           x="7"
                           y="26"
                        />
                        <rect
                           fill="rgba(255,255,255,0.2)"
                           height="3"
                           rx="1.5"
                           width="20"
                           x="7"
                           y="38"
                        />
                     </g>

                     {/* Connection dashes from AI to dashboard */}
                     <path
                        d="M350 117 Q 345 150, 330 170"
                        fill="none"
                        stroke="rgba(255,255,255,0.2)"
                        strokeDasharray="4 4"
                        strokeWidth="1.5"
                     />

                     {/* Floating circles */}
                     <circle
                        cx="55"
                        cy="80"
                        fill="rgba(255,255,255,0.15)"
                        r="8"
                     />
                     <circle
                        cx="365"
                        cy="250"
                        fill="rgba(255,255,255,0.12)"
                        r="10"
                     />
                     <circle
                        cx="200"
                        cy="270"
                        fill="rgba(255,255,255,0.1)"
                        r="6"
                     />
                  </svg>
               </div>

               <div className="text-center space-y-4">
                  <h2 className="text-2xl xl:text-3xl font-serif font-semibold text-white">
                     Seu ERP com superpoderes de IA
                  </h2>
                  <p className="text-white/70 text-sm xl:text-base max-w-sm mx-auto">
                     Gerencie seu negocio com inteligencia artificial.
                     Financeiro, vendas e operacoes em um so lugar.
                  </p>
               </div>
            </div>

            {/* Footer */}
            <div className="relative z-10 text-white/50 text-xs">
               &copy; {new Date().getFullYear()} Montte. Todos os direitos
               reservados
            </div>
         </aside>
      </div>
   );
}
