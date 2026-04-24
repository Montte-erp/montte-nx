import { DBOS } from "@dbos-inc/dbos-sdk";

export class WorkflowError extends Error {
   public readonly code: number;
   public readonly data?: unknown;

   constructor(
      message: string,
      code: number = 500,
      options?: { cause?: unknown; data?: unknown },
   ) {
      super(message);
      this.name = "WorkflowError";
      this.code = code;
      this.cause = options?.cause;
      this.data = options?.data;

      Error.captureStackTrace?.(this, WorkflowError);

      const logFn = code < 500 ? DBOS.logger.warn : DBOS.logger.error;
      logFn.call(DBOS.logger, {
         err: this,
         code,
         message,
         ...(options?.data ? { data: options.data } : {}),
         ...(options?.cause ? { cause: String(options.cause) } : {}),
      });
   }

   static database(
      message: string,
      options?: { cause?: unknown; data?: unknown },
   ): WorkflowError {
      return new WorkflowError(message, 500, options);
   }

   static notFound(
      message: string,
      options?: { cause?: unknown; data?: unknown },
   ): WorkflowError {
      return new WorkflowError(message, 404, options);
   }

   static validation(
      message: string,
      options?: { cause?: unknown; data?: unknown },
   ): WorkflowError {
      return new WorkflowError(message, 400, options);
   }

   static internal(
      message: string,
      options?: { cause?: unknown; data?: unknown },
   ): WorkflowError {
      return new WorkflowError(message, 500, options);
   }
}
