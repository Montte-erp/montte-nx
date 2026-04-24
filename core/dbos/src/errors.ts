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

      DBOS.logger.error(
         {
            err: this,
            code,
            ...(options?.data ? { data: options.data } : {}),
            ...(options?.cause ? { cause: String(options.cause) } : {}),
         },
         message,
      );
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
