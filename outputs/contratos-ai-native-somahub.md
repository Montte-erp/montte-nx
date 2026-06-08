# Contratos AI-native no Montte

Data: 2026-06-01

## Resumo executivo

A feature de contratos deve nascer como um sistema AI-native de ingestao, leitura, extracao, revisao e operacao de contratos. O objetivo nao e apenas armazenar PDFs ou criar um CRUD de contratos. O objetivo e transformar contratos reais em entidades operacionais do Montte, conectadas a clientes, financeiro, alertas, compliance operacional e ao Montte AI.

Os contratos analisados vieram de PDFs reais do Soma Hub:

- `/home/yorizel/Downloads/CONTRATO - BRENDA LIMA.pdf`
- `/home/yorizel/Downloads/CONTRATO - BRUNO PEREIRA.pdf`
- `/home/yorizel/Downloads/CONTRATO - CLAUDENILSON ESPIRITO.pdf`
- `/home/yorizel/Downloads/CONTRATO - DM CONSULTORIA SOCIO AMBIENTAL.pdf`
- `/home/yorizel/Downloads/CONTRATO - JEFERSON MENDES.pdf`

Observacao importante: esses PDFs sao majoritariamente escaneados. `pdftotext` retornou paginas vazias, o que significa que uma pipeline baseada apenas em texto extraivel de PDF nao resolve o caso real. A feature precisa suportar documentos visualmente renderizados, OCR e/ou modelo multimodal capaz de ler a imagem das paginas.

A tese curta:

> Contratos no Montte devem ser documentos vivos: a IA ingere o PDF, extrai campos, aponta riscos, cria uma versao revisavel, conecta com cliente e financeiro, acompanha vencimentos e responde perguntas operacionais.

---

## O que foi confirmado nos contratos reais

### Caracteristicas tecnicas dos arquivos

| Arquivo | Paginas | Texto extraivel | Observacoes |
|---|---:|---|---|
| `CONTRATO - BRENDA LIMA.pdf` | 5 | Nao | Contrato escaneado de locacao de espaco compartilhado. |
| `CONTRATO - BRUNO PEREIRA.pdf` | 6 | Nao | Contrato escaneado de endereco fiscal. |
| `CONTRATO - CLAUDENILSON ESPIRITO.pdf` | 7 | Nao | Contrato escaneado/digitalizado de endereco fiscal, com evidencia de assinatura digital ZapSign em pagina. |
| `CONTRATO - DM CONSULTORIA SOCIO AMBIENTAL.pdf` | 7 | Nao | Contrato escaneado de locacao de sala privativa, Sala Sempre Viva. |
| `CONTRATO - JEFERSON MENDES.pdf` | 4 | Nao | Contrato escaneado de prestacao de servicos de mentoria juridica. |

### Familias de contrato identificadas

#### 1. Locacao de sala em coworking

Exemplos analisados:

- espaco compartilhado;
- Sala Sempre Viva.

Campos e regras recorrentes:

- contratante pessoa fisica ou juridica;
- contratada `CS HUB JACOBINA LTDA (SOMA HUB)`;
- objeto: locacao onerosa de sala/espaco no Soma Hub;
- identificacao do espaco contratado;
- infraestrutura inclusa;
- prazo de vigencia;
- mensalidade;
- taxa operacional;
- vencimento mensal;
- multa e juros por atraso;
- bloqueio de acesso apos atraso;
- horario de funcionamento;
- controle de acesso;
- servicos inclusos;
- areas permitidas e proibidas;
- uso indevido de areas;
- cobranca adicional por reincidencia;
- limpeza, manutencao e conservacao;
- bens e equipamentos do contratante;
- restricoes de endereco fiscal;
- regras de convivencia;
- assinatura manual em algumas paginas.

Pontos operacionais importantes:

- O contrato cria uma relacao recorrente de receita.
- O contrato pode gerar ou justificar cobrancas mensais.
- O atraso pode disparar medidas operacionais como bloqueio de acesso.
- O contrato define quais areas podem ser usadas e quais geram cobranca adicional.
- O contrato pode ter anexos de vistoria/entrega e devolucao de chaves.

#### 2. Prestacao de servico de endereco fiscal

Exemplos analisados:

- contrato de endereco fiscal para pessoa fisica;
- contrato de endereco fiscal com assinatura digital.

Campos e regras recorrentes:

- contratada `CS HUB JACOBINA LTDA`;
- contratante pessoa fisica, com dados pessoais e contato;
- objeto: disponibilizacao de endereco fiscal no coworking do Soma Hub;
- endereco disponibilizado;
- uso para indicacao cadastral junto a Receita Federal, orgaos publicos e instituicoes financeiras;
- recebimento e gestao de correspondencias;
- exclusao explicita de uso de espaco fisico;
- proibicao de uso para atividades ilicitas ou armazenamento de mercadorias/produtos especificos;
- obrigacao da contratada de registrar correspondencias;
- obrigacao de notificar o contratante em ate 24 horas uteis;
- obrigacao do contratante de retirar correspondencias em ate 10 dias uteis;
- taxa de guarda por dia apos prazo;
- prazo de vigencia de 12 meses;
- renovacao automatica por igual periodo salvo aviso previo;
- rescisao com aviso previo;
- valor anual e parcelas;
- entrada e parcelas mensais;
- vencimento mensal;
- multa, juros e correcao;
- obrigacao de alterar cadastro do CNPJ apos rescisao;
- multa diaria por persistir usando endereco apos encerramento.

Pontos operacionais importantes:

- Este contrato nao da direito automatico ao uso de espaco fisico.
- Existe risco operacional se o cliente continua usando o endereco fiscal depois de rescindido.
- A feature deve rastrear obrigacoes pos-rescisao, nao apenas inicio/fim do contrato.
- Correspondencias viram eventos operacionais associados ao contrato.
- O contrato e forte candidato a gerar lembretes e tarefas para recepcao/administrativo.

