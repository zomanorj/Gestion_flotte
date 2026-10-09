// ESLint (configuration « flat ») : règles recommandées JavaScript, React et hooks React.
// Lancé en CI (npm run lint) : toute erreur fait échouer la vérification.
import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['dist/', 'coverage/'] },
  { settings: { react: { version: 'detect' } } },

  js.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],

  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Pas de PropTypes : les composants sont internes à l'application
      'react/prop-types': 'off',
      // Apostrophes et guillemets français dans le texte JSX
      'react/no-unescaped-entities': 'off',
      // Un composant déclaré dans un autre est recréé à chaque rendu : ses champs perdent le
      // focus et son état est réinitialisé (cas rencontré sur le formulaire des maintenances)
      'react/no-unstable-nested-components': 'error',
      // Variables ignorées volontairement : préfixe _ (ex. déstructuration pour retirer une clé)
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },

  // Scripts et configuration exécutés par Node
  {
    files: ['scripts/**/*.{js,mjs}', '*.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },

  // Tests (Vitest, globals désactivés : vi/describe/it sont importés)
  {
    files: ['src/**/*.test.{js,jsx}', 'src/test/**/*.{js,jsx}'],
    languageOptions: { globals: { ...globals.node } },
  },
];
