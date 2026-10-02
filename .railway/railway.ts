import {
  database,
  defineRailway,
  github,
  group,
  preserve,
  project,
  redis,
  service,
  volume,
} from 'railway/iac';

// Service names carry no dot: Railway reads the first dot of a reference as the end of the service
// name, so `${{backend.auth.X}}` resolves to an empty string. The packages of this repository keep
// their dotted names (`backend.auth`); only the Railway services are named this way.
const SERVICE = {
  AUTH: 'backend-auth',
  API_GATEWAY: 'backend-api-gateway',
  STORAGE: 'backend-storage',
  ADMIN: 'frontend-admin',
} as const;

// gRPC listens on one port in every service; a client reaches another one on its private domain.
// A string, not `service.env.RAILWAY_PRIVATE_DOMAIN`, because the port follows the reference.
const GRPC_PORT = 8000;
const bindGrpcUrl = `0.0.0.0:${GRPC_PORT}`;
const privateGrpcUrl = (service: (typeof SERVICE)[keyof typeof SERVICE]) =>
  `\${{${service}.RAILWAY_PRIVATE_DOMAIN}}:${GRPC_PORT}`;

export default defineRailway(() => {
  const base = github('yauheni-shcharbakou/base', { checkSuites: true });

  const Redis = redis('Redis', { region: 'europe-west4-drams3a' });
  Redis.deploy = {
    startCommand:
      '/bin/sh -c "rm -rf $RAILWAY_VOLUME_MOUNT_PATH/lost+found/ && exec docker-entrypoint.sh redis-server --requirepass $REDIS_PASSWORD --save 60 1 --dir $RAILWAY_VOLUME_MOUNT_PATH --appendonly yes --appendfsync everysec"',
  };
  Redis.networking = { privateNetworkEndpoint: 'redis' };
  // `postgres()` takes no image and defaults to a newer major than the one the data volume was
  // initialised by, so the database is declared through `database()` with the live image.
  const Postgres = database('Postgres', 'postgres', {
    image: 'ghcr.io/railwayapp-templates/postgres-ssl:17',
    output: 'DATABASE_URL',
    defaultMountPath: '/var/lib/postgresql/data',
    region: 'europe-west4-drams3a',
  });
  // `null` deletes the public TCP proxy: leaving `tcpProxies` out only stops managing it, and the
  // proxy that exists in Railway stays.
  Postgres.networking = { privateNetworkEndpoint: 'postgres', tcpProxies: { '5432': null } };
  const redisVolume = volume('redis-volume', {
    alerts: { usage: { '100': {}, '80': {}, '95': {} } },
    allowOnlineResize: true,
    region: 'europe-west4-drams3a',
    sizeMB: 5000,
  });
  const postgresVolume = volume('postgres-volume', {
    alerts: { usage: { '100': {}, '80': {}, '95': {} } },
    allowOnlineResize: true,
    region: 'europe-west4-drams3a',
    sizeMB: 5000,
  });
  const backendAuth = service(SERVICE.AUTH, {
    source: base,
    build: {
      builder: 'DOCKERFILE',
      dockerfilePath: 'backend/apps/auth/Dockerfile',
      watchPatterns: ['backend/apps/auth/**', 'backend/packages/**', 'packages/**'],
    },
    deploy: { restartPolicyType: 'ON_FAILURE', restartPolicyMaxRetries: 3 },
    replicas: { 'europe-west4-drams3a': 1 },
    networking: { privateNetworkEndpoint: SERVICE.AUTH },
    env: {
      ACCESS_JWT_SECRET: preserve(),
      ADMIN_EMAIL: preserve(),
      ADMIN_PASSWORD: preserve(),
      AUTH_GRPC_URL: bindGrpcUrl,
      CACHE_DRIVER: preserve(),
      DATABASE_URL: Postgres.env.DATABASE_URL,
      JWT_ACCESS_PRIVATE_KEY_BASE64: preserve(),
      JWT_ACCESS_PUBLIC_KEY_BASE64: preserve(),
      NODE_ENV: 'production',
      PORT: '10000',
      REDIS_IP_FAMILY: '0',
      REDIS_URL: Redis.env.REDIS_URL,
      REFRESH_JWT_SECRET: preserve(),
      TEMP_TOKEN_EXPIRES_IN_MINUTES: preserve(),
    },
  });
  const frontendAdmin = service(SERVICE.ADMIN, {
    source: base,
    build: {
      builder: 'DOCKERFILE',
      dockerfilePath: 'frontend/apps/admin/Dockerfile',
      watchPatterns: ['frontend/apps/admin/**', 'frontend/packages/**', 'packages/**'],
    },
    deploy: { restartPolicyType: 'ON_FAILURE', restartPolicyMaxRetries: 3 },
    replicas: { 'europe-west4-drams3a': 1 },
    networking: { privateNetworkEndpoint: SERVICE.ADMIN },
    env: { BACKEND_GRPC_URL: privateGrpcUrl(SERVICE.API_GATEWAY), NODE_ENV: 'production', PORT: '10000' },
  });
  const backendApiGateway = service(SERVICE.API_GATEWAY, {
    source: base,
    build: {
      builder: 'DOCKERFILE',
      dockerfilePath: 'backend/apps/api-gateway/Dockerfile',
      watchPatterns: ['backend/apps/api-gateway/**', 'backend/packages/**', 'packages/**'],
    },
    deploy: { restartPolicyType: 'ON_FAILURE', restartPolicyMaxRetries: 3 },
    replicas: { 'europe-west4-drams3a': 1 },
    networking: { privateNetworkEndpoint: SERVICE.API_GATEWAY },
    env: {
      API_GATEWAY_GRPC_URL: bindGrpcUrl,
      AUTH_GRPC_URL: privateGrpcUrl(SERVICE.AUTH),
      CACHE_DRIVER: preserve(),
      JWT_ACCESS_PUBLIC_KEY_BASE64: preserve(),
      NODE_ENV: 'production',
      PORT: '10000',
      REDIS_IP_FAMILY: '0',
      REDIS_URL: Redis.env.REDIS_URL,
      STORAGE_GRPC_URL: privateGrpcUrl(SERVICE.STORAGE),
    },
  });
  const backendStorage = service(SERVICE.STORAGE, {
    source: base,
    build: {
      builder: 'DOCKERFILE',
      dockerfilePath: 'backend/apps/storage/Dockerfile',
      watchPatterns: ['backend/apps/storage/**', 'backend/packages/**', 'packages/**'],
    },
    deploy: { restartPolicyType: 'ON_FAILURE', restartPolicyMaxRetries: 3 },
    replicas: { 'europe-west4-drams3a': 1 },
    networking: { privateNetworkEndpoint: SERVICE.STORAGE },
    env: {
      AUTH_GRPC_URL: privateGrpcUrl(SERVICE.AUTH),
      BUNNY_STORAGE_API_KEY: preserve(),
      BUNNY_STORAGE_CDN_EXPIRES_IN_MINUTES: preserve(),
      BUNNY_STORAGE_CDN_PRIVATE_KEY: preserve(),
      BUNNY_STORAGE_CDN_ZONE: preserve(),
      BUNNY_STORAGE_S3_REGION: preserve(),
      BUNNY_STORAGE_ZONE: preserve(),
      BUNNY_STREAM_API_KEY: preserve(),
      BUNNY_STREAM_CDN_EXPIRES_IN_MINUTES: preserve(),
      BUNNY_STREAM_CDN_PRIVATE_KEY: preserve(),
      BUNNY_STREAM_CDN_ZONE: preserve(),
      BUNNY_STREAM_LIBRARY_ID: preserve(),
      BUNNY_STREAM_READ_ONLY_API_KEY: preserve(),
      DATABASE_URL: Postgres.env.DATABASE_URL,
      NODE_ENV: 'production',
      PORT: '10000',
      REDIS_IP_FAMILY: '0',
      REDIS_URL: Redis.env.REDIS_URL,
      STORAGE_GRPC_URL: bindGrpcUrl,
    },
  });
  const frontend = group('frontend', [frontendAdmin]);
  const backend = group('backend', [backendAuth, backendApiGateway, backendStorage]);

  return project('base', {
    resources: [Redis, Postgres, redisVolume, postgresVolume, frontend, backend],
  });
});
