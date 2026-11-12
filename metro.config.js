const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// obscenity's ESM entry (index.mjs) re-exports its CommonJS build in a way Metro's web bundle
// can't unwrap, so the language filter crashed web previews. Use the CommonJS build everywhere
// (iOS/Android already resolve to it via the package's "react-native" export).
const obscenityMain = path.join(__dirname, 'node_modules/obscenity/dist/index.js');
const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'obscenity') return { type: 'sourceFile', filePath: obscenityMain };
  return (defaultResolve ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
