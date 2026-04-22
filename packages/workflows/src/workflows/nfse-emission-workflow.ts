import dayjs from "dayjs";
import { fromPromise } from "neverthrow";
import { DBOS } from "@dbos-inc/dbos-sdk";
import Steel from "steel-sdk";
import { chromium } from "playwright";
import { createEnqueuer, QUEUES } from "../workflow-factory";
import { NOTIFICATION_TYPES } from "@packages/notifications/types";
import type { JobNotification } from "@packages/notifications/schema";
import { getPublisher } from "../context";

export type NfseEmissionInput = {
   teamId: string;
   steelApiKey: string;
   prestador: {
      cnpj: string;
      inscricaoMunicipal: string;
   };
   tomador: {
      cnpjCpf: string;
      razaoSocial: string;
      email?: string;
   };
   servico: {
      discriminacao: string;
      valorServicos: number;
      codigoAtividade: string;
      competencia: string;
   };
   rps: {
      serie: string;
      numero: number;
   };
};

export type NfseEmissionResult =
   | { success: true; numeroNota: string; sessionViewerUrl: string }
   | { success: false; error: string; sessionViewerUrl: string };

async function publishFailed(
   publisher: ReturnType<typeof getPublisher>,
   teamId: string,
   msg: string,
   stepName: string,
) {
   await DBOS.runStep(
      () =>
         publisher.publish("job.notification", {
            jobId: crypto.randomUUID(),
            type: NOTIFICATION_TYPES.NFSE_EMISSION_COMPLETED,
            status: "failed",
            message: msg,
            teamId,
            timestamp: dayjs().toISOString(),
         } satisfies JobNotification),
      { name: stepName },
   );
}

