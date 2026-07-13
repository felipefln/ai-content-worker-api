# AI Content Generator API

API para geração de conteúdo assistida por IA em larga escala. Como chamadas a LLMs são demoradas e sujeitas a falha, a geração roda em background: a requisição HTTP retorna imediatamente com o conteúdo em status `PENDING`, e um worker separado processa a fila, simula a chamada à IA (com retry automático em caso de falha) e faz o upload do resultado num bucket S3-compatível.

## Stack

- **Node.js + TypeScript** (modo estrito)
- **Fastify** — servidor HTTP
- **PostgreSQL + Prisma ORM** — persistência
- **Redis + BullMQ** — fila de processamento em background
- **Minio (S3-compatível)** — armazenamento dos arquivos gerados
- **Zod** — validação de request/response, também usado para gerar a documentação OpenAPI
- **Vitest** — testes unitários

## Como rodar

### 1. Subir a infraestrutura

```bash
docker compose up -d
```

Sobe Postgres, Redis e Minio, todos com healthcheck, e cria automaticamente o bucket `ai-content` no Minio.

### 2. Configurar o ambiente

```bash
cp .env.example .env
```

Os valores padrão já funcionam com o `docker-compose.yml` (inclusive a porta `5434` do Postgres — remapeada pra evitar conflito com uma instalação local de Postgres na porta padrão `5432`).

### 3. Instalar dependências

```bash
pnpm install
```

### 4. Rodar as migrations e o seed

```bash
pnpm prisma:migrate
pnpm db:seed
```

O seed cria um usuário de teste com 10 créditos.

### 5. Subir a API e o worker

São dois processos independentes — a API nunca bloqueia esperando o processamento da IA, e o worker escala separadamente:

```bash
pnpm dev          # API, em um terminal
pnpm dev:worker   # worker, em outro terminal
```

A API sobe em `http://localhost:3000`.

### 6. Rodar os testes

```bash
pnpm test
```

## Documentação (Swagger)

Com a API rodando, a documentação interativa (Swagger UI) fica em:

```
http://localhost:3000/docs
```

O JSON puro da especificação OpenAPI está em `http://localhost:3000/docs/json`. A documentação é gerada automaticamente a partir dos mesmos schemas Zod que validam as requisições em runtime — não existe um schema OpenAPI mantido manualmente em paralelo, então documentação e validação nunca ficam dessincronizadas.

## Endpoints

| Método | Rota                      | Descrição                                                                       |
| ------ | ------------------------- | ------------------------------------------------------------------------------- |
| `POST` | `/api/content/generate`   | Solicita a geração de um conteúdo (debita 1 crédito, enfileira o processamento) |
| `GET`  | `/api/content/:id`        | Consulta o status e o resultado de um conteúdo                                  |
| `POST` | `/api/content/:id/cancel` | Cancela um conteúdo ainda `PENDING` ou `PROCESSING`                             |
| `GET`  | `/health`                 | Healthcheck                                                                     |

## Decisões arquiteturais: concorrência e resiliência

Os dois pontos de atenção do desafio — débito de crédito sob requisições simultâneas, e cancelamento de um conteúdo exatamente enquanto o worker está processando — foram resolvidos com o mesmo princípio: **nunca ler o estado, decidir em código e escrever depois** (isso é vulnerável a race condition, mesmo com `await` bem colocado), mas sim delegar a condição para o próprio comando `UPDATE` do banco, no formato `UPDATE ... WHERE <condição>`. Uma única instrução SQL condicional é atômica no Postgres independentemente de quantas requisições ou workers estejam rodando em paralelo — inclusive em múltiplas instâncias, cenário real de um ambiente Cloud escalado horizontalmente. O débito de crédito usa `UPDATE users SET credits = credits - 1 WHERE id = ? AND credits > 0`, garantindo que o saldo nunca fica negativo mesmo sob concorrência real (validado com 10 requisições simultâneas contra um saldo de 3 créditos: exatamente 3 sucessos, 7 recusados, saldo final zero). O cancelamento durante o processamento usa três updates condicionais espelhados no `Content.status`: o worker só marca `PROCESSING` a partir de `PENDING` **ou** `PROCESSING` (aceitar o próprio `PROCESSING` como origem é necessário porque o BullMQ reexecuta a função de processamento inteira a cada retry, e sem isso um retry legítimo seria confundido com cancelamento), e só marca `COMPLETED` ou `FAILED` se o status **no momento exato da escrita** ainda for `PROCESSING`. Se o usuário cancelar durante os 5 segundos de espera da IA, a transição para `CANCELED` acontece imediatamente pela rota de cancelamento, e quando o worker tentar concluir o processamento depois, sua escrita condicional não encontra mais o status esperado e não tem efeito — o cancelamento do usuário prevalece, e o job cancelado nunca é ressuscitado. Resiliência a falhas é tratada com retry automático do BullMQ (3 tentativas, backoff exponencial) para a chamada simulada de IA, que falha propositalmente 20% das vezes; se todas as tentativas se esgotarem, o conteúdo é marcado `FAILED` e o crédito debitado é devolvido automaticamente ao usuário, também de forma condicional (só reembolsa se a transição para `FAILED` realmente aconteceu), evitando reembolso duplicado caso o evento de falha dispare mais de uma vez.

## Idempotência

Além da segurança contra concorrência, cada integração externa foi desenhada para que reprocessar o mesmo job nunca duplique efeitos colaterais:

- **PostgreSQL** — todas as transições de estado usam updates condicionais (`WHERE status = X`), nunca leitura-depois-escrita; rodar a mesma operação duas vezes é seguro por construção, a segunda vez vira no-op.
- **BullMQ** — cada job é enfileirado com `jobId` igual ao `id` do conteúdo (não um ID aleatório). Se o mesmo conteúdo fosse enfileirado duas vezes por qualquer motivo, o BullMQ deduplica nativamente.
- **S3 / Minio** — a chave do arquivo gerado é determinística (`content/{contentId}.txt`). Se o mesmo job for reprocessado (retry, ou redelivery de um job "stalled" pelo BullMQ), o upload sobrescreve o mesmo objeto em vez de criar arquivos duplicados no bucket.
- **Seed do banco** (`prisma/seed.ts`) — usa `upsert` por e-mail; rodar `pnpm db:seed` várias vezes não duplica o usuário de teste.

## Estrutura do projeto

```
src/
  config/        # validação de variáveis de ambiente (Zod, fail-fast no boot)
  http/
    routes/      # rotas Fastify
    plugins/     # error handler global
  schemas/       # schemas Zod (request/response, também viram documentação OpenAPI)
  services/      # regras de negócio
  repositories/  # acesso a dado via Prisma, sem regra de negócio
  queue/         # conexão e definição da fila BullMQ
  workers/       # consumer da fila e lógica de processamento do job
  lib/           # singletons (Prisma client, S3 client, logger)
  errors/        # classes de erro de domínio
  generated/     # client do Prisma (gerado, não versionado)
```

`src/index.ts` (API) e `src/worker.ts` (worker) são entrypoints separados — dois processos independentes que compartilham o mesmo código de domínio.
