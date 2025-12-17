/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['images.unsplash.com'],
  },
  // Improve font loading
  optimizeFonts: true,
  // Enable instrumentation hook for server-side initialization
  experimental: {
    instrumentationHook: true,
  },
}

module.exports = nextConfig
