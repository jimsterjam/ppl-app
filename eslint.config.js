// ESLint Flat config for root workspace (client + server)
import js from '@eslint/js'
import vue from 'eslint-plugin-vue'
import unusedImports from 'eslint-plugin-unused-imports'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

export default [
  {
    ignores: [
      'client/dist/**',
      'client/ios/App/App/public/**',
      'future-features/**',
      'client/node_modules/**',
      'server/node_modules/**',
      '**/node_modules/**',
      '**/*.min.js',
      'server/server.log'
    ]
  },
  js.configs.recommended,
  // Vue 3 flat recommended rules
  ...vue.configs['flat/recommended'],
  // Client-side (Vue + JS)
  {
    files: ['client/src/**/*.{js,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        // allow console in client code
        console: 'readonly'
      }
    },
    plugins: {
      'unused-imports': unusedImports
    },
    rules: {
      // Unused imports/vars help to spot dead or redundant code
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'unused-imports/no-unused-imports': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      // Vue convenience rules for our code style
      'vue/multi-word-component-names': 'off', // allow single-word component names
      'vue/no-dupe-v-else-if': 'warn',
      'vue/no-unused-vars': 'warn'
    }
  },
  // Server-side (Node/Express)
  {
    files: ['server/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        console: 'readonly',
        process: 'readonly'
      }
    },
    plugins: {
      'unused-imports': unusedImports
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'unused-imports/no-unused-imports': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }]
    }
  },
  // Node-specific files outside server folder
  {
    files: ['client/vite.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        console: 'readonly',
        __dirname: 'readonly'
      }
    }
  },
  {
    files: ['client/scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        console: 'readonly',
        process: 'readonly',
        fetch: 'readonly',
        URLSearchParams: 'readonly',
        setTimeout: 'readonly'
      }
    },
    rules: {
      'no-empty': ['warn', { allowEmptyCatch: true }]
    }
  },
  {
    files: ['server/scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        console: 'readonly',
        process: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly'
      }
    },
    rules: {
      'no-empty': ['warn', { allowEmptyCatch: true }]
    }
  },
  {
    files: ['server.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        console: 'readonly',
        __dirname: 'readonly',
        require: 'readonly',
        process: 'readonly'
      }
    }
  },
  // Turn off rules that conflict with Prettier formatting
  prettier
]
