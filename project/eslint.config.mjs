import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['out/**', 'dist/**', 'src/renderer/dist/**', 'dist-web/**', 'src/renderer/dist-web/**', 'node_modules/**', 'electron-dist/**', 'temp-ui-audit/**', 'scripts/temp_*.cjs']
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // 工具脚本（纯 Node 环境，无 TS 项目上下文）
    files: ['scripts/**/*.mjs', 'web-server.mjs'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly', URL: 'readonly', fetch: 'readonly' }
    }
  },
  {
    // CJS 工具脚本（如 scripts/verify-printpdf.cjs 本机 GPU 验证探针）
    files: ['scripts/**/*.cjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        require: 'readonly',
        setTimeout: 'readonly',
        __dirname: 'readonly'
      }
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off'
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-require-imports': 'error'
    }
  }
)
