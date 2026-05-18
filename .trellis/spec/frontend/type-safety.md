# Type Safety

> Type safety patterns in ArkmeDemo.

## Overview

The project uses TypeScript with strict compiler settings. `tsconfig.json` enables `strict`, `noUnusedLocals`, `noUnusedParameters`, and `noFallthroughCasesInSwitch`.

## Type Organization

- Shared domain types live under `src/types/`, for example `src/types/record.ts`.
- Data-module types live beside their data helpers when they are specific to that module, for example `TestMessage` in `src/data/testConversations.ts`.
- Component-local types stay in the component file when they are not reused elsewhere.
- Public exported data shapes should be explicit, for example `AiConversationLogEntry` in `src/data/aiConversationLog.ts`.

## Validation

There is no runtime validation library. Runtime validation is done through small normalizer functions that accept `unknown`, check object shape, and return typed values or safe defaults.

Examples:

- `normalizeIdentity`, `normalizeGroup`, and `normalizeMessage` in `src/data/testConversations.ts`.
- `normalizeStoredSelfRecord` and `normalizeStoredRecordReference` in `src/pages/Home.tsx`.

## Common Patterns

- Use string unions for modes and page keys, such as `PageType`, `TestConversationType`, and `ThemeMode`.
- Use type predicates after normalization filters:

```ts
.filter((identity): identity is TestIdentity => Boolean(identity))
```

- Use `Record<string, number>` for simple dictionary-like state such as `TestReadState`.
- Use `Partial<T>` only after verifying an unknown value is an object.

## Forbidden Patterns

- Do not use `any` for parsed browser storage or external input.
- Do not assert stored JSON directly to final app types without normalization.
- Do not broaden existing unions with unused values.
- Do not add unused props or types; the compiler rejects unused locals and parameters.
