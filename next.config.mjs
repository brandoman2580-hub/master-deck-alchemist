/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ["tsx", "ts"], // or simply ['tsx', 'ts']
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "mda-card-images-prod.s3.us-east-1.amazonaws.com",
        port: "",
        pathname: "/cards_small/**",
      },
    ],
  },
  turbopack: {
    rules: {
      // Handle SVG files as React components using @svgr/webpack
      // SVG files with ?url query parameter will be handled by Next.js default behavior
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
    },
  },
};

export default nextConfig;
