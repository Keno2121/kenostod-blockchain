import type { SnapConfig } from '@metamask/snaps-cli';

const config: SnapConfig = {
  bundler: 'webpack',
  input: 'src/index.ts',
  output: {
    path: 'dist',
    filename: 'bundle.js',
  },
  server: {
    port: 8080,
  },
  sourceMap: false,
};

export default config;