#### 3. Prestacao de servicos de mentoria juridica

Exemplo analisado:

- mentoria juridica individualizada com imersao pratica, programa Acelera Juris.

Campos e regras recorrentes:

- contratante pessoa fisica;
- contratada `CS HUB JACOBINA LTDA`;
- objeto: prestacao de servicos de mentoria juridica individualizada;
- programa com duracao de ate 3 meses;
- carga horaria total de 52 horas;
- distribuicao de carga horaria por mentoria individual, pratica supervisionada e vivencia forense;
- possibilidade de atividades presenciais ou online;
- assinaturas manuais.

Pontos operacionais importantes:

- Este tipo de contrato nao e locacao nem endereco fiscal.
- O contrato se aproxima de servico/produto educacional.
- A feature deve suportar contratos que nao geram recorrencia mensal tradicional.
- O acompanhamento operacional pode envolver carga horaria, entregas, cronograma e conclusao.

---

## Por que AI-native muda a feature

Um CRUD tradicional perguntaria:

- Qual e o cliente?
- Qual e o valor?
- Qual e a data de vencimento?
- Anexe o PDF.

Uma feature AI-native deve perguntar:

- O que este contrato e?
- Quais obrigacoes ele cria?
- Quais campos juridicos e operacionais importam?
- O que esta faltando ou inconsistente?
- O que deve virar tarefa, alerta, cobranca ou regra operacional?
- O que o Montte AI precisa saber para responder perguntas futuras?

O documento passa a ser a fonte inicial, e a IA atua como camada de interpretacao. O usuario revisa, aprova e operacionaliza.

---

## Principio do produto

Contratos devem ter tres estados de informacao:

1. **Documento original**
   - PDF ou imagem como recebido.
   - Deve ser preservado sem alteracao.
   - Serve como evidencia.

2. **Extracao da IA**
   - Dados estruturados lidos do documento.
   - Inclui confianca por campo.
   - Inclui trechos/paginas de origem quando possivel.
   - Pode conter incertezas.

3. **Contrato operacional aprovado**
   - Registro validado pelo usuario.
   - Usado para financeiro, alertas, status e respostas do agente.
   - Nao deve depender de inferencia nova a cada consulta.

Essa separacao evita dois erros:

- tratar a IA como fonte juridica final sem revisao;
- perder o contexto rico do documento depois de preencher meia duzia de campos.

---

## Experiencia ideal do usuario

### Fluxo 1: Ingerir contrato existente

1. Usuario abre `Contratos`.
2. Clica em `Importar contrato`.
3. Arrasta um PDF escaneado.
4. Montte salva o arquivo original.
5. Montte mostra status: `Analisando documento`.
6. A IA classifica o contrato.
7. A IA extrai campos principais.
8. A IA aponta pendencias, riscos e acoes sugeridas.
9. Usuario revisa os campos lado a lado com o PDF.
10. Usuario aprova.
11. Contrato vira ativo, rascunho ou pendente conforme datas e assinatura.

### Fluxo 2: Revisar extracao da IA

Tela recomendada:

- esquerda: visualizador do PDF;
- direita: painel de campos extraidos;
- topo: tipo identificado, status de confianca e acoes;
- abaixo: achados da IA separados por severidade.

Campos com baixa confianca devem ficar marcados, por exemplo:

- data de inicio nao encontrada;
- valor mensal ambiguidade entre mensalidade e taxa;
- assinatura detectada, mas sem data clara;
- CPF/CNPJ parcialmente ilegivel;
- contrato menciona anexo, mas anexo nao foi encontrado no PDF.

### Fluxo 3: Operar contrato aprovado

Na lista de contratos:

- contratante;
- tipo;
- status;
- vigencia;
- valor;
- proximo vencimento;
- alertas;
- assinatura;
- origem: importado, gerado, assinado externamente.

No detalhe:

- resumo AI-native;
- dados contratuais;
- obrigacoes;
- cobrancas vinculadas;
- tarefas/alertas;
- arquivos;
- historico de analises;
- perguntas sugeridas para o Montte AI.

### Fluxo 4: Perguntar ao Montte AI

Exemplos de perguntas que a feature deve suportar:

- Quais contratos vencem nos proximos 30 dias?
- Quais clientes usam endereco fiscal?
- Quem tem contrato ativo sem PDF assinado?
- Quais contratos permitem bloqueio por atraso?
- Quais contratos tem renovacao automatica?
- Qual contrato da DM Consultoria e quais regras de capacidade da sala?
- Existe algum contrato vencido ainda marcado como ativo?
- Quais contratos tem cobrancas recorrentes que nao foram criadas?
- Quais clientes precisam alterar endereco fiscal apos rescisao?
- Liste contratos com risco operacional alto.

---

## Modelo de dominio proposto

### Entidades principais

#### `contract_documents`

Representa o arquivo original.

Campos sugeridos:

| Campo | Tipo conceitual | Observacao |
|---|---|---|
| `id` | uuid | Identificador do documento. |
| `teamId` | uuid | Ownership do time. |
| `organizationId` | uuid | Ownership da organizacao, se padrao atual exigir. |
| `fileKey` | string | Caminho no storage. |
| `originalFileName` | string | Nome original do upload. |
| `mimeType` | string | Normalmente `application/pdf`. |
| `fileSize` | number | Tamanho em bytes. |
| `pageCount` | number nullable | Preenchido apos analise. |
| `textLayerStatus` | enum | `unknown`, `present`, `empty`, `failed`. |
| `renderStatus` | enum | `pending`, `running`, `completed`, `failed`. |
| `ocrStatus` | enum | `pending`, `running`, `completed`, `failed`, `skipped`. |
| `ingestionStatus` | enum | `uploaded`, `queued`, `processing`, `needs_review`, `approved`, `failed`. |
| `uploadedByUserId` | string | Auditoria. |
| `createdAt` | timestamp | Criacao. |
| `updatedAt` | timestamp | Atualizacao. |

