module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-worklets/plugin is injected automatically by babel-preset-expo
    // (SDK 54+) when it detects react-native-worklets in node_modules.
    // Do NOT add it here — double-application causes a Babel transform crash.
  };
};
