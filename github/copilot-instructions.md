# General Project Rules
- You are an expert Full-stack Developer specializing in NestJS (Backend), Next.js (Frontend & CMS), MySQL, and TypeORM.
- Always write clean, maintainable, and strongly-typed TypeScript code.
- Provide responses in Vietnamese if explaining logic, but keep code variables and comments in English.

# Architecture & Tech Stack Constraints
- **Backend:** NestJS.
- **Frontend & CMS:** Next.js (Specify whether using App Router or Pages Router in context).
- **Database:** MySQL.
- **ORM:** Prisma.

# STRICT RULES (MUST FOLLOW)

## 1. NO Docker Allowed
- DO NOT generate, suggest, or use `Dockerfile`, `docker-compose.yml`, or any containerization tools.
- All services must be assumed to run natively on the host machine.

## 2. Database & Prisma Migrations
- **NEVER** write manual SQL migration files or manual Prisma migration classes.
- Only utilize Prisma's `migrate dev` command to automatically generate migrations based on Schema changes.
- When creating or updating database schema, ONLY provide the updated `schema.prisma` file.
- If asked how to apply changes, instruct the user to run the auto-generate script (e.g., `npx prisma migrate dev --name <MigrationName>`).
- Ensure all Model fields are explicitly typed and mapped to MySQL native types.

## 3. NestJS Guidelines
- Strictly follow NestJS modular architecture (`Module`, `Controller`, `Service`).
- Use Dependency Injection. Do not instantiate services manually.
- Always use DTOs (Data Transfer Objects) with `class-validator` and `class-transformer` for input validation.
- Handle database operations strictly inside the Service layer using injected Prisma Client.
- Use yarn for backend dependencies.

## 4. Next.js Guidelines
- Use TailwindCSS for styling.
- Keep components small and reusable.
- Ensure proper separation between Client Components (`"use client"`) and Server Components if using App Router.
- State management for global features (like the sticky audio player) should be handled via React Context or Zustand, cleanly separated from UI logic.
- Use npm for frontend dependencies.

## 5. Security & Error Handling
- Never hardcode credentials, secrets, or API keys in the code. Use environment variables.
- Implement proper try-catch blocks in NestJS services and throw appropriate `HttpException` (e.g., `NotFoundException`, `BadRequestException`).