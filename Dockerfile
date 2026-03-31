# Stage 1: 安装生产依赖
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Stage 2: 构建
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# 生成 Prisma Client（路径：src/generated/prisma/）
RUN npx prisma generate
# Build-time env vars（dummy values for env validation during next build）
ARG NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG SUPABASE_SERVICE_ROLE_KEY
ARG DATABASE_URL
ARG DEEPSEEK_API_KEY
ARG QWEN_API_KEY
ARG WECHAT_APP_ID
ARG WECHAT_APP_SECRET
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_TELEMETRY_DISABLED=$NEXT_TELEMETRY_DISABLED \
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY \
    DATABASE_URL=$DATABASE_URL \
    DEEPSEEK_API_KEY=$DEEPSEEK_API_KEY \
    QWEN_API_KEY=$QWEN_API_KEY \
    WECHAT_APP_ID=$WECHAT_APP_ID \
    WECHAT_APP_SECRET=$WECHAT_APP_SECRET \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
RUN npm run build

# Stage 3: 生产运行时
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 安装 curl（healthcheck 依赖）
RUN apk add --no-cache curl

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 复制 standalone 产出
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
