import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['server/**/*.test.ts'],
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      DB_PATH: ':memory:',
      APP_SECRET: 'test-secret-test-secret-test-secret-0000',
      ADMIN_EMAIL: 'admin@test.local',
      ADMIN_PASSWORD: 'adminpass123',
    },
  },
});
