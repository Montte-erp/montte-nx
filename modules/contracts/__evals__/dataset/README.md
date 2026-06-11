---
license: cc-by-4.0
language:
   - pt
task_categories:
   - document-question-answering
   - text-classification
   - token-classification
task_ids:
   - information-extraction
pretty_name: Montte Synthetic Brazilian Contract Extraction Stress Dataset
tags:
   - contracts
   - structured-extraction
   - llm-evaluation
   - document-ai
   - erp
   - saas
   - pt-br
size_categories:
   - n<1K
---

# Montte Synthetic Brazilian Contract Extraction Stress Dataset

Dataset sintético para avaliar extração estruturada de contratos operacionais em pt-BR, com foco em ERP, SaaS, comércio, logística, saúde, indústria, restaurantes, escolas, contabilidade e construção.

## O que tem aqui

- 50 contratos sintéticos em PDF no repositório de fixtures, com nomes descritivos por domínio/partes.
- 50 linhas JSONL em `contract-extraction-stress.pt-BR.jsonl`.
- Ground truth estruturado para título/tipo, partes, valores BRL em centavos, datas/prazos, obrigações, sinais operacionais, riscos, evidências e anti-alucinação.
- Nenhum contrato real, pessoa real, CPF/CNPJ real, dado bancário real ou cláusula confidencial.

## Uso pretendido

Este dataset foi desenhado para regression/stress eval de sistemas LLM/VLM que recebem documentos contratuais e retornam JSON estruturado. Ele é especialmente útil para testar:

1. normalização monetária em BRL;
2. separação de partes e papéis contratuais;
3. extração de prazos relativos e datas absolutas;
4. obrigações operacionais com evidência grounded;
5. identificação de riscos sem inventar termos ausentes.

## Estrutura

Cada linha do JSONL contém:

```json
{
   "id": "stress-001-saas-crm",
   "split": "test",
   "locale": "pt-BR",
   "task": "contract_structured_extraction",
   "document": {
      "files": ["contrato-saas-crm-nuvem-clara-agencia-horizonte-001.pdf"],
      "mimeTypes": ["application/pdf"],
      "text": "...",
      "synthetic": true,
      "containsRealContract": false,
      "containsPersonalData": false,
      "domain": "saas crm",
      "difficulty": "hard",
      "extractionChallenges": ["..."]
   },
   "expected": {
      "titleIncludes": ["saas"],
      "typeIncludes": ["contrato"],
      "parties": [{ "roleIncludes": "contratada", "nameIncludes": "Nuvem" }],
      "monetaryTerms": [
         { "labelIncludes": "implantacao", "amountCents": 123456 }
      ],
      "dates": [{ "labelIncludes": "vencimento", "valueIncludes": "11 dias" }],
      "obligations": [
         {
            "partyIncludes": "cliente",
            "titleIncludes": ["validar", "cadastros"]
         }
      ],
      "operationalFlags": [{ "labelIncludes": ["sla"] }],
      "signatures": [],
      "findings": [
         {
            "categoryIncludes": ["risco"],
            "titleOrDescriptionIncludes": ["DPA"],
            "severity": "risk"
         }
      ],
      "forbidden": ["Contrato real", "CPF 123", "Banco Real SA"]
   },
   "evaluation": {
      "scorerNames": [
         "document title/type",
         "money exact cents",
         "evidence grounded"
      ],
      "mustGroundEvidenceInDocument": true,
      "forbiddenClaims": ["..."]
   },
   "provenance": {
      "generationMethod": "programmatic synthetic contract templates with deterministic gold annotations",
      "sourceDataPolicy": "No real contracts..."
   }
}
```

## Splits

Apenas `test`. O objetivo é avaliação fixa, não treinamento.

## Métricas recomendadas

Use uma combinação de verificações determinísticas:

- match parcial normalizado para título, tipo, partes e labels;
- match exato para `amountCents`;
- match parcial para datas e prazos;
- cobertura de obrigações e flags operacionais;
- verificação de que evidências citadas aparecem no texto fonte;
- penalidade para valores ou termos proibidos não presentes no documento.

## Limitações

- Documentos são sintéticos e curtos; não substituem avaliação com documentos reais autorizados.
- Não mede OCR ruim, tabelas complexas, anexos longos ou assinaturas digitais reais.
- O foco é extração operacional para ERP/SaaS, não interpretação jurídica definitiva.

## Licença sugerida

CC BY 4.0 para o dataset. Código do repositório mantém a licença do projeto.
