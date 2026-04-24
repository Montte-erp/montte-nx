import { DBOS } from "@dbos-inc/dbos-sdk";
export class WorkflowError extends Error {
   code;
   data;
   constructor(message, code = 500, options) {
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
   static database(message, options) {
      return new WorkflowError(message, 500, options);
   }
   static notFound(message, options) {
      return new WorkflowError(message, 404, options);
   }
   static validation(message, options) {
      return new WorkflowError(message, 400, options);
   }
   static internal(message, options) {
      return new WorkflowError(message, 500, options);
   }
}
