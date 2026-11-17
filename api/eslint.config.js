import { configApp } from '@adonisjs/eslint-config'

export default configApp({
  files: ['tests/**/*.ts'],
  rules: {
    '@unicorn/no-await-expression-member': 'off',
  },
})
