"use client";

import { useCallback } from "foxact/use-typescript-happy-callback";
import { useId, useMemo, type ReactElement, type ReactNode } from "react";
import { type ExternalToast, toast as sonnerToast } from "sonner";

type ToastId = NonNullable<ExternalToast["id"]>;
type ToastMessage = ReactNode | (() => ReactNode);
type ToastOptions = Omit<ExternalToast, "id">;
type ToastPromiseInput<Data> = Promise<Data> | (() => Promise<Data>);
type ToastPromiseMessage<Data> =
   | ReactNode
   | ((data: Data) => ReactNode | Promise<ReactNode>);
type ToastPromiseOptions<Data> = Omit<ToastOptions, "description"> & {
   description?: ToastPromiseMessage<Data>;
   error?: ReactNode | ((error: Error) => ReactNode | Promise<ReactNode>);
   finally?: () => void | Promise<void>;
   loading?: ReactNode;
   success?: ToastPromiseMessage<Data>;
};
type ToastPromiseResult<Data> = {
   unwrap: () => Promise<Data>;
};

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
         sonnerToast(message, withToastId(options)),
      [withToastId],
   );

   const success = useCallback(
      (message: ToastMessage, options?: ToastOptions) =>
         sonnerToast.success(message, withToastId(options)),
      [withToastId],
   );

   const info = useCallback(
      (message: ToastMessage, options?: ToastOptions) =>
         sonnerToast.info(message, withToastId(options)),
      [withToastId],
   );

   const warning = useCallback(
      (message: ToastMessage, options?: ToastOptions) =>
         sonnerToast.warning(message, withToastId(options)),
      [withToastId],
   );

   const error = useCallback(
      (message: ToastMessage, options?: ToastOptions) =>
         sonnerToast.error(message, withToastId(options)),
      [withToastId],
   );

   const loading = useCallback(
      (message: ToastMessage, options?: ToastOptions) =>
         sonnerToast.loading(message, withToastId(options)),
      [withToastId],
   );

   const message = useCallback(
      (message: ToastMessage, options?: ToastOptions) =>
         sonnerToast.message(message, withToastId(options)),
      [withToastId],
   );

   const custom = useCallback(
      (jsx: (id: ToastId) => ReactElement, options?: ToastOptions) =>
         sonnerToast.custom(jsx, withToastId(options)),
      [withToastId],
   );

   const dismiss = useCallback(() => sonnerToast.dismiss(id), [id]);

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

export function useToast() {
   const id = useId();
   return useToastActions(id);
}

export const toast = {
   custom: sonnerToast.custom,
   dismiss: sonnerToast.dismiss,
   error: sonnerToast.error,
   getHistory: sonnerToast.getHistory,
   getToasts: sonnerToast.getToasts,
   info: sonnerToast.info,
   loading: sonnerToast.loading,
   message: sonnerToast.message,
   promise: <Data>(
      promise: ToastPromiseInput<Data>,
      data?: ToastPromiseOptions<Data>,
   ): ToastPromiseResult<Data> => sonnerToast.promise(promise, data),
   success: sonnerToast.success,
   warning: sonnerToast.warning,
};
