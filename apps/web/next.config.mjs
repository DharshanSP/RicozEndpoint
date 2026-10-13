/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  async redirects() {
    return [
      // Legacy React Router path kept alive for old bookmarks.
      { source: '/device-groups', destination: '/devices/groups', permanent: false },
    ];
  },
  async rewrites() {
    const apiTarget = (process.env.API_PROXY_TARGET || 'http://localhost:3001').replace(/\/+$/, '');
    return [
      {
        source: '/api/:path*',
        destination: `${apiTarget}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
