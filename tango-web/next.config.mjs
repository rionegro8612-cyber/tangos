/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // 개발환경(localhost)일 때만 API 서버로 프록시
    if (process.env.NODE_ENV !== "production") {
      return [
        {
          source: "/api/v1/:path*",
          destination: "http://localhost:4100/api/v1/:path*", // ← localhost 고정
        },
      ];
    }
    // 프로덕션 환경에서는 별도 API Gateway나 도메인을 사용
    return [];
  },
};

export default nextConfig;
