import {
   Tabs,
   TabsContent,
   TabsList,
   TabsTrigger,
} from "@packages/ui/components/tabs";
import { useEffect, useState } from "react";
import { CONTENT_CLASS, TRIGGER_CLASS, tabs } from "./tabs-config";

const TAB_IDS = tabs.map((t) => t.id);
const PARAM = "tab";

function readTab() {
   if (typeof window === "undefined") return tabs[0].id;
   const v = new URLSearchParams(window.location.search).get(PARAM);
   return v && TAB_IDS.includes(v) ? v : tabs[0].id;
}

export function HeroPosthogTabs() {
   const [value, setValue] = useState(tabs[0].id);

   useEffect(() => {
      setValue(readTab());
      const onPop = () => setValue(readTab());
      window.addEventListener("popstate", onPop);
      return () => window.removeEventListener("popstate", onPop);
   }, []);

   const onChange = (next: string) => {
      setValue(next);
      const url = new URL(window.location.href);
      url.searchParams.set(PARAM, next);
      window.history.replaceState({}, "", url);
   };

   return (
      <Tabs value={value} onValueChange={onChange} className="gap-0">
         <TabsList
            variant="connected"
            className="relative z-10 grid w-full translate-y-1 grid-cols-2 lg:grid-cols-4"
         >
            {tabs.map((tab) => (
               <TabsTrigger
                  className={TRIGGER_CLASS[tab.color]}
                  key={tab.id}
                  value={tab.id}
               >
                  {tab.label}
               </TabsTrigger>
            ))}
         </TabsList>

         {tabs.map((tab) => (
            <TabsContent
               className={`flex flex-col gap-4 rounded-md border-4 bg-card p-4 ${CONTENT_CLASS[tab.color]}`}
               key={tab.id}
               value={tab.id}
            >
               <h2 className="text-2xl leading-tight font-black tracking-[-0.045em]">
                  {tab.title}
               </h2>

               <div className="grid gap-4 text-sm leading-relaxed text-muted-foreground lg:grid-cols-2">
                  <p>{tab.left}</p>
                  <p>{tab.right}</p>
               </div>

               {tab.render()}
            </TabsContent>
         ))}
      </Tabs>
   );
}
