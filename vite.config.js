import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  server: {
    //host: false,      // listens on 0.0.0.0 (LAN)
    proxy: {
      "/sse": {
        target: "http://127.0.0.1:5174",
        changeOrigin: true,
      },
      "/api": {
        target: "http://127.0.0.1:5174",
        changeOrigin: true,
      },
      "/health": {
        target: "http://127.0.0.1.:5174",
        changeOrigin: true,
      },
    },
  },

  build: {
    rollupOptions: {
      input: {
        program: resolve(__dirname, "program.html"),
        control: resolve(__dirname, "control.html"),
      },
    },
  },
});
