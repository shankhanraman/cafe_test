import { defineConfig } from 'orval';

// One spec → typed client + TanStack Query hooks + MSW handlers + Zod schemas.
// Output lives in src/api/generated and is NEVER hand-edited (hook H1 enforces this).
export default defineConfig({
  api: {
    input: './openapi.yaml',
    output: {
      mode: 'tags-split',
      target: 'src/api/generated',
      schemas: 'src/api/generated/model',
      client: 'react-query',
      httpClient: 'fetch',
      mock: true, // generate MSW handlers from the spec
      clean: true,
      prettier: true,
      override: {
        mutator: { path: 'src/api/http-client.ts', name: 'customFetch' },
        query: { useQuery: true, useMutation: true },
      },
    },
  },
  zod: {
    input: './openapi.yaml',
    output: {
      mode: 'tags-split',
      target: 'src/api/generated',
      client: 'zod',
      fileExtension: '.zod.ts',
    },
  },
});
