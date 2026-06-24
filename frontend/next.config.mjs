/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Silence RainbowKit/wagmi dependency warnings in browser
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "pino-pretty": false,
      "@react-native-async-storage/async-storage": false,
    };
    return config;
  },
};

export default nextConfig;
