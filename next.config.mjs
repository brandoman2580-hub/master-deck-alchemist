/** @type {import('next').NextConfig} */
const nextConfig = {
    pageExtensions: ['tsx', 'ts'], // or simply ['tsx', 'ts']
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'images.ygoprodeck.com',
                port: '',
                pathname: '/images/**',
            },
        ],
    },

};

export default nextConfig;