Por que separar:

- um contrato pode ter mais de um documento;
- o documento original precisa ser preservado;
- a IA pode reprocessar o mesmo documento com um modelo novo;
- o documento pode existir antes de virar contrato aprovado.

#### `contract_pages`

Representa paginas renderizadas e texto/OCR por pagina.

Campos sugeridos:

| Campo | Tipo conceitual | Observacao |
|---|---|---|
| `id` | uuid | Identificador. |
| `documentId` | uuid | Documento pai. |
| `pageNumber` | number | 1-based. |
| `imageFileKey` | string nullable | PNG/JPEG renderizado. |
| `extractedText` | text nullable | Texto via text layer ou OCR. |
| `ocrConfidence` | number nullable | Se OCR local ou provider retornar. |
| `visualHash` | string nullable | Ajuda a detectar reprocessamento. |
| `createdAt` | timestamp | Criacao. |

Para os PDFs analisados, o campo `extractedText` vindo de text layer seria vazio. A pipeline precisa popular via OCR/visao.

#### `contract_extractions`

Representa uma leitura da IA sobre um documento.

Campos sugeridos:

| Campo | Tipo conceitual | Observacao |
|---|---|---|
| `id` | uuid | Identificador. |
| `documentId` | uuid | Documento analisado. |
| `modelProvider` | string | Ex: OpenRouter. |
| `modelName` | string | Modelo usado. |
| `promptVersion` | string | Versao do prompt/schema. |
| `status` | enum | `pending`, `running`, `completed`, `failed`. |
| `detectedContractType` | enum nullable | Tipo classificado. |
| `confidence` | number nullable | Confianca geral. |
| `extractedData` | jsonb | Payload estruturado. |
| `fieldConfidences` | jsonb | Confianca por campo. |
| `evidence` | jsonb | Paginas/trechos de suporte. |
| `warnings` | jsonb | Avisos de extracao. |
| `createdAt` | timestamp | Criacao. |

Essa tabela deve ser append-only por natureza. Uma nova analise nao sobrescreve a anterior sem historico.

#### `contracts`

Representa o contrato operacional aprovado.

Campos sugeridos:

| Campo | Tipo conceitual | Observacao |
|---|---|---|
| `id` | uuid | Identificador. |
| `teamId` | uuid | Ownership. |
| `relationshipId` | uuid nullable | Cliente/fornecedor em `relationships`, quando aprovado. |
| `documentId` | uuid nullable | Documento principal. |
| `approvedExtractionId` | uuid nullable | Extracao usada como base. |
| `type` | enum | Tipo operacional. |
| `title` | string | Nome amigavel. |
| `counterpartyName` | string | Contratante. |
| `counterpartyKind` | enum | `person`, `company`, `unknown`. |
| `counterpartyDocumentNumber` | string nullable | CPF/CNPJ normalizado, com cuidado de privacidade. |
| `status` | enum | Ver abaixo. |
| `signatureStatus` | enum | `unknown`, `unsigned`, `partially_signed`, `signed`, `digitally_signed`. |
| `startsAt` | date nullable | Inicio da vigencia. |
| `endsAt` | date nullable | Fim da vigencia. |
| `signedAt` | timestamp nullable | Data de assinatura. |
| `renewalPolicy` | enum | `none`, `manual`, `automatic`, `unknown`. |
| `noticePeriodDays` | number nullable | Aviso previo. |
| `billingPeriod` | enum | `none`, `monthly`, `annual`, `installments`, `custom`. |
| `amountCents` | number nullable | Valor principal. |
| `monthlyAmountCents` | number nullable | Quando aplicavel. |
| `entryAmountCents` | number nullable | Entrada. |
| `installmentAmountCents` | number nullable | Parcela. |
| `installmentCount` | number nullable | Numero de parcelas. |
| `dueDay` | number nullable | Dia de vencimento. |
| `lateFeePercent` | number nullable | Multa. |
| `lateInterestPercentMonthly` | number nullable | Juros ao mes. |
| `indexation` | string nullable | IPCA/IBGE, IPCA etc. |
| `approvedByUserId` | string nullable | Auditoria. |
| `approvedAt` | timestamp nullable | Auditoria. |
| `createdAt` | timestamp | Criacao. |
| `updatedAt` | timestamp | Atualizacao. |

Status sugeridos:

- `draft`: criado manualmente ou por extracao, ainda incompleto;
- `needs_review`: IA extraiu, precisa revisao humana;
- `active`: contrato vigente e aprovado;
- `expiring_soon`: derivado ou materializado para contratos perto do fim;
- `expired`: fim de vigencia passou;
- `terminated`: rescindido antes do fim;
- `cancelled`: cancelado sem virar ativo;
- `archived`: ocultado, preservando historico.

Observacao: `expiring_soon` pode ser status derivado em query, nao necessariamente valor persistido.

#### `contract_obligations`

Representa obrigacoes extraidas ou cadastradas.

Campos sugeridos:

| Campo | Tipo conceitual | Observacao |
|---|---|---|
| `id` | uuid | Identificador. |
| `contractId` | uuid | Contrato. |
| `party` | enum | `contractor`, `counterparty`, `both`. |
| `category` | enum | `payment`, `access`, `correspondence`, `space_usage`, `fiscal_address`, `termination`, `maintenance`, `other`. |
| `title` | string | Resumo. |
| `description` | text | Texto operacional. |
| `trigger` | enum nullable | `on_late_payment`, `on_termination`, `on_mail_received`, `on_contract_end`, etc. |
| `dueOffsetDays` | number nullable | Ex: retirar correspondencia em ate 10 dias. |
| `sourcePage` | number nullable | Evidencia. |
| `confidence` | number nullable | Confianca IA. |
| `status` | enum | `active`, `completed`, `dismissed`. |

