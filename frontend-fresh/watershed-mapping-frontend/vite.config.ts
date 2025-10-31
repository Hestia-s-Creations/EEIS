import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import sourceIdentifierPlugin from 'vite-plugin-source-identifier'

const isProd = process.env.BUILD_MODE === 'prod'
export default defineConfig({
  plugins: [
    react(),
    sourceIdentifierPlugin({
      enabled: !isProd,
      attributePrefix: 'data-matrix',
      includeProps: true,
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 6969,
    strictPort: true,
    host: true
  },
  optimizeDeps: {
    include: ['leaflet', 'react-leaflet'],
    exclude: ['@react-leaflet/core']
  },
  build: {
    commonjsOptions: {
      include: [/leaflet/, /react-leaflet/, /node_modules/]
    }
  }
})

