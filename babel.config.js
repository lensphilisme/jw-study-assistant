module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          // Transform import.meta for web compatibility
          unstable_transformImportMeta: true,
        },
      ],
    ],
    plugins: ['react-native-worklets/plugin'],
  };
};