Exemplos reais que devem virar obrigacoes:

- notificar correspondencia em ate 24 horas uteis;
- retirar correspondencia em ate 10 dias uteis;
- alterar cadastro do CNPJ apos rescisao;
- bloquear acesso apos atraso superior ao limite contratual;
- pagar taxa de guarda por correspondencia nao retirada;
- nao usar endereco fiscal quando o contrato de coworking nao inclui esse servico;
- nao exceder capacidade da sala;
- devolver chaves mediante vistoria final.

#### `contract_analysis_findings`

Representa achados da IA.

Campos sugeridos:

| Campo | Tipo conceitual | Observacao |
|---|---|---|
| `id` | uuid | Identificador. |
| `contractId` | uuid nullable | Pode existir antes de aprovar contrato. |
| `documentId` | uuid | Documento base. |
| `extractionId` | uuid nullable | Extracao base. |
| `severity` | enum | `info`, `warning`, `risk`, `critical`. |
| `category` | enum | `missing_data`, `financial`, `signature`, `renewal`, `termination`, `operational`, `compliance`, `inconsistency`. |
| `title` | string | Titulo curto. |
| `description` | text | Explicacao. |
| `suggestedAction` | text nullable | Acao recomendada. |
| `sourcePage` | number nullable | Evidencia. |
| `status` | enum | `open`, `accepted`, `dismissed`, `resolved`. |

Exemplos de achados:

- contrato sem assinatura detectavel;
- data de fim ausente;
- renovacao automatica exige alerta de aviso previo;
- valor anual nao bate com soma de entrada e parcelas;
- contrato de endereco fiscal tem obrigacao pos-rescisao;
- sala tem limite de pessoas e custo adicional;
- contrato menciona termo de vistoria/anexo, mas anexo nao foi encontrado;
- contrato vencido continua com status ativo;
- cobrancas recorrentes nao foram criadas.

#### `contract_financial_links`

Representa ligacao com financeiro.

Campos sugeridos:

| Campo | Tipo conceitual | Observacao |
|---|---|---|
| `id` | uuid | Identificador. |
| `contractId` | uuid | Contrato. |
| `transactionId` | uuid nullable | Lancamento gerado ou vinculado. |
| `recurrenceId` | uuid nullable | Se existir recorrencia no financeiro. |
| `linkType` | enum | `generated`, `manual`, `matched_by_ai`. |
| `amountCents` | number nullable | Valor esperado. |
| `dueDate` | date nullable | Vencimento esperado. |
| `status` | enum | `expected`, `created`, `paid`, `overdue`, `cancelled`. |

Essa tabela pode ser adiada no MVP, mas o dominio deve nascer preparado para ela.

---

## Schema de extracao AI-native

O output da IA deve ser rigidamente estruturado com Zod. Um formato conceitual:

```ts
const contractExtractionSchema = z.object({
  document: z.object({
    title: z.string().nullable(),
    contractType: z.enum([
      "coworking_shared_space",
      "coworking_private_room",
      "fiscal_address",
      "legal_mentoring",
      "service",
      "other",
      "unknown",
    ]),
    language: z.literal("pt-BR"),
    pageCount: z.number().int().positive().nullable(),
  }),
  parties: z.object({
    contractor: z.object({
      name: z.string().nullable(),
      documentNumber: z.string().nullable(),
      address: z.string().nullable(),
      email: z.string().nullable(),
      phone: z.string().nullable(),
    }),
    counterparty: z.object({
      name: z.string().nullable(),
      kind: z.enum(["person", "company", "unknown"]),
      documentNumber: z.string().nullable(),
      address: z.string().nullable(),
      email: z.string().nullable(),
      phone: z.string().nullable(),
      representativeName: z.string().nullable(),
      representativeDocumentNumber: z.string().nullable(),
    }),
  }),
  terms: z.object({
    objectSummary: z.string().nullable(),
    startsAt: z.string().nullable(),
    endsAt: z.string().nullable(),
    durationMonths: z.number().int().nullable(),
    signedAt: z.string().nullable(),
    renewal: z.object({
      policy: z.enum(["none", "manual", "automatic", "unknown"]),
      noticePeriodDays: z.number().int().nullable(),
      notes: z.string().nullable(),
    }),
    termination: z.object({
      noticePeriodDays: z.number().int().nullable(),
      postTerminationObligations: z.array(z.string()),
    }),
  }),
  financial: z.object({
    billingPeriod: z.enum(["none", "monthly", "annual", "installments", "custom", "unknown"]),
    amountCents: z.number().int().nullable(),
    monthlyAmountCents: z.number().int().nullable(),
    entryAmountCents: z.number().int().nullable(),
    installmentAmountCents: z.number().int().nullable(),
    installmentCount: z.number().int().nullable(),
    dueDay: z.number().int().min(1).max(31).nullable(),
    lateFeePercent: z.number().nullable(),
    lateInterestPercentMonthly: z.number().nullable(),
    indexation: z.string().nullable(),
    paymentMethods: z.array(z.string()),
  }),
  operationalRules: z.array(z.object({
    category: z.string(),
    title: z.string(),
    description: z.string(),
    trigger: z.string().nullable(),
    page: z.number().int().nullable(),
  })),
  signature: z.object({
    status: z.enum(["unknown", "not_found", "manual_signature", "digital_signature", "partial"]),
    provider: z.string().nullable(),
    signedAt: z.string().nullable(),
    evidence: z.array(z.object({
      page: z.number().int().nullable(),
      description: z.string(),
    })),
  }),
  findings: z.array(z.object({
    severity: z.enum(["info", "warning", "risk", "critical"]),
    category: z.string(),
    title: z.string(),
    description: z.string(),
    suggestedAction: z.string().nullable(),
    evidencePage: z.number().int().nullable(),
  })),
  confidence: z.object({
    overall: z.number().min(0).max(1),
    fields: z.record(z.string(), z.number().min(0).max(1)),
  }),
});
```

