import { Store } from "@tanstack/react-store";

interface ErrorModalState {
   isOpen: boolean;
   message: string;
   code: string;
}

export const errorModalStore = new Store<ErrorModalState>({
   isOpen: false,
   message: "",
   code: "",
});

export function openErrorModal(message: string, code: string) {
   errorModalStore.setState(() => ({ isOpen: true, message, code }));
}

export function closeErrorModal() {
   errorModalStore.setState(() => ({ isOpen: false, message: "", code: "" }));
}
