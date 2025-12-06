/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Konfiguracja dla bibliotek wymagających środowiska przeglądarki
  webpack: (config, { isServer }) => {
    // Wyłącz SSR dla html-to-image (wymaga środowiska przeglądarki)
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
  // Optymalizacja obrazów
  images: {
    unoptimized: false,
  },
};

module.exports = nextConfig;

