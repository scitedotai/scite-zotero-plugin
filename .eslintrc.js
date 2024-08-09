const path = require('path');
const config = require('zotero-plugin/.eslintrc')

// Add this block
config.parserOptions = {
  ...config.parserOptions,
  ecmaFeatures : {
    jsx: true
  },
  settings: {
    react: {
      version: "detect"
    }
  },
  project: path.resolve(__dirname, './tsconfig.json'),
  tsconfigRootDir: __dirname,
}

config.parser = '@typescript-eslint/parser'

config.rules['@typescript-eslint/consistent-type-definitions'] = 'off'
config.rules['@typescript-eslint/member-ordering'] = 'off'
config.rules['max-classes-per-file'] = 'off'
config.rules['no-console'] = 'error'
config.rules['no-new-func'] = 'off'
config.rules['@typescript-eslint/semi'] = 'off'
config.rules['no-magic-numbers'] = 'off'
config.rules['@typescript-eslint/semi'] = 'off'
config.rules['no-underscore-dangle'] = [ 'error', { "allowAfterThis": true } ]

config.rules['@typescript-eslint/no-unsafe-member-access'] = 'off'
config.rules['@typescript-eslint/no-unsafe-call'] = 'off'
config.rules['@typescript-eslint/prefer-regexp-exec'] = 'off'
config.rules['@typescript-eslint/no-implied-eval'] = 'off'
config.rules['@typescript-eslint/no-unsafe-assignment'] = 'off'
config.rules['@typescript-eslint/no-unsafe-argument'] = 'off'
config.rules['@typescript-eslint/no-unsafe-return'] = 'off'
config.rules['@typescript-eslint/restrict-template-expressions'] = 'off'
config.rules['@typescript-eslint/explicit-module-boundary-types'] = 'off'
config.rules['@typescript-eslint/no-unused-vars'] = 'off'
config.rules['brace-style'] = 'off'
config.rules['no-useless-escape'] = 'off'
config.rules['prefer-rest-params'] = 'off'
config.rules['prefer-arrow/prefer-arrow-functions'] = 'off'
config.rules['@typescript-eslint/no-inferrable-types'] = 'off'
config.rules['@typescript-eslint/restrict-plus-operands'] = 'off'
config.rules['@typescript-eslint/require-await'] = 'off'
config.rules['prefer-spread'] = 'off'
config.rules['no-underscore-dangle'] = 'off'

config.rules['@typescript-eslint/ban-ts-comment'] = 'warn'
config.rules['@typescript-eslint/member-delimiter-style'] = [ 'error', {
  multiline: { delimiter: 'none', requireLast: false },
  singleline: { delimiter: 'comma', requireLast: false },
}]

config.ignorePatterns = [
  'webpack.config.ts',
  "build/*",
  "xpi/*"
]

module.exports = config
