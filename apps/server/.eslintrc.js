module.exports = {
  env: {
    node: true,
    es2020: true,
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
  },
  rules: {
    // 개발 완료 시까지 모든 규칙 비활성화
    "no-unused-vars": "off",
    "no-console": "off",
    "prefer-const": "off",
  },
  ignorePatterns: ["dist/", "node_modules/"],
};
