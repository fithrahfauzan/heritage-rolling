import { defineConfig } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
    plugins: [viteReact()],
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
        },
    },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/test/setup.ts'],
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
    },
})
