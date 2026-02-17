/** @type {import('next').NextConfig} */
const nextConfig = {
    // Keep dev artifacts separate from production build artifacts
    // to avoid cache/chunk corruption when both commands are used.
    distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
            },
        ],
    },
    experimental: {
        serverActions: {
            bodySizeLimit: '10mb',
        },
    },
};

export default nextConfig;
