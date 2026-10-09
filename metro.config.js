const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
// Opt-in fixture preview for visual review only. Android always resolves the real module.
if (process.env.REMILO_UI_PREVIEW === '1') {
  config.resolver.resolveRequest = (context, name, platform) => {
    if (platform === 'web' && name.endsWith('/RemiloAlarmModule')) return {
      type: 'sourceFile', filePath: path.join(__dirname, 'verification/ui/preview-engine.ts'),
    };
    if (platform === 'web' && name.endsWith('/presentation-preview')) return {
      type: 'sourceFile', filePath: path.join(__dirname, 'verification/ui/presentation-preview.tsx'),
    };
    return context.resolveRequest(context, name, platform);
  };
}
module.exports = config;
