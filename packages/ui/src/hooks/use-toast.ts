"use client";

import { useCallback } from "foxact/use-typescript-happy-callback";
import { useMemo, type ReactElement, type ReactNode } from "react";
import { type ExternalToast, toast } from "sonner";

type ToastId = NonNullable<ExternalToast["id"]>;
type ToastMessage = ReactNode | (() => ReactNode);
type ToastOptions = Omit<ExternalToast, "id">;

export function useToastActions(id: ToastId) {
   const withToastId = useCallback(
      (options?: ToastOptions): ExternalToast => ({
         ...options,
         id,
      }),
      [id],
   );

   const show = useCallback(
      (message: ToastMessage, options?: ToastOptions) =>
         toast(message, withToastId(options)),
      [withToastId],
   );

   const success = useCallback(
      (message: ToastMessage, options?: ToastOptions) =>
         toast.success(message, withToastId(options)),
      [withToastId],
   );

   const info = useCallback(
      (message: ToastMessage, options?: ToastOptions) =>
         toast.info(message, withToastId(options)),
      [withToastId],
   );

   const warning = useCallback(
      (message: ToastMessage, options?: ToastOptions) =>
         toast.warning(message, withToastId(options)),
      [withToastId],
   );

   const error = useCallback(
      (message: ToastMessage, options?: ToastOptions) =>
         toast.error(message, withToastId(options)),
      [withToastId],
   );

   const loading = useCallback(
      (message: ToastMessage, options?: ToastOptions) =>
         toast.loading(message, withToastId(options)),
      [withToastId],
   );

   const message = useCallback(
      (message: ToastMessage, options?: ToastOptions) =>
         toast.message(message, withToastId(options)),
      [withToastId],
   );

   const custom = useCallback(
      (jsx: (id: ToastId) => ReactElement, options?: ToastOptions) =>
         toast.custom(jsx, withToastId(options)),
      [withToastId],
   );

   const dismiss = useCallback(() => toast.dismiss(id), [id]);

   return useMemo(
      () => ({
         custom,
         dismiss,
         error,
         info,
         loading,
         message,
         success,
         toast: show,
         warning,
      }),
      [custom, dismiss, error, info, loading, message, show, success, warning],
   );
}
