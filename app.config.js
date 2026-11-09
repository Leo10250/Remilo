// Web is a local visual-review surface only.
module.exports = ({ config }) =>
  process.env.REMILO_UI_PREVIEW === '1'
    ? { ...config, platforms: [...config.platforms, 'web'] }
    : config;
