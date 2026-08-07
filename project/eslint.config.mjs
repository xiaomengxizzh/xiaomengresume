import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['out/**', 'dist/**', 'node_modules/**', 'electron-dist/**']
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // 工具脚本（纯 Node 环境，无 TS 项目上下文）
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly' }
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
