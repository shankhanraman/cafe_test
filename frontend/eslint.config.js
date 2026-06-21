import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

// Backstops the harness at the CI layer (hooks H1/H5 catch the same issues earlier, in-loop).
export default tseslint.config(
  { ignores: ['dist', 'src/api/generated/**', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      // No raw network outside the api layer — use generated TanStack Query hooks.
      'no-restricted-globals': ['error', { name: 'fetch', message: 'Use the generated API hooks (src/api/generated).' }],
      'no-restricted-imports': ['error', { paths: [{ name: 'axios', message: 'Use the generated API hooks (src/api/generated).' }] }],
    },
  },
  {
    // The api layer and tests are allowed to do raw I/O.
    files: ['src/api/**', '**/*.{test,spec}.{ts,tsx}', 'src/mocks/**'],
    rules: { 'no-restricted-globals': 'off', 'no-restricted-imports': 'off' },
  }
);
