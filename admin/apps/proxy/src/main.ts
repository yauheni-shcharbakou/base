import { NodeValidationSchema, validateEnv } from '@packages/common';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import Joi from 'joi';

const env = validateEnv({
  ...NodeValidationSchema,
  ADMIN_AUTH_URL: Joi.string().uri().required(),
  ADMIN_MAIN_URL: Joi.string().uri().required(),
});

const app = express();

// Конфигурация соответствия путей и портов
const apps = [
  { path: '/auth', target: env.ADMIN_AUTH_URL },
  { path: '/main', target: env.ADMIN_MAIN_URL },
];

// Проксируем запросы динамически
apps.forEach((cfg) => {
  app.use(
    cfg.path,
    createProxyMiddleware({
      target: cfg.target,
      changeOrigin: true,
      // Важно для веб-сокетов (HMR в dev режиме)
      ws: true,
      // Пробрасываем заголовки
      xfwd: true,
    }),
  );
});

const port = env.PORT ?? 3336;

app.listen(port, () => {
  console.log(`Admin panel is started at http://localhost:${port}`);
});
