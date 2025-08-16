/** @type {import('next').NextConfig} */
const nextConfig = {
    async rewrites() {
      return [
        {
          source: "/api/v1/:path*",
          destination: "http://127.0.0.1:4100/api/v1/:path*",
        },
      ];
    },
  };
  
  export default nextConfig;
  