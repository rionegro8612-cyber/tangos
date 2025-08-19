/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // 프로덕션에서는 환경변수 기반으로 프록시 대상 지정
    // 예: API_PROXY_TARGET="https://api.tango.app"
    const target =
      process.env.NODE_ENV === "production"
        ? process.env.API_PROXY_TARGET
        : "http://localhost:4100";

    // target이 없으면 리라이트 비활성화(직접 절대경로 호출 사용)
    if (!target) return [];

    // /api/* → 백엔드로 프록시 (쿠키는 3000 오리진에 귀속되어 자동 동봉됨)
    return [
      {
        source: "/api/:path*",
        destination: `${target}/api/:path*`,
      },
    ];
  },

  // 필요시: 빌드 타임 환경에 따라 베이스패스/출력 경로 설정 가능
  // basePath: "",
  // output: "standalone",
};

export default nextConfig;
