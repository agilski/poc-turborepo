# Frontend Unit & Integration Test Setup — Design

Date: 2026-03-07

## Goal

Add unit and integration tests to the frontend app using Vitest and React Testing Library, covering all layers of the DDD/Hexagonal architecture.

## Tooling

- **Test runner:** Vitest (ESM-native, no Babel config needed, Jest-compatible API)
- **Component testing:** `@testing-library/react` + `@testing-library/user-event`
- **DOM matchers:** `@testing-library/jest-dom`
- **DOM environment:** `jsdom`
- **JSX transform:** `@vitejs/plugin-react`

### New dev dependencies

```
vitest
@vitejs/plugin-react
jsdom
@testing-library/react
@testing-library/user-event
@testing-library/jest-dom
```

### New scripts in `apps/frontend/package.json`

```json
"test":             "vitest run"
"test:watch":       "vitest"
"test:unit":        "vitest run --project unit"
"test:integration": "vitest run --project integration"
```

### New `test` task in `turbo.json`

```json
"test": {
  "dependsOn": ["^build"],
  "inputs": ["$TURBO_DEFAULT$"],
  "outputs": [],
  "cache": true
}
```

## Configuration files

### `apps/frontend/vitest.config.ts`

- Two Vitest `projects`:
  - `unit`: includes `src/**/domain/**/*.test.ts` and `src/**/application/**/*.test.ts`
  - `integration`: includes `src/**/infrastructure/**/*.test.ts` and `app/**/*.test.tsx`
- Both projects use `environment: "jsdom"` and `globals: true`
- Path alias `@/` resolves to the project root (mirrors `tsconfig.json`)
- `setupFiles: ["./vitest.setup.ts"]`

### `apps/frontend/vitest.setup.ts`

```ts
import "@testing-library/jest-dom";
```

## Test structure

Tests are co-located next to source files (Option A).

```
src/auth/
├── domain/
│   ├── credentials.vo.test.ts       ← unit
│   └── user.entity.test.ts          ← unit
├── application/
│   ├── login.use-case.test.ts       ← unit
│   ├── register.use-case.test.ts    ← unit
│   ├── logout.use-case.test.ts      ← unit
│   └── get-session.use-case.test.ts ← unit
└── infrastructure/
    └── http-auth.repository.test.ts ← integration

app/(auth)/
├── signin/
│   └── page.test.tsx                ← integration
└── signup/
    └── page.test.tsx                ← integration
```

## Mocking strategy

### Unit — domain

No mocks. Construct objects and assert shape/behaviour directly.

### Unit — use cases

Inject a plain object mock implementing `IAuthRepository`:

```ts
const mockRepo = {
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  getSession: vi.fn(),
};
```

Assert the use case delegates to the correct method with correct args. Assert errors thrown by the repo propagate unchanged.

### Integration — `HttpAuthRepository`

Mock `fetch` globally:

```ts
vi.stubGlobal("fetch", vi.fn());
```

Test cases per method:
- Happy path: `ok: true` → assert correct return value
- 4xx response: `ok: false` + `{ message }` → assert `AppError` with that message
- Network failure (fetch throws) → assert `AuthServiceUnavailableError`

Restore fetch in `afterEach`.

### Integration — page components

Mock the use case module:

```ts
vi.mock("@/src/auth", () => ({
  loginUseCase: { execute: vi.fn() },
  AppError: /* real class */,
}));
```

Mock Next.js router:

```ts
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
```

Use `@testing-library/user-event` to fill inputs and submit the form.

Assertions:
- Success → `router.push("/dashboard")` called
- Error (AppError thrown) → error message rendered in DOM
