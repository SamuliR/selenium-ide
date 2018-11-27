module.exports = {
  env: {
    browser: true,
    node: true,
    es6: true,
    jest: true,
    webextensions: true,
  },
  extends: ['eslint:recommended', 'plugin:react/recommended', 'prettier'],
  parser: 'babel-eslint',
  parserOptions: {
    ecmaFeatures: {
      experimentalObjectRestSpread: true,
      jsx: true,
      legacyDecorators: true,
    },
    sourceType: 'module',
  },
  plugins: ['jest', 'react', 'prettier'],
  rules: {
    'prettier/prettier': 'warn',
    'react/prop-types': [1],
    'no-const-assign': 'warn',
    'no-this-before-super': 'warn',
    'no-undef': 'warn',
    'no-unreachable': 'warn',
    'no-unused-vars': [
      'warn',
      { varsIgnorePattern: '^_', args: 'all', argsIgnorePattern: '^_' },
    ],
    'constructor-super': 'warn',
    'valid-typeof': 'warn',
    'no-console': 'warn'
  },
}