Ponto importante: a IA deve retornar `null` quando nao tiver certeza. Nao deve inventar data, valor ou documento.

---

## Pipeline de ingestao

### Etapa 1: Upload

Entrada:

- PDF;
- imagens;
- possivelmente DOCX no futuro.

Validacoes:

- tipo permitido;
- tamanho maximo;
- ownership do time;
- antivirus se o produto exigir;
- persistencia no storage.

Saida:

- registro em `contract_documents`;
- job enfileirado para processamento.

### Etapa 2: Inspecao do PDF

Processamento:

- identificar numero de paginas;
- tentar extrair camada de texto;
- detectar se texto esta vazio;
- renderizar paginas para imagem se necessario.

Resultado esperado para os PDFs reais analisados:

- `textLayerStatus = empty`;
- `renderStatus = completed`;
- `ocrStatus = pending` ou `completed`.

### Etapa 3: OCR ou leitura visual

Opcoes:

1. OCR local/servico especializado:
   - gera texto por pagina;
   - mais barato para alto volume;
   - pode perder layout e assinaturas.

2. Modelo multimodal:
   - le paginas como imagem;
   - melhor para documentos escaneados, assinaturas, carimbos e layout;
   - pode ser mais caro.

3. Hibrido:
   - OCR primeiro;
   - modelo visual apenas nas paginas com baixa confianca, assinatura, tabelas ou campos ausentes.

Recomendacao:

- MVP: hibrido simplificado.
- Se text layer vazio, renderizar primeiras paginas e paginas finais para classificacao e assinatura.
- Para extracao completa, processar todas as paginas por OCR/visao conforme custo.

### Etapa 4: Classificacao

A IA deve identificar:

- tipo do contrato;
- familia comercial;
- se e contrato assinado ou minuta;
- se ha evidencia de assinatura;
- se existe valor e vigencia;
- quais modulos do Montte podem ser afetados.

Tipos iniciais:

- `fiscal_address`;
- `coworking_shared_space`;
- `coworking_private_room`;
- `legal_mentoring`;
- `service`;
- `other`;
- `unknown`.

### Etapa 5: Extracao estruturada

O modelo recebe:

- texto por pagina, se houver;
- imagens das paginas, se necessario;
- schema de saida;
- instrucoes para nao inferir campos ausentes;
- exemplos de tipos de contrato Soma Hub.

Saida:

- `contract_extractions.extractedData`;
- `fieldConfidences`;
- `evidence`;
- `warnings`.

### Etapa 6: Analise operacional

Gerar achados:

- riscos;
- pendencias;
- inconsistencias;
- tarefas sugeridas;
- cobrancas esperadas;
- alertas de vigencia;
- obrigacoes pos-rescisao.

### Etapa 7: Revisao humana

Usuario aprova:

- tipo;
- cliente;
- datas;
- valores;
- status;
- obrigacoes principais;
- achados relevantes.

Ao aprovar:

- cria/atualiza `contracts`;
- opcionalmente cria/vincula `relationships`;
- opcionalmente cria previsoes financeiras;
- marca documento como aprovado.

---

## Analises especificas que a IA deve fazer

### Classificacao juridico-operacional

A IA deve responder:

- E locacao, servico, endereco fiscal ou outro?
- O contrato cria direito de uso fisico do espaco?
- O contrato cria uso de endereco fiscal?
- O contrato inclui correspondencias?
- O contrato inclui acesso a sala, mesa, ilha, cadeira, ar-condicionado?
- O contrato tem limites de capacidade?
- O contrato tem carga horaria ou entregas de servico?

### Extracao financeira

A IA deve extrair:

- valor mensal;
- valor anual;
- entrada;
- parcelas;
- quantidade de parcelas;
- vencimento;
- indice de reajuste;
- multa;
- juros;
- taxa operacional;
- taxa adicional por pessoa;
- taxa de guarda de correspondencia;
- multa diaria pos-rescisao.

Tambem deve verificar:

- a soma das parcelas bate com o valor anual?
- ha valor por fora da mensalidade?
- ha cobrancas condicionais?
- ha gatilho de bloqueio ou suspensao por inadimplencia?

### Extracao de vigencia

A IA deve extrair:

- inicio;
- termino;
- duracao em meses;
- data de assinatura;
- renovacao automatica;
- aviso previo;
- regras de rescisao.

Tambem deve gerar:

- alerta antes do fim;
- alerta antes do prazo de aviso previo;
- tarefa de renovacao;
- tarefa pos-rescisao.

### Assinatura e evidencia

A IA deve detectar:

- assinatura manual;
- assinatura digital;
- provedor de assinatura;
- data de assinatura;
- se todas as partes parecem ter assinado;
- se ha rubrica em paginas intermediarias.

Nos PDFs analisados:

- alguns contratos tem rubricas/assinaturas manuais;
- um contrato apresenta evidencia visual de assinatura via ZapSign;
- ha paginas finais possivelmente em branco em alguns PDFs, entao a pipeline nao pode assumir que a ultima pagina contem assinatura.

### Regras operacionais

A IA deve transformar clausulas em regras acionaveis:

- atraso maior que N dias permite bloqueio;
- correspondencia recebida deve ser notificada em 24 horas uteis;
- correspondencia deve ser retirada em 10 dias uteis;
- uso de endereco fiscal sem contrato gera cobranca/regularizacao;
- uso de area nao contratada gera cobranca;
- exceder capacidade gera cobranca adicional ou vedacao;
- devolucao de chaves exige vistoria;
- apos rescisao de endereco fiscal, cliente deve alterar cadastro.

### Riscos e inconsistencias

Achados que devem aparecer:

- contrato sem data de inicio;
- contrato sem data de fim;
- contrato sem valor;
- contrato sem assinatura detectada;
- contrato assinado, mas com campos ilegiveis;
- contratante pessoa juridica com representante sem CPF claro;
- clausula de renovacao automatica sem alerta configurado;
- contrato de coworking veda endereco fiscal, mas cliente usa endereco fiscal no cadastro;
- contrato de endereco fiscal sem cobranca recorrente;
- contrato vencido com relacionamento ainda ativo;
- contrato com multa ou taxa adicional nao cadastrada.

---

## Integracao com dominios existentes

### `modules/relationships`

Hoje o repo tem dominio de relacionamentos/clientes/fornecedores em `modules/relationships`.

Contratos devem se vincular a `relationships` porque os PDFs trazem:

- contratante;
- CPF/CNPJ;
- e-mail;
- telefone;
- endereco;
- representante legal em pessoa juridica.

Comportamento recomendado:

- na revisao, sugerir relacionamento existente por CPF/CNPJ;
- se nao existir, sugerir criar novo relacionamento;
- nao criar relacionamento automaticamente sem aprovacao humana quando houver baixa confianca;
- normalizar CPF/CNPJ com os validadores existentes do dominio de relationships.

### `modules/cashbook`

Contratos podem gerar ou explicar transacoes.

Casos reais:

- mensalidade de coworking;
- taxa operacional;
- parcelas de endereco fiscal;
- entrada;
- taxa de guarda;
- multa/juros;
- adicional por pessoa;
- multa diaria pos-rescisao.

Comportamento recomendado:

- MVP pode apenas sugerir lancamentos;
- depois, criar recorrencias/lancamentos pendentes;
- matching futuro pode comparar pagamentos existentes com contratos.

### `modules/inbox`

Contratos devem alimentar a caixa de tarefas.

Exemplos:

- contrato vence em 30 dias;
- contrato sem assinatura;
- cliente deve retirar correspondencia;
- contrato de endereco fiscal rescindido exige alteracao cadastral;
- cliente atrasado pode ter acesso bloqueado.

### `modules/agents`

O Montte AI deve consultar contratos via tools tipadas.

Tools iniciais:

- `contracts.listContracts`;
- `contracts.getContract`;
- `contracts.searchContractClauses`;
- `contracts.listExpiringContracts`;
- `contracts.listContractFindings`;
- `contracts.analyzeUploadedContractStatus`.

As tools devem chamar routers/use cases do modulo `contracts`, seguindo o padrao atual de `modules/agents/src/tools/registry.ts`.

### `core/files`

O storage atual possui `@core/files`, com helpers de chave e S3 custom client. Contratos precisam de novos prefixes de arquivo.

Prefixos sugeridos:

- `contract-documents`;
- `contract-pages`;
- `contract-analysis-artifacts`.

Nao misturar contratos com logos/avatar.

### `modules/workflows` ou jobs operacionais

Ingestao de PDF e analise por IA sao processos assíncronos.

MVP pode usar jobs simples se ja houver padrao operacional suficiente. Se o fluxo exigir replay/durabilidade forte, usar workflow.

Etapas candidatas:

- renderizar PDF;
- OCR;
- classificar;
- extrair;
- analisar;
- gerar achados;
- notificar usuario.

---

## Montte AI como interface principal

Contratos AI-native devem ter UI propria, mas o Montte AI deve ser um caminho natural.

### Acoes conversacionais

O usuario deve conseguir dizer:

- "Analise este contrato."
- "Esse contrato esta assinado?"
- "Quais sao os riscos desse contrato?"
- "Crie um resumo operacional."
- "Quais cobrancas devo criar?"
- "Esse cliente tem direito a usar endereco fiscal?"
- "O que acontece se ele atrasar?"
- "Quando preciso avisar sobre renovacao?"

### Respostas devem ser baseadas em dados aprovados

Regra:

- Para contrato aprovado, o agente deve responder usando `contracts` e `contract_obligations`.
- Para documento ainda nao aprovado, o agente deve deixar claro que esta usando uma extracao preliminar.

Exemplo de resposta correta:

> Este contrato ainda esta em revisao. Pela extracao preliminar, ele parece ser um contrato de endereco fiscal com vigencia de 12 meses e renovacao automatica. Confirme os campos antes de criar cobrancas ou tarefas.

### Respostas nao devem dar parecer juridico

O agente pode:

- resumir clausulas;
- apontar campos ausentes;
- identificar obrigacoes operacionais;
- comparar com dados cadastrados;
- sugerir tarefas.

O agente nao deve:

- afirmar validade juridica;
- prometer interpretacao legal definitiva;
- substituir advogado;
- sugerir descumprimento contratual.

Texto padrao para analises sensiveis:

> Esta e uma leitura operacional do contrato para gestao interna. Para decisao juridica, valide com assessoria juridica.

---

## UI recomendada

### Lista de contratos

Colunas:

- status;
- contratante;
- tipo;
- vigencia;
- valor;
- assinatura;
- alertas;
- origem;
- atualizado em.

Filtros:

- status;
- tipo;
- assinatura;
- vencendo em;
- cliente;
- com achados abertos;
- com cobranca pendente;
- importado por;
- periodo de assinatura.

Acoes:

- importar contrato;
- abrir detalhe;
- revisar extracao;
- arquivar;
- exportar;
- perguntar ao Montte AI.

### Tela de revisao

Layout recomendado:

- PDF a esquerda;
- campos extraidos a direita;
- achados abaixo ou em aba;
- trilha de evidencias por pagina;
- botoes: aprovar, salvar rascunho, reprocessar, descartar.

Componentes:

- confidence badge por campo;
- marcador de pagina;
- diff entre extracoes se reprocessar;
- alerta para PII sensivel;
- painel de obrigacoes;
- painel financeiro.

### Detalhe do contrato

Abas:

