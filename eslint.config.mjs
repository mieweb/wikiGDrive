// @ts-check

import globals from 'globals';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.es2021,
        ...globals.webextensions,
        ...globals.browser,
        ...globals.node,
        ...globals.mocha,
        HTMLElementEventMap: false,
        IntersectionObserverInit: false
      },
      parser: vueParser,
      parserOptions: { "parser": "@typescript-eslint/parser" }
    },
    rules: {
      "linebreak-style": [
        "error",
        "unix"
      ],
      quotes: [
        "error",
        "single"
      ],
      semi: [
        "error",
        "always"
      ],
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "no-console": "off"
    },
    ignores: [
      "node_modules",
      "packages",
      "dist"
    ]
  }
);