import {
   Dialog,
   DialogContent,
} from "@packages/ui/components/dialog";
import { Store, useStore } from "@tanstack/react-store";
import { SurveyModalContent } from "@/features/feedback/ui/survey-modal-content";

interface SurveyModalState {
   isOpen: boolean;
   surveyId: string | null;
   title?: string;
   description?: string;
   extraPayload?: Record<string, unknown>;
}

const initialState: SurveyModalState = { isOpen: false, surveyId: null };

const surveyModalStore = new Store<SurveyModalState>(initialState);

type OpenSurveyOptions = {
   title?: string;
   description?: string;
   extraPayload?: Record<string, unknown>;
};

export function openSurveyModal(surveyId: string, options?: OpenSurveyOptions) {
   surveyModalStore.setState(() => ({
      isOpen: true,
      surveyId,
      title: options?.title,
      description: options?.description,
      extraPayload: options?.extraPayload,
   }));
}

export function useSurveyModal() {
   return {
      openSurveyModal,
      closeSurveyModal: () => surveyModalStore.setState(() => initialState),
   };
}

export function GlobalSurveyModal() {
   const state = useStore(surveyModalStore, (s) => s);

   const close = () => surveyModalStore.setState(() => initialState);

   return (
      <Dialog onOpenChange={(open) => { if (!open) close(); }} open={state.isOpen}>
         <DialogContent className="max-w-lg">
            {state.surveyId && (
               <SurveyModalContent
                  description={state.description}
                  extraPayload={state.extraPayload}
                  onClose={close}
                  surveyId={state.surveyId}
                  title={state.title}
               />
            )}
         </DialogContent>
      </Dialog>
   );
}