async function nfseEmissionWorkflowFn(
   input: NfseEmissionInput,
): Promise<NfseEmissionResult> {
   const publisher = getPublisher();
   const ctx = `[nfse-emission] team=${input.teamId} rps=${input.rps.serie}-${input.rps.numero}`;

   DBOS.logger.info(`${ctx} started prestador=${input.prestador.cnpj}`);

   await DBOS.runStep(
      () =>
         publisher.publish("job.notification", {
            jobId: crypto.randomUUID(),
            type: NOTIFICATION_TYPES.NFSE_EMISSION_COMPLETED,
            status: "started",
            message: `Emitindo NFS-e RPS ${input.rps.serie}-${input.rps.numero}...`,
            teamId: input.teamId,
            timestamp: dayjs().toISOString(),
         } satisfies JobNotification),
      { name: "publishStarted" },
   );

   // Step 1: Create steel.dev cloud browser session
   const sessionResult = await fromPromise(
      DBOS.runStep(
         async () => {
            const client = new Steel({ steelAPIKey: input.steelApiKey });
            const session = await client.sessions.create({
               // TODO: configure proxy and stealth settings for production
               timeout: 300000,
            });
            DBOS.logger.info(
               `${ctx} steel session created id=${session.id} viewerUrl=${session.sessionViewerUrl}`,
            );
            return {
               sessionId: session.id,
               sessionViewerUrl: session.sessionViewerUrl ?? "",
               websocketUrl: session.websocketUrl ?? "",
            };
         },
         { name: "createSteelSession" },
      ),
      (e) => (e instanceof Error ? e.message : String(e)),
   );

   if (sessionResult.isErr()) {
      DBOS.logger.error(
         `${ctx} failed to create steel session: ${sessionResult.error}`,
      );
      await publishFailed(
         publisher,
         input.teamId,
         `Falha ao criar sessão de navegador: ${sessionResult.error}`,
         "publishFailed",
      );
      return {
         success: false,
         error: `Falha ao criar sessão de navegador: ${sessionResult.error}`,
         sessionViewerUrl: "",
      };
   }

   const { sessionId, sessionViewerUrl, websocketUrl } = sessionResult.value;

   // Step 2: Navigate nfse.gov.br and fill NFS-e form
   // Always release session in a cleanup step — even on failure
   const emissionResult = await fromPromise(
      DBOS.runStep(
         async () => {
            const browser = await chromium.connectOverCDP(websocketUrl);
            const context =
               browser.contexts()[0] ?? (await browser.newContext());
            const page = context.pages()[0] ?? (await context.newPage());

            // TODO: Replace with the actual municipality-specific nfse.gov.br URL
            // The portal URL varies by municipality — this is the federal gateway
            await page.goto("https://www.nfse.gov.br/EmissorNacional/Login", {
               waitUntil: "networkidle",
               timeout: 60000,
            });

            DBOS.logger.info(`${ctx} navigated to nfse.gov.br login`);

            // TODO: Implement actual login flow
            // Production flow requires gov.br OAuth / certificate-based auth (A1/A3)
            // For POC: assume user is pre-authenticated or use session cookies
            // await page.fill("#cpf-cnpj", input.prestador.cnpj);
            // await page.click("#btn-login");
            // await page.waitForNavigation({ waitUntil: "networkidle" });

            // Navigate to RPS emission form
            // TODO: Actual navigation depends on municipality portal structure
            // Most ABRASF-compliant portals follow this pattern:
            await page.goto(
               "https://www.nfse.gov.br/EmissorNacional/NotaFiscal/Emitir",
               { waitUntil: "networkidle", timeout: 60000 },
            );

            DBOS.logger.info(`${ctx} navigated to RPS emission form`);

            // Fill RPS fields (ABRASF standard)
            // TODO: Selectors must be validated against the live portal DOM
            await page.selectOption("#tipo-rps", "RPS");
            await page.fill("#serie-rps", input.rps.serie);
            await page.fill("#numero-rps", String(input.rps.numero));

            // Competência: YYYY-MM → MM/YYYY for display
            const [year, month] = input.servico.competencia.split("-");
            await page.fill("#competencia", `${month}/${year}`);

            // Natureza da operação: 1 = Tributada no município (most common)
            await page.selectOption("#natureza-operacao", "1");

            // ISS Retido: Não (default for most cases)
            await page.selectOption("#iss-retido", "0");

            // Prestador fields — usually pre-filled after auth, but set defensively
            await page.fill("#cnpj-prestador", input.prestador.cnpj);
            await page.fill(
               "#inscricao-municipal",
               input.prestador.inscricaoMunicipal,
            );

            // Tomador fields
            await page.fill("#cnpj-cpf-tomador", input.tomador.cnpjCpf);
            await page.fill("#razao-social-tomador", input.tomador.razaoSocial);
            if (input.tomador.email) {
               await page.fill("#email-tomador", input.tomador.email);
            }

            // Serviço fields
            await page.fill("#discriminacao", input.servico.discriminacao);

            // Valor em reais (centavos → reais)
            const valorReais = (input.servico.valorServicos / 100).toFixed(2);
            await page.fill("#valor-servicos", valorReais);

            await page.fill("#codigo-atividade", input.servico.codigoAtividade);

            DBOS.logger.info(`${ctx} form filled, submitting`);

            // Submit form
            // TODO: Confirm submit button selector and any confirmation modal
            await page.click("#btn-emitir");
            await page.waitForNavigation({
               waitUntil: "networkidle",
               timeout: 60000,
            });

            // Extract nota number from success page
            // TODO: Adjust selector to match actual portal response DOM
            const numeroNota = await page
               .locator("#numero-nota-emitida")
               .textContent({ timeout: 15000 });

            if (!numeroNota) {
               throw new Error(
                  "Número da nota não encontrado na página de confirmação",
               );
            }

            DBOS.logger.info(
               `${ctx} NFS-e emitida com sucesso numero=${numeroNota.trim()}`,
            );

            await browser.close();

            return numeroNota.trim();
         },
         { name: "fillAndSubmitNfse" },
      ),
      (e) => (e instanceof Error ? e.message : String(e)),
   );

   // Step 3: Always release steel session — equivalent to finally block
   await fromPromise(
      DBOS.runStep(
         async () => {
            const client = new Steel({ steelAPIKey: input.steelApiKey });
            await client.sessions.release(sessionId);
            DBOS.logger.info(`${ctx} steel session released id=${sessionId}`);
         },
         { name: "releaseSteelSession" },
      ),
      (e) => {
         DBOS.logger.warn(
            `${ctx} failed to release steel session: ${e instanceof Error ? e.message : String(e)}`,
         );
         return e instanceof Error ? e.message : String(e);
      },
   );

   if (emissionResult.isErr()) {
      DBOS.logger.error(
         `${ctx} NFS-e emission failed: ${emissionResult.error}`,
      );
      await publishFailed(
         publisher,
         input.teamId,
         `Falha ao emitir NFS-e: ${emissionResult.error}`,
         "publishFailed",
      );
      return {
         success: false,
         error: `Falha ao emitir NFS-e: ${emissionResult.error}`,
         sessionViewerUrl,
      };
   }

   const numeroNota = emissionResult.value;

   await DBOS.runStep(
      () =>
         publisher.publish("job.notification", {
            jobId: crypto.randomUUID(),
            type: NOTIFICATION_TYPES.NFSE_EMISSION_COMPLETED,
            status: "completed",
            message: `NFS-e emitida com sucesso. Nota nº ${numeroNota}.`,
            payload: { numeroNota },
            teamId: input.teamId,
            timestamp: dayjs().toISOString(),
         } satisfies JobNotification),
      { name: "publishCompleted" },
   );

   DBOS.logger.info(`${ctx} completed numeroNota=${numeroNota}`);

   return { success: true, numeroNota, sessionViewerUrl };
}

export const nfseEmissionWorkflow = DBOS.registerWorkflow(
   nfseEmissionWorkflowFn,
);

export const enqueueNfseEmissionWorkflow = createEnqueuer<NfseEmissionInput>(
   nfseEmissionWorkflowFn.name,
   QUEUES.nfseEmission,
   (i) => `nfse-emission-${i.teamId}-${i.rps.serie}-${i.rps.numero}`,
);
