export default defineConfig({
  base: "./",
  plugins: [
    react(),
    tailwindcss()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  }
});