- Resumo;
- Dados;
- Obrigacoes;
- Financeiro;
- Documentos;
- Analise da IA;
- Historico.

Resumo deve mostrar:

- o que foi contratado;
- quem e o contratante;
- periodo;
- valor;
- renovacao;
- status de assinatura;
- principais riscos;
- proximas acoes.

### Importacao em massa

Pode ficar para depois, mas a feature deve prever:

- upload de varios PDFs;
- fila de processamento;
- status por documento;
- agrupamento por tipo;
- revisao sequencial.

---

## Roadmap sugerido

### Fase 0: Spike tecnico

Objetivo:

- provar leitura de PDFs escaneados.

Entregas:

- renderizar PDF em imagens;
- extrair texto ou usar visao em paginas;
- classificar os cinco contratos reais;
- gerar JSON estruturado;
- registrar custo/latencia por documento;
- avaliar qualidade por campo.

Criterio de sucesso:

- identificar corretamente as tres familias de contrato;
- extrair contratante, tipo, valor e vigencia quando visiveis;
- detectar assinatura/rubrica em pelo menos parte dos casos;
- nao inventar campo ausente.

### Fase 1: Ingestao e revisao

Entregas:

- `modules/contracts`;
- upload de PDF;
- tabela de documentos;
- job de analise;
- schema de extracao;
- tela de revisao;
- aprovar contrato;
- lista basica de contratos.

Nao inclui:

- geracao automatica de PDF;
- assinatura digital integrada;
- criacao automatica de cobrancas;
- parecer juridico.

### Fase 2: Operacao

Entregas:

- obrigacoes estruturadas;
- achados da IA;
- alertas de vencimento;
- contratos sem assinatura;
- contratos vencidos;
- status operacional;
- detalhe completo.

### Fase 3: Financeiro

Entregas:

- sugestao de cobrancas;
- criacao de recorrencias/lancamentos;
- matching de pagamento;
- inadimplencia por contrato;
- regra de bloqueio/pendencia.

### Fase 4: Montte AI profundo

Entregas:

- tools de consulta;
- perguntas em linguagem natural;
- busca semantica em clausulas;
- explicacoes com evidencia;
- analise comparativa entre contratos;
- recomendacoes operacionais.

### Fase 5: Geracao e assinatura

Entregas:

- modelos de contrato;
- preenchimento por dados do cliente;
- geracao de PDF;
- envio para assinatura digital;
- tracking de assinatura;
- substituicao de minuta por versao assinada.

---

## Decisoes de produto recomendadas

### Comecar por contratos importados, nao por geracao

Motivo:

- os contratos reais ja existem;
- a maior dor inicial e entender e operar o legado;
- gerar contrato exige padronizacao juridica mais madura;
- a importacao cria base de dados para aprender os modelos reais.

### Exigir revisao humana antes de ativar

Motivo:

- documentos tem PII;
- OCR pode errar CPF, valor ou data;
- uma data errada pode gerar cobranca errada;
- um contrato pode ter paginas em branco ou ilegíveis;
- a IA deve acelerar, nao assumir responsabilidade final.

### Salvar evidencias por campo

Motivo:

- usuario precisa confiar na extracao;
- agentes futuros precisam citar de onde veio a informacao;
- auditoria fica mais simples;
- reduz alucinacao.

### Separar achado de obrigacao

Achado:

- "Contrato nao tem assinatura detectada."

Obrigacao:

- "Notificar correspondencia em ate 24 horas uteis."

Misturar os dois deixa a operacao confusa.

### Nao armazenar apenas embeddings

Embeddings ajudam busca, mas nao substituem dados estruturados.

Contratos precisam de:

- datas;
- valores;
- status;
- relacoes;
- obrigacoes;
- evidencias;
- historico.

Embeddings entram como camada complementar para busca em clausulas.

---

## Prompt inicial de extracao

Prompt conceitual para a pipeline:

```txt
Voce e um agente de extracao operacional de contratos do Montte.

Leia o contrato em pt-BR e extraia somente informacoes presentes no documento.
Nao invente dados ausentes.
Se um campo estiver ilegivel, use null e adicione um warning.
Se houver conflito entre paginas, registre o conflito em findings.

Objetivo:
- classificar o tipo de contrato;
- extrair partes, datas, valores, assinatura e obrigacoes;
- gerar achados operacionais;
- preservar evidencias por pagina.

Nao de parecer juridico.
Nao conclua validade legal.
Use linguagem operacional.

Retorne apenas JSON valido no schema fornecido.
```

---

## Exemplos de saida esperada por tipo

### Endereco fiscal

Resumo esperado:

```json
{
  "contractType": "fiscal_address",
  "objectSummary": "Disponibilizacao de endereco fiscal no coworking do Soma Hub para indicacao cadastral e recebimento/gestao de correspondencias.",
  "billingPeriod": "installments",
  "renewalPolicy": "automatic",
  "operationalHighlights": [
    "Nao inclui cessao de espaco fisico.",
    "Correspondencias devem ser retiradas dentro do prazo contratual.",
    "Apos rescisao, o contratante deve alterar o cadastro do CNPJ.",
    "Persistencia do uso do endereco apos rescisao pode gerar multa diaria."
  ]
}
```

### Sala privativa

Resumo esperado:

```json
{
  "contractType": "coworking_private_room",
  "objectSummary": "Locacao onerosa de uso privativo de sala no Soma Hub Coworking.",
  "billingPeriod": "monthly",
  "operationalHighlights": [
    "Uso regular limitado a quantidade de pessoas contratada.",
    "Pessoas adicionais podem gerar cobranca adicional.",
    "Uso de areas nao contratadas pode gerar cobranca e multa.",
    "Entrega e devolucao de chaves dependem de vistoria."
  ]
}
```

### Espaco compartilhado

Resumo esperado:

