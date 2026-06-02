import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src')
        }
    },
    test: {
        environment: 'node',
        globals: true,
        include: ['test/**/*.test.ts'], // Only run .test.ts files to avoid playwright .spec.ts
    }
});
