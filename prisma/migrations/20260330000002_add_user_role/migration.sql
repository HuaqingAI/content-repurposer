-- Migration: add_user_role
-- Story 6.1: 为 users 表新增 role 字段，支持管理员权限控制

-- 创建 user_role 枚举类型
CREATE TYPE "user_role" AS ENUM ('user', 'admin');

-- 为 users 表添加 role 字段，默认值为 'user'
ALTER TABLE "users" ADD COLUMN "role" "user_role" NOT NULL DEFAULT 'user';
