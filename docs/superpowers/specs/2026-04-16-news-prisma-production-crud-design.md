# Design Spec: News CRUD em padrão NestJS + Prisma (produção)

- Data: 2026-04-16
- Projeto: `nest-api`
- Status: Aprovado em brainstorming
- Escopo: Módulo `news`

## 1. Contexto

O projeto usa NestJS 11 + Fastify + Better Auth + Prisma (SQLite). O módulo `news` foi gerado com `nest g resource` e ainda está com implementação scaffold (retornos estáticos), além de `entity` vazia e sem papel real com Prisma.

## 2. Objetivo

Implementar o módulo `news` no padrão de produção para stack NestJS + Prisma:

1. `schema.prisma` como fonte de verdade do modelo.
2. `NewsService` com regras de negócio e acesso ao banco via `PrismaService`.
3. `NewsController` apenas como fronteira HTTP.
4. DTOs para entrada/validação de payload.
5. Comportamento consistente de autenticação, autorização funcional e erros HTTP.

## 3. Fora de Escopo

1. Sistema de papéis (admin/editor).
2. Versionamento de notícias.
3. Busca textual, paginação avançada e filtros complexos.
4. Refatoração ampla fora do módulo `news`.

## 4. Decisões Aprovadas

1. Abordagem: **Service-centric com Prisma** (sem repositório dedicado neste momento).
2. `PATCH/DELETE`: permitido para **qualquer usuário autenticado**.
3. `POST /news`: `authorId` vem da sessão autenticada, nunca do body.
4. `GET /news/feed`: retorna apenas notícias publicadas.
5. `GET /news` autenticado: retorna todas as notícias (publicadas + rascunhos de todos os autores).

## 5. Arquitetura Alvo

## 5.1 Componentes

1. `NewsController`
- Recebe request/response HTTP.
- Aplica DTOs e parsing de parâmetros.
- Delega regras ao `NewsService`.

2. `NewsService`
- Centraliza regras de negócio da feature.
- Lê usuário autenticado (id) para criação.
- Usa `PrismaService` para CRUD.

3. `PrismaService`
- Cliente de persistência injetado via DI.
- Encapsula acesso ao Prisma Client com tipos gerados.

4. `NewsModule`
- Importa `PrismaModule`.
- Expõe controller e service da feature.

## 5.2 Entidade Nest (`news.entity.ts`)

Com Prisma, a modelagem do banco fica no `schema.prisma`. A `entity` gerada pelo `nest g resource` não é necessária para persistência.

Decisão: remover `news.entity.ts` para evitar duplicidade conceitual de modelo.

## 6. Modelagem de Dados (Prisma)

Fonte de verdade: `src/database/prisma/schema.prisma`.

Ajuste obrigatório para criação em produção:

1. `News.id` com geração automática: `@id @default(cuid())`.

Demais campos permanecem:

1. `title: String`
2. `content: Json`
3. `published: Boolean @default(false)`
4. `authorId: String` com relação para `User`
5. `createdAt` e `updatedAt`

## 7. Contrato da API

1. `GET /news/feed` (público)
- Retorna apenas `published = true`.
- Ordenação: `createdAt desc`.

2. `GET /news/feed/:id` (público)
- Retorna item apenas se publicado.
- Se inexistente ou não publicado: `404`.

3. `POST /news` (autenticado)
- Cria notícia com `authorId` da sessão.
- Ignora/recusa `authorId` vindo do body.

4. `GET /news` (autenticado)
- Retorna todas as notícias.

5. `GET /news/:id` (autenticado)
- Retorna qualquer notícia por id.
- Se inexistente: `404`.

6. `PATCH /news/:id` (autenticado)
- Atualiza notícia por id.
- Se inexistente: `404`.

7. `DELETE /news/:id` (autenticado)
- Remove notícia por id.
- Se inexistente: `404`.

## 8. DTOs e Validação

1. `CreateNewsDto`
- `title`: string obrigatória, não vazia.
- `content`: JSON obrigatório (`Record<string, unknown>` em nível de contrato HTTP).
- `published`: boolean opcional.
- Não incluir `authorId`.

2. `UpdateNewsDto`
- Versão parcial de `CreateNewsDto`.
- Não incluir `authorId`.

3. Param `:id`
- Tratar como `string` (CUID), sem conversão numérica.

## 9. Fluxo de Dados

1. Controller recebe requisição.
2. DTO valida payload.
3. Service extrai `userId` autenticado quando necessário.
4. Service monta query Prisma (`create/findMany/findUnique/update/delete`).
5. Prisma persiste/consulta e retorna tipos gerados.
6. Controller responde com payload final.

## 10. Erros e Mapeamento HTTP

1. Payload inválido: `400 Bad Request`.
2. Sem autenticação em rota privada: `401 Unauthorized`.
3. Recurso não encontrado: `404 Not Found`.
4. Item não publicado em rota pública por id: `404 Not Found`.
5. Falhas inesperadas de infraestrutura/banco: `500 Internal Server Error`.

## 11. Estratégia de Testes

1. Unit (`NewsService`)
- Mock de `PrismaService`.
- Cobrir regras: feed público, criação com `authorId` da sessão, `404` em ausência.

2. Controller
- Testar wiring básico (controller delega corretamente ao service).

3. E2E
- `GET /news/feed` público.
- `GET /news/feed/:id` público, com `404` para não publicado.
- `GET /news` e `POST/PATCH/DELETE /news` exigem autenticação (`401` sem sessão).
- Fluxo autenticado de CRUD funcionando com banco de teste.

## 12. Critérios de Aceitação

1. Módulo `news` sem retornos scaffold.
2. Sem dependência de `news.entity.ts` para persistência.
3. `schema.prisma` e migrations alinhados com `News.id` autogerado.
4. Endpoints públicos/privados seguindo regras aprovadas.
5. Testes unitários e e2e atualizados para validar comportamento real.
