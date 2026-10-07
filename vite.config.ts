import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

export default defineConfig(({ mode }) => {
  // Server secrets stay in process.env; only VITE_* is exposed to the browser.
  for (const [name, value] of Object.entries(loadEnv(mode, process.cwd(), ""))) {
    process.env[name] ??= value;
  }
  return {
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
      dedupe: ["react", "react-dom"],
    },
    plugins: [
      tailwindcss(),
      tanstackStart({ server: { entry: "server" } }),
      nitro({ preset: "node-server" }),
      react(),
    ],
    server: { host: "127.0.0.1", port: 3000 },
  };
});
