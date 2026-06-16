import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

export default defineConfig({
    server: {
        port: 3000,
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
        },
    },
    plugins: [
        tailwindcss(),
        tanstackStart(),
        // react's vite plugin must come after start's vite plugin
        viteReact(),
    ],
})
