# Soft Delete -- Modulo de Noticias

**Data:** 2026-04-16

## Contexto

O modulo de noticias atualmente executa hard delete via `prisma.news.delete`. O objetivo e substituir por soft delete, preservando registros no banco e permitindo restauracao por usuarios autenticados.

## Decisoes

- Campo `deletedAt DateTime?` no model `News` (abordagem por timestamp)
- Registros existentes ficam com `deletedAt: null` sem backfill necessario
- Restore via `PATCH /news/:id` com `{ "deleted": false }` no body

## Schema

Adicionar ao model `News` em `src/database/prisma/schema.prisma`:

```prisma
deletedAt DateTime?
```

Gerar migracao: `prisma migrate dev --name add-news-deleted-at`

## Service (`news.service.ts`)

### `remove(id)`
- Substitui `prisma.news.delete` por `prisma.news.update({ data: { deletedAt: new Date() } })`
- `assertExists` continua filtrando por `deletedAt: null` -- tentativa de deletar registro ja deletado retorna 404

### `findPublicFeed` e `findPublicById`
- Adicionam `deletedAt: null` ao `where` -- noticias deletadas sao completamente invisiveis para usuarios anonimos

### `findAll` (autenticado)
- Adiciona `deletedAt: null` ao `where` por padrao
- Quando `query.includeDeleted === true`, omite esse filtro

### `findOne` (autenticado)
- Nao filtra `deletedAt` -- retorna registros deletados para permitir visualizacao, edicao e restauracao

### `update(id, dto)`
- Quando `dto.deleted === false`: seta `deletedAt: null` (restore)
- Quando `dto.deleted === true`: seta `deletedAt: new Date()` (delete via patch)
- Os demais campos (`title`, `content`, `published`) continuam funcionando normalmente

## DTOs

### `UpdateNewsDto`
Adicionar campo opcional:
```ts
deleted?: boolean
```

### `NewsQueryDto`
Adicionar campo opcional:
```ts
includeDeleted?: boolean
```

### `NewsResponseDto`
Adicionar campo ao schema Zod:
```ts
deletedAt: z.iso.datetime().nullable()
```

## Visibilidade por Rota

| Rota                    | Acesso      | Ve deletadas? |
|-------------------------|-------------|---------------|
| GET /news/feed          | Anonimo     | Nao           |
| GET /news/feed/:id      | Anonimo     | Nao (404)     |
| GET /news               | Autenticado | Nao (padrao); sim com `?includeDeleted=true` |
| GET /news/:id           | Autenticado | Sim           |
| PATCH /news/:id         | Autenticado | Sim (restore) |
| DELETE /news/:id        | Autenticado | Nao (404 se ja deletada) |

## Testes

Casos a adicionar nos specs existentes:

- `remove`: verifica chamada a `update` com `deletedAt` (nao `delete`)
- `findPublicFeed`: verifica `deletedAt: null` no `where`
- `findPublicById`: verifica `deletedAt: null` no `where`
- `findAll` sem `includeDeleted`: verifica `deletedAt: null` no `where`
- `findAll` com `includeDeleted: true`: verifica ausencia do filtro `deletedAt`
- `findOne`: retorna registro com `deletedAt` preenchido
- `update` com `deleted: false`: verifica `deletedAt: null` no data
- `update` com `deleted: true`: verifica `deletedAt` com instancia de Date
