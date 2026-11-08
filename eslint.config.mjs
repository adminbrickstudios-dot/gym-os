import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  {
    // Next 16 trae reglas nuevas del compilador de React. La migración no cambia comportamiento: quedan apagadas y se revisan una por una más adelante.
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
      "react-hooks/static-components": "off",
      "react-hooks/error-boundaries": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      ".next-dev/**",
      ".next-dev2/**",
      ".local/**",
      ".claude/worktrees/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
