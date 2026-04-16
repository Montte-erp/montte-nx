import dayjs from "dayjs";
import { DBOS } from "@dbos-inc/dbos-sdk";
import { createCategory } from "@core/database/repositories/categories-repository";
import { NOTIFICATION_TYPES } from "@packages/notifications/types";
import type { JobNotification } from "@packages/notifications/schema";
import { jobPublisher } from "@/integrations/dbos/publisher";
import { db } from "@/integrations/singletons";
import { startDeriveKeywordsWorkflow } from "./runner";

type ImportCategory = {
   name: string;
   type: "income" | "expense";
   color: string | null;
   icon: string | null;
   keywords: string[] | null;
   participatesDre?: boolean;
   subcategories: { name: string; keywords?: string[] }[];
};

export type ImportBatchInput = {
   importId: string;
   teamId: string;
   organizationId: string;
   userId: string;
   stripeCustomerId: string | null;
   categories: ImportCategory[];
};

export class ImportBatchWorkflow {
   @DBOS.workflow()
   static async run(input: ImportBatchInput) {
      const ctx = `[import-batch] importId=${input.importId} team=${input.teamId}`;
      const total = input.categories.length;

      DBOS.logger.info(`${ctx} started total=${total}`);

      await ImportBatchWorkflow.publishStep({
         jobId: input.importId,
         type: NOTIFICATION_TYPES.IMPORT_BATCH,
         status: "started",
         message: `Importando ${total} categorias...`,
         teamId: input.teamId,
         timestamp: dayjs().toISOString(),
      });

      const BATCH_SIZE = 50;
      let created = 0;

      try {
         for (let i = 0; i < input.categories.length; i += BATCH_SIZE) {
            const batch = input.categories.slice(i, i + BATCH_SIZE);
            const parentCategories = await ImportBatchWorkflow.batchStep(
               batch,
               input.teamId,
               i,
            );

            created += batch.length;

            await ImportBatchWorkflow.publishStep({
               jobId: input.importId,
               type: NOTIFICATION_TYPES.IMPORT_BATCH,
               status: "progress",
               message: `Importando... ${created}/${total}`,
               payload: { importId: input.importId, created, total },
               teamId: input.teamId,
               timestamp: dayjs().toISOString(),
            });

            for (const parent of parentCategories) {
               startDeriveKeywordsWorkflow({
                  categoryId: parent.id,
                  teamId: input.teamId,
                  organizationId: input.organizationId,
                  userId: input.userId,
                  name: parent.name,
                  description: parent.description,
                  stripeCustomerId: input.stripeCustomerId,
               });
            }
         }
      } catch (e) {
         const msg = e instanceof Error ? e.message : String(e);
         DBOS.logger.error(`${ctx} failed: ${msg}`);
         await ImportBatchWorkflow.publishStep({
            jobId: input.importId,
            type: NOTIFICATION_TYPES.IMPORT_BATCH,
            status: "failed",
            message: `Falha ao importar categorias.`,
            teamId: input.teamId,
            timestamp: dayjs().toISOString(),
         });
         throw e;
      }

      await ImportBatchWorkflow.publishStep({
         jobId: input.importId,
         type: NOTIFICATION_TYPES.IMPORT_BATCH,
         status: "completed",
         message: `${created} categoria(s) importada(s) com sucesso.`,
         payload: { importId: input.importId, created, total },
         teamId: input.teamId,
         timestamp: dayjs().toISOString(),
      });

      DBOS.logger.info(`${ctx} completed created=${created}`);
   }

   @DBOS.step()
   static async batchStep(
      batch: ImportCategory[],
      teamId: string,
      offset: number,
   ) {
      DBOS.logger.debug(
         `[import-batch] batchStep offset=${offset} size=${batch.length}`,
      );
      const parentCategories: {
         id: string;
         name: string;
         description: string | null;
      }[] = [];

      await db.transaction(async (tx) => {
         for (const cat of batch) {
            const { subcategories, ...catData } = cat;
            const created = await createCategory(tx, teamId, {
               ...catData,
               participatesDre: catData.participatesDre ?? false,
            });
            parentCategories.push({
               id: created.id,
               name: created.name,
               description: created.description,
            });
            if (subcategories && subcategories.length > 0) {
               for (const sub of subcategories) {
                  await createCategory(tx, teamId, {
                     name: sub.name,
                     type: catData.type,
                     parentId: created.id,
                     participatesDre: false,
                     keywords: sub.keywords ?? null,
                  });
               }
            }
         }
      });

      return parentCategories;
   }

   @DBOS.step()
   static async publishStep(notification: JobNotification) {
      DBOS.logger.debug(
         `[import-batch] publishStep status=${notification.status} team=${notification.teamId}`,
      );
      await jobPublisher.publish("job.notification", notification);
   }
}
