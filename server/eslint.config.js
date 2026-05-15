/**
 * eslint.config.js
 * Configuration ESLint pour le serveur Node.js/Express TransiFlow.
 * Utilise le nouveau format "flat config" d'ESLint v9+.
 */

const js = require('@eslint/js')

module.exports = [
  // Règles recommandées par ESLint pour JavaScript
  js.configs.recommended,

  {
    // On cible uniquement les fichiers JS du serveur
    files: ['**/*.js'],

    languageOptions: {
      // Environnement Node.js : accès aux globals (process, require, __dirname, etc.)
      globals: {
        require:    'readonly',
        module:     'readonly',
        exports:    'writable',
        process:    'readonly',
        __dirname:  'readonly',
        __filename: 'readonly',
        console:    'readonly',
      },
      ecmaVersion: 2022,
      sourceType:  'commonjs',
    },

    rules: {
      // Interdit les variables déclarées mais jamais utilisées
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

      // Oblige à gérer les erreurs dans les callbacks asynchrones
      'no-console': 'off', // Autorisé côté serveur pour les logs

      // Empêche les re-déclarations accidentelles
      'no-var': 'error',

      // Préfère const/let à var
      'prefer-const': 'warn',
    },
  },

  {
    // Ignore les dossiers non pertinents
    ignores: ['node_modules/**'],
  },
]