```json
{
  "contractType": "coworking_shared_space",
  "objectSummary": "Locacao onerosa de uso de espaco compartilhado no Soma Hub Coworking.",
  "billingPeriod": "monthly",
  "operationalHighlights": [
    "Inclui uso do espaco compartilhado no horario de funcionamento.",
    "Acesso pode ser bloqueado apos atraso contratual.",
    "Uso de endereco fiscal e servicos de domicilio nao estao incluidos salvo contratacao adicional.",
    "Uso indevido de areas pode gerar cobranca."
  ]
}
```

### Mentoria juridica

Resumo esperado:

```json
{
  "contractType": "legal_mentoring",
  "objectSummary": "Prestacao de servicos de mentoria juridica individualizada com imersao pratica no programa Acelera Juris.",
  "billingPeriod": "custom",
  "operationalHighlights": [
    "Programa com duracao limitada.",
    "Carga horaria total definida no contrato.",
    "Atividades podem ocorrer presencialmente ou online conforme cronograma."
  ]
}
```

---

## Privacidade e seguranca

Contratos contem PII e informacoes sensiveis:

- CPF;
- CNPJ;
- e-mail;
- telefone;
- endereco;
- assinaturas;
- dados financeiros;
- clausulas comerciais.

Regras:

- nao enviar conteudo para analytics de produto;
- em AI telemetry, manter `captureContent=false`;
- logar apenas ids operacionais;
- redigir PII em previews quando possivel;
- controlar acesso por `teamId`;
- registrar quem acessou, importou, aprovou e baixou;
- evitar copiar texto integral do contrato para notificacoes.

Para o Montte AI:

- tools devem respeitar ownership;
- resposta deve conter dados sensiveis apenas quando o usuario tem acesso ao contrato;
- busca semantica nao deve vazar contratos de outro time.

---

## Validacao de qualidade da IA

Criar um conjunto de avaliacao com os cinco PDFs reais.

Campos obrigatorios por avaliacao:

- tipo do contrato;
- contratante;
- contratada;
- vigencia;
- valor principal;
- vencimento;
- assinatura;
- obrigacoes principais;
- achados.

Metricas:

- acuracia de classificacao;
- percentual de campos obrigatorios extraidos corretamente;
- taxa de campos inventados;
- taxa de falsos positivos de assinatura;
- latencia por pagina;
- custo por documento;
- percentual de campos com evidencia.

Regra de qualidade:

- campo errado com alta confianca e pior que campo nulo com baixa confianca.

---

## Lacunas atuais

### Linear

A consulta ao Linear ficou bloqueada por autenticacao:

```txt
401: Reauthentication required
```

Portanto, este documento ainda nao incorpora tickets reais da feature de contratos. Assim que o conector Linear for reautenticado, o proximo passo e cruzar:

- escopo esperado nos tickets;
- achados dos contratos reais;
- arquitetura AI-native proposta;
- fatias de implementacao.

### Implementacao existente

Nao foi identificado modulo `contracts` no repo atual.

Pontos existentes relevantes:

- `modules/relationships`: base para clientes/contratantes.
- `modules/cashbook`: base para lancamentos/cobrancas financeiras.
- `modules/agents`: plataforma agentica e tools.
- `core/ai`: adapters de IA via TanStack AI/OpenRouter.
- `core/files`: cliente S3 e chaves de arquivos.
- `modules/workflows`: infraestrutura de workflows.

### OCR/multimodal

Foi identificado `core/ai/src/models.ts` com adapters de texto. Nao foi confirmado, no contexto coletado, um caminho pronto para leitura multimodal/PDF em producao.

Como os PDFs reais nao possuem texto extraivel, essa e a principal dependencia tecnica da feature.

---

## Sequencia recomendada de implementacao

1. Criar spike local de leitura dos cinco PDFs reais.
2. Definir schema Zod de extracao.
3. Criar `modules/contracts` com tabelas base.
4. Criar upload e registro de documento.
5. Criar job de ingestao com status.
6. Criar extracao IA append-only.
7. Criar tela de revisao.
8. Criar aprovacao de contrato.
9. Criar lista e detalhe.
10. Criar achados e obrigacoes.
11. Criar tools para Montte AI.
12. Integrar com financeiro.
13. Integrar alertas/inbox.
14. Evoluir para geracao e assinatura.

---

## MVP recomendado

Escopo minimo que ja entrega valor:

- importar PDF;
- analisar com IA;
- extrair tipo, contratante, datas, valores, assinatura e regras principais;
- revisar campos;
- aprovar contrato;
- listar contratos;
- ver resumo e achados;
- perguntar ao Montte AI sobre contratos aprovados.

Fora do MVP:

- geracao automatica de contrato;
- assinatura digital integrada;
- parecer juridico;
- OCR perfeito;
- criacao automatica de todas as cobrancas;
- importacao em massa;
- busca semantica avancada em todas as clausulas.

---

## Frase de produto

Possivel posicionamento interno:

> Contratos no Montte leem o PDF por voce, extraem os campos importantes, apontam riscos e transformam clausulas em operacao.

Versao mais direta:

> Importe um contrato. O Montte entende, estrutura, alerta e opera.

---

## Conclusao

A feature de contratos deve ser um dos dominios mais AI-native do Montte porque o dado nasce em documento nao estruturado. Os contratos reais do Soma Hub mostram que o caso nao e trivial: ha PDFs escaneados, assinaturas manuais, assinatura digital, tipos contratuais diferentes, regras financeiras, obrigacoes pos-rescisao e efeitos operacionais.

O melhor caminho e tratar contrato como pipeline:

```txt
PDF original -> paginas -> OCR/visao -> extracao estruturada -> achados -> revisao humana -> contrato operacional -> tools do Montte AI
```

Assim, a IA nao fica como uma camada decorativa em cima de um CRUD. Ela vira a forma primaria de transformar documentos reais em operacao confiavel.
