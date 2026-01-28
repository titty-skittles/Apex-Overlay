import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        program: resolve(__dirname, "program.html"),
        control: resolve(__dirname, "control.html"),
      },
    },
  },
});
