const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('onnx', 'data');
if (!config.resolver.platforms.includes('web')) {
  config.resolver.platforms.push('web');
}

module.exports = config;
