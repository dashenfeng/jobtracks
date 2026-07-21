import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // React 19 / Next.js 16 引入的新规则，对历史代码冲击较大，留作后续单独重构：
      // - react-hooks/set-state-in-effect: 禁止在 effect 里直接 setState（现有大量"effect 内 fetch + setState"模式）
      // - react-hooks/purity: 禁止在 render 里调用 Date.now() 等非纯函数（1 处 UpcomingInterviews 待重构）
      // - react-hooks/refs: 禁止在 render 里访问 ref.current（Chat.tsx 的 transport 初始化模式）
      // TODO: 后续按 https://react.dev/learn/you-might-not-need-an-effect 重构后重新启用
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
