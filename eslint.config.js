const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expo,
  { ignores: ['android/**', '.expo/**', '.tooling/**', 'verification/**', 'modules/**/android/**'] },
]);
