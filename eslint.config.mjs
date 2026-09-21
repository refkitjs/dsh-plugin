import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['lib/**', 'node_modules/**', 'docs/**'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      '@typescript-eslint/consistent-type-assertions': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
  { files: ['tests/**'], rules: { '@typescript-eslint/no-explicit-any': 'off', '@typescript-eslint/no-non-null-assertion': 'off' } },
)
