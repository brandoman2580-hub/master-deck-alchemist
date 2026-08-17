/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ["tsx", "ts"],
  async redirects() {
    return [
      {
        source: "/deck-builder",
        destination: "/workshop",
        permanent: false,
      },
      {
        source: "/saved-decks",
        destination: "/deck-archives",
        permanent: false,
      },
    ];
  },
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
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
    },
  },
};

export default nextConfig;
