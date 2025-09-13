module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    // Remove project reference to avoid TSConfig conflicts
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
  ],
  env: {
    node: true,
    es2020: true,
  },
  rules: {
    // Allow console.error for MCP servers (stdio protocol requirement)
    'no-console': ['error', { allow: ['error'] }],
    // Basic TypeScript rules
    'no-unused-vars': 'off', // Turn off base rule for TypeScript
    'no-undef': 'off', // TypeScript handles this
    'no-useless-catch': 'off', // Allow catch-rethrow patterns
    'no-case-declarations': 'off', // Allow declarations in case blocks
  },
  ignorePatterns: [
    'dist/',
    'node_modules/',
    '*.js',
    '*.d.ts',
    'src/__tests__/', // Exclude all test files
    'src/debug-client.ts', // Excluded from build
  ],
};