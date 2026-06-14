import {
   Result,
   TaggedError,
   type Result as BetterResult,
} from "better-result";
import { defineErrorCatalog } from "evlog";
import {
   fiscalDocuments,
   type FiscalDocument,
} from "@core/database/schemas/fiscal";
import type { ORPCContextWithOrganization } from "@core/orpc/context";
import type { JacobinaSaatriSecret } from "@modules/fiscal/services/fiscal-vault";

const jacobinaSaatriErrors = defineErrorCatalog("fiscal.jacobina-saatri", {
   PROVIDER_FAILED: {
      status: 502,
      message: "Falha técnica ao emitir NFS-e no SAATRI Jacobina.",
      tags: ["fiscal", "nfse", "jacobina-saatri"],
   },
   PERSIST_FAILED: {
      status: 500,
      message: "Falha ao persistir documento fiscal.",
      tags: ["fiscal", "nfse", "jacobina-saatri"],
   },
});

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "fiscal.jacobina-saatri": typeof jacobinaSaatriErrors;
   }
}

type JacobinaSaatriCatalogError =
   | ReturnType<typeof jacobinaSaatriErrors.PROVIDER_FAILED>
   | ReturnType<typeof jacobinaSaatriErrors.PERSIST_FAILED>;

export class JacobinaSaatriError extends TaggedError("JacobinaSaatriError")<{
   error: JacobinaSaatriCatalogError;
   message: string;
}>() {}

type DbClient = ORPCContextWithOrganization["db"];

type FiscalAddress = {
   readonly street: string;
   readonly number: string;
   readonly complement?: string;
   readonly district: string;
   readonly cityCode: string;
   readonly city: string;
   readonly state: string;
   readonly postalCode: string;
   readonly countryCode: string;
};

type TaxParty = {
   readonly legalName: string;
   readonly tradeName?: string;
   readonly cnpj?: string;
   readonly cpf?: string;
   readonly municipalRegistration?: string;
   readonly stateRegistration?: string;
   readonly email?: string;
   readonly phone?: string;
   readonly address: FiscalAddress;
};

type ServiceItem = {
   readonly description: string;
   readonly serviceListCode: string;
   readonly municipalTaxCode?: string;
   readonly nbsCode?: string;
   readonly amount: string;
   readonly taxRate?: string;
   readonly taxable: boolean;
};

type FiscalProviderError = {
   readonly code: string;
   readonly retryable: boolean;
   readonly message: string;
};

type FiscalArtifact = {
   readonly kind:
      | "request_xml"
      | "response_xml"
      | "authorized_xml"
      | "pdf"
      | "protocol";
   readonly mediaType: string;
   readonly bytes: Uint8Array;
};

type FiscalDocumentResponse = {
   readonly status: FiscalDocument["status"];
   readonly providerDocumentId?: string;
   readonly protocol?: string;
   readonly verificationUrl?: string;
   readonly rejections: readonly {
      code: string;
      message: string;
      correctionHint?: string;
   }[];
   readonly artifacts: readonly FiscalArtifact[];
};

type IssueResponse = {
   readonly documentRef: {
      readonly documentKind: "nfse";
      readonly providerId: string;
      readonly environment: "homologation" | "production";
      readonly issuerTaxId: string;
      readonly series: string;
      readonly number: string;
   };
   readonly providerResponse: FiscalDocumentResponse;
};

type FiscalProvider = {
   readonly manifest: {
      readonly id: string;
      readonly name: string;
      readonly documentKinds: readonly string[];
      readonly environments: readonly string[];
      readonly capabilities: readonly string[];
   };
   issue(
      input: IssueJacobinaNfseProviderInput,
   ): Promise<BetterResult<IssueResponse, FiscalProviderError>>;
};

export type JacobinaSaatriSigner = (
   xmlToSign: string,
) => Promise<BetterResult<string, FiscalProviderError>>;

export type JacobinaSaatriEvent = {
   readonly name: string;
   readonly providerId: string;
   readonly documentKind: "nfe" | "nfce" | "nfse";
   readonly environment: "homologation" | "production";
   readonly cityCode: string;
   readonly series: string;
   readonly number: string;
   readonly correlationId?: string;
};

export type JacobinaSaatriEventSink = (event: JacobinaSaatriEvent) => void;

