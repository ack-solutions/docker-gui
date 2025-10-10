/** @type {import('next').NextConfig} */
const externalModules = ["dockerode", "ssh2", "typeorm", "reflect-metadata", "sqlite3"];

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  webpack: (config, { isServer }) => {
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
    }

    return config;
  }
};

export default nextConfig;
