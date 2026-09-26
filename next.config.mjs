/** @type {import('next').NextConfig} */
const nextConfig = {
    // Keep dev artifacts separate from production build artifacts
    // to avoid cache/chunk corruption when both commands are used.
    distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
    // No next/image in the app: the optimizer (/_next/image) stays off instead of fetching any https URL
    // for anyone, which is also where the Next 14 image advisories live.
    images: {
        unoptimized: true,
    },
};

export default nextConfig;
