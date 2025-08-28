import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // TypeScript 관련 규칙 강화
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/explicit-function-return-type": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",
      
      // React 관련 규칙 강화
      "react-hooks/exhaustive-deps": "error",
      "react-hooks/rules-of-hooks": "error",
      "react/no-unescaped-entities": "error",
      "react/self-closing-comp": "error",
      
      // 일반적인 코드 품질 규칙
      "no-console": "warn",
      "no-debugger": "error",
      "no-alert": "warn",
      "prefer-const": "error",
      "no-var": "error",
      
      // Next.js 관련 규칙
      "@next/next/no-img-element": "warn",
      "@next/next/no-html-link-for-pages": "error",
    },
    // 프로덕션 빌드 시 더 엄격한 규칙 적용
    overrides: [
      {
        files: ["**/*.{ts,tsx}"],
        env: {
          node: true,
          browser: true,
          es2022: true,
        },
      },
    ],
  },
];
export default eslintConfig;

