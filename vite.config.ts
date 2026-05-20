// import { defineConfig } from "vite-plus";

// export default defineConfig({
//   staged: {
//     "*": "vp check --fix",
//   },
//   pack: {
//     dts: {
//       tsgo: true,
//     },
//     exports: true,
//   },
//   lint: {
//     options: {
//       typeAware: true,
//       typeCheck: true,
//     },
//   },
//   fmt: {},
// });

import { defineConfig } from "vite-plus";

const ignores = ["**/pnpm-lock.yaml", "**/bun.lock", ".vite-hooks/**/*"];

export default defineConfig({
  staged: {
    // "*": "vp check --fix",
    "*": "echo ok",
  },
  test: {
    include: ["**/test/**/*.test.ts", "**/test/**/*.ts"],
    exclude: ["**/dist/**", "**/node_modules/**", "**/src/**/*.test.ts"],
  },
  fmt: {
    printWidth: 100,
    ignorePatterns: ignores,
  },
  lint: {
    ignorePatterns: ignores.concat(
      "**/dist/**",
      "packages/formidable/**/*.js",
      ".agents/**/*",
      ".pi/skills/**/*",
      "scripts/**/*",
    ),
    env: {
      builtin: true,
    },
    settings: {
      jsdoc: {
        ignorePrivate: true,
        tagNamePreference: {
          return: "returns",
        },
      },

      vitest: {
        typecheck: true,
      },
    },

    options: {
      typeAware: true,
      typeCheck: true,
    },

    overrides: [
      {
        files: ["**/*.{ts,tsx}"],
        plugins: ["import"],
        rules: {
          "no-var": "error",
          "no-unused-vars": "error",
          "jsdoc/require-yields": "off",
          "@typescript-eslint/consistent-type-imports": [
            "error",
            {
              prefer: "type-imports",
              fixStyle: "separate-type-imports",
            },
          ],
          "@typescript-eslint/consistent-type-exports": [
            "error",
            { fixMixedExportsWithInlineTypeSpecifier: false },
          ],
          "typescript/no-floating-promises": "off",
          "import/extensions": ["error", "always", { ignorePackages: true }],
        },
      },
      {
        files: ["**/src/**/*.{ts,tsx}"],
        plugins: ["jsdoc"],
        rules: {
          "jsdoc/check-access": "error",
          "jsdoc/check-property-names": "error",
          "jsdoc/check-tag-names": "error",
          "jsdoc/empty-tags": "error",
          "jsdoc/implements-on-classes": "error",
          "jsdoc/no-defaults": "error",
          "jsdoc/require-param": "error",
          "jsdoc/require-param-description": "error",
          "jsdoc/require-param-name": "error",
          "jsdoc/require-returns": ["error", { checkGetters: false }],
          "jsdoc/require-returns-description": "error",
        },
      },
      {
        files: ["**/test/**/*.ts"],
        plugins: ["jsdoc", "vitest"],
        env: {
          vitest: true,
        },
        rules: {
          "jsdoc/check-access": "off",
          "jsdoc/check-property-names": "off",
          "jsdoc/check-tag-names": "off",
          "jsdoc/empty-tags": "off",
          "jsdoc/implements-on-classes": "off",
          "jsdoc/no-defaults": "off",
          "jsdoc/require-param": "off",
          "jsdoc/require-param-description": "off",
          "jsdoc/require-param-name": "off",
          "jsdoc/require-returns": "off",
          "jsdoc/require-returns-description": "off",

          "vitest/no-commented-out-tests": "warn",
          "vitest/no-conditional-expect": "off",
          // "vitest/padding-around-all": "error",
          // "vitest/padding-around-before-all-blocks": "error",

          "jest/no-commented-out-tests": "off",
          "vitest/consistent-test-it": "error",
          "vitest/require-mock-type-parameters": "off",
          "vitest/no-alias-methods": "error",
          "vitest/prefer-called-once": "error",
          "vitest/prefer-called-times": "error",
          "vitest/prefer-called-with": "error",
          "vitest/prefer-comparison-matcher": "error",
          "vitest/prefer-equality-matcher": "error",

          "vitest/require-to-throw-message": "error",
        },
      },
    ],
  },
  run: {
    cache: {
      scripts: true, // Cache package.json scripts (default: false)
      tasks: true, // Cache task definitions (default: true)
    },
    tasks: {
      format: {
        command: "vp fmt --write",
        input: ["**/*.ts", "!**/dist/**/*", "!**/node_modules/**/*"],
      },

      lint: {
        command: "vp lint --fix --quiet",
        input: ["**/*.ts", "!**/dist/**/*", "!**/node_modules/**/*"],
      },

      check: {
        command: "vp check --fix",
        input: ["**/*.ts", "!**/dist/**/*", "!**/node_modules/**/*"],
      },

      bundle: {
        command: "vp run -r bundle",
        input: ["**/*.ts", "!**/dist/**/*", "!**/node_modules/**/*"],
      },

      build: {
        command: "rm -rf dist && tsc -p ./tsconfig.build.json",
        input: ["src/**/*.ts", "!**/dist/**/*"],
      },

      // build: {
      //   command: "vp run -r build",
      //   input: ["**/*.ts", "!**/dist/**/*", "!**/node_modules/**/*"],
      // },

      test: {
        command: "vp run -r test",
        input: ["**/*.ts", "!**/dist/**/*", "!**/node_modules/**/*"],
      },
    },
  },
});
