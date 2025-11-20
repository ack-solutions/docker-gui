/** @type {import('next').NextConfig} */
const externalModules = ["dockerode", "ssh2", "@prisma/client", ".prisma/client"];

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer, webpack }) => {
    if (isServer) {
      if (typeof config.externals === "function") {
        const originalExternals = config.externals;
        config.externals = (context, request, callback) => {
          if (request && externalModules.includes(request)) {
            return callback(null, `commonjs ${request}`);
          }
          return originalExternals(context, request, callback);
        };
      } else {
        config.externals = [...(config.externals ?? []), ...externalModules];
      }

      // Provide polyfill for 'self' global used by @xterm/xterm during SSR
      // This injects the polyfill at the top of all server-side chunks
      config.plugins.push(
        new webpack.BannerPlugin({
          banner: "if (typeof global !== 'undefined' && typeof self === 'undefined') { global.self = global; }",
          raw: true,
          entryOnly: false,
        })
      );
    }

    return config;
  }
};

export default nextConfig;