type CreateProvider = (secret: JacobinaSaatriSecret) => FiscalProvider;

type IssueJacobinaNfseProviderInput = {
   readonly environment: "homologation" | "production";
   readonly documentKind: "nfse";
   readonly issuer: TaxParty;
   readonly customer: TaxParty;
   readonly services: readonly ServiceItem[];
   readonly series: string;
   readonly number: string;
   readonly issuedAt: string;
};

export type IssueJacobinaNfseInput = Omit<
   IssueJacobinaNfseProviderInput,
   "documentKind" | "issuer"
> & {
   issuer: Omit<TaxParty, "cnpj" | "municipalRegistration">;
};

export type IssueJacobinaNfseOptions = {
   db: DbClient;
   organizationId: string;
   teamId: string;
   secret: JacobinaSaatriSecret;
   input: IssueJacobinaNfseInput;
   createProvider?: CreateProvider;
};

function bytesToBase64(bytes: Uint8Array) {
   return Buffer.from(bytes).toString("base64");
}

async function createDefaultProvider(
   secret: JacobinaSaatriSecret,
   input: IssueJacobinaNfseInput,
) {
   const module = await import("@dfe-kit/jacobina-saatri");
   return module.createJacobinaSaatriProvider(
      {
         username: secret.username,
         password: secret.password,
         issuerCnpj: secret.issuerTaxId,
         municipalRegistration: secret.municipalRegistration,
      },
      {
         environment: input.environment,
      },
   );
}

export function createUnsupportedSigner(): JacobinaSaatriSigner {
   return async (xmlToSign) => Result.ok(xmlToSign);
}

export function createNoopEventSink(): JacobinaSaatriEventSink {
   return () => undefined;
}

export async function issueJacobinaNfse(
   options: IssueJacobinaNfseOptions,
): Promise<
   BetterResult<
      { document: FiscalDocument; providerResponse: FiscalDocumentResponse },
      JacobinaSaatriError
   >
> {
   const provider = options.createProvider
      ? options.createProvider(options.secret)
      : await createDefaultProvider(options.secret, options.input);

   const providerResult = await provider.issue({
      ...options.input,
      documentKind: "nfse",
      issuer: {
         ...options.input.issuer,
         cnpj: options.secret.issuerTaxId,
         municipalRegistration: options.secret.municipalRegistration,
      },
   });

   if (Result.isError(providerResult)) {
      return Result.err(
         new JacobinaSaatriError({
            error: jacobinaSaatriErrors.PROVIDER_FAILED(),
            message: providerResult.error.message,
         }),
      );
   }

   const issued = providerResult.value;
   const savedResult = await Result.tryPromise({
      try: () =>
         options.db.transaction(async (tx) => {
            const [saved] = await tx
               .insert(fiscalDocuments)
               .values({
                  organizationId: options.organizationId,
                  teamId: options.teamId,
                  providerId: issued.documentRef.providerId,
                  documentKind: "nfse",
                  environment: issued.documentRef.environment,
                  issuerTaxId: issued.documentRef.issuerTaxId,
                  series: issued.documentRef.series,
                  number: issued.documentRef.number,
                  status: issued.providerResponse.status,
                  providerDocumentId:
                     issued.providerResponse.providerDocumentId,
                  protocol: issued.providerResponse.protocol,
                  verificationUrl: issued.providerResponse.verificationUrl,
                  rejections: issued.providerResponse.rejections,
                  artifacts: issued.providerResponse.artifacts.map(
                     (artifact) => ({
                        kind: artifact.kind,
                        mediaType: artifact.mediaType,
                        base64: bytesToBase64(artifact.bytes),
                     }),
                  ),
               })
               .returning();
            return saved;
         }),
      catch: () =>
         new JacobinaSaatriError({
            error: jacobinaSaatriErrors.PERSIST_FAILED(),
            message: "Falha ao persistir retorno do SAATRI Jacobina.",
         }),
   });
   if (Result.isError(savedResult)) return Result.err(savedResult.error);
   if (!savedResult.value) {
      return Result.err(
         new JacobinaSaatriError({
            error: jacobinaSaatriErrors.PERSIST_FAILED(),
            message: "Documento fiscal não foi persistido.",
         }),
      );
   }

   return Result.ok({
      document: savedResult.value,
      providerResponse: issued.providerResponse,
   });
}
