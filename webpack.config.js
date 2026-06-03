const { DotenvRunPlugin } = require('@dotenv-run/webpack');

const APP_CHUNK_MAX_SIZE = 512 * 1024;

const HEAVY_VENDORS = [
  { name: 'chart-vendor', test: /[\\/]node_modules[\\/](chart\.js|chartjs-)/ },
  { name: 'tf-vendor', test: /[\\/]node_modules[\\/]@tensorflow/ },
  { name: 'primeng-vendor', test: /[\\/]node_modules[\\/](primeng|primeicons)/ },
  { name: 'd3-vendor', test: /[\\/]node_modules[\\/]d3(-|$|[\\/])/ },
  { name: 'tesseract-vendor', test: /[\\/]node_modules[\\/]tesseract/ },
];

module.exports = (config, options) => {
  config.plugins.push(
    new DotenvRunPlugin({
      prefix: 'NG_APP',
      cwd: process.cwd(),
      environment: options.configuration || process.env.NODE_ENV,
      nodeEnv: false,
    })
  );

  const existingGroups = config.optimization?.splitChunks?.cacheGroups ?? {};
  const vendorGroups = Object.fromEntries(
    HEAVY_VENDORS.map(({ name, test }) => [
      name,
      {
        test,
        name,
        chunks: 'all',
        priority: 40,
        enforce: true,
        reuseExistingChunk: true,
      },
    ])
  );

  config.optimization.splitChunks = {
    ...config.optimization.splitChunks,
    chunks: 'all',
    maxInitialRequests: 30,
    maxAsyncRequests: 30,
    cacheGroups: {
      ...existingGroups,
      ...vendorGroups,
      appCode: {
        test: /[\\/]src[\\/]/,
        chunks: 'all',
        maxSize: APP_CHUNK_MAX_SIZE,
        priority: 30,
        reuseExistingChunk: true,
      },
      vendors: {
        test: /[\\/]node_modules[\\/]/,
        name: 'vendors',
        chunks: 'all',
        priority: 10,
        reuseExistingChunk: true,
      },
    },
  };

  return config;
};
