import type { Consequence } from "@packages/database/schema";
import { addTagHandler } from "./handlers/add-tag";
import { createTransactionHandler } from "./handlers/create-transaction";
import { fetchBillsReportHandler } from "./handlers/fetch-bills-report";
import { formatDataHandler } from "./handlers/format-data";
import { markAsTransferHandler } from "./handlers/mark-as-transfer";
import { removeTagHandler } from "./handlers/remove-tag";
import { sendBillsDigestHandler } from "./handlers/send-bills-digest";
import { sendEmailHandler } from "./handlers/send-email";
import { sendPushNotificationHandler } from "./handlers/send-push-notification";
import { setCategoryHandler } from "./handlers/set-category";
import { setCostCenterHandler } from "./handlers/set-cost-center";
import { stopExecutionHandler } from "./handlers/stop-execution";
import { updateDescriptionHandler } from "./handlers/update-description";
import type { ActionHandler } from "./types";

type ActionType = Consequence["type"];

const handlers = new Map<ActionType, ActionHandler>();

export function registerActionHandler(handler: ActionHandler): void {
   handlers.set(handler.type, handler);
}

export function unregisterActionHandler(type: ActionType): boolean {
   return handlers.delete(type);
}

export function getActionHandler(type: ActionType): ActionHandler | undefined {
   return handlers.get(type);
}

export function hasActionHandler(type: ActionType): boolean {
   return handlers.has(type);
}

export function getRegisteredActionTypes(): ActionType[] {
   return Array.from(handlers.keys());
}

export function initializeDefaultHandlers(): void {
   registerActionHandler(setCategoryHandler);
   registerActionHandler(addTagHandler);
   registerActionHandler(removeTagHandler);
   registerActionHandler(setCostCenterHandler);
   registerActionHandler(updateDescriptionHandler);
   registerActionHandler(createTransactionHandler);
   registerActionHandler(markAsTransferHandler);
   registerActionHandler(sendPushNotificationHandler);
   registerActionHandler(sendEmailHandler);
   registerActionHandler(sendBillsDigestHandler);
   registerActionHandler(fetchBillsReportHandler);
   registerActionHandler(formatDataHandler);
   registerActionHandler(stopExecutionHandler);
}

initializeDefaultHandlers();
