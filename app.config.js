// Web is a local visual-review surface only; the product remains Android-only.
module.exports = ({ config }) => process.env.REMILO_UI_PREVIEW === '1'
  ? { ...config, platforms: ['android', 'web'] } : config;
