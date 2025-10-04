import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}", 
  ],
  theme: {
    extend: {
      container: { center: true, padding: "1rem" },
      boxShadow: { soft: "0 10px 30px rgba(0,0,0,0.06)" },
    },
  },
  plugins: [],
};
export default config;
