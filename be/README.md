# Auth Backend Service

A robust authentication and user management microservice built with NestJS and Prisma.

## Tech Stack
- **Framework**: [NestJS](https://nestjs.com/)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Database**: MySQL
- **Authentication**: JWT (Access & Refresh tokens), Passport.js
- **OAuth**: Google OAuth 2.0
- **Security**: Argon2 for password hashing
- **GeoIP**: IP-based country detection

## Features
- **Comprehensive Auth**: Local login/register and Google OAuth integration.
- **Security**: Email verification (Link & Code), Password Reset, JWT rotation.
- **Profile Management**: Display name, avatar updates, and VIP/Premium status tracking.
- **Fine-grained RBAC**: Role-based access control with permissions support.
- **Audit**: Tracking last login and registration country via GeoIP.

## API Endpoints

All endpoints are prefixed with `/auth`.

### 🔑 Authentication & Session
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/login` | Email/Password login. Returns access & refresh tokens. |
| `POST` | `/register` | New user registration. |
| `POST` | `/refresh` | Rotate expired Access Token using Refresh Token. |
| `POST` | `/logout` | Revokes all active sessions. |

### 🌐 Google OAuth
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/google` | Initiates Google OAuth redirection. |
| `GET` | `/google-redirect` | OAuth callback handler. |

### 👤 Profile & User Management
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/me` | Get current user's profile, roles, and permissions. |
| `PATCH` | `/me` | Update display name or avatar. |
| `GET` | `/search-users` | Search users by email (Requires Admin). |

### 🛡️ Verification & Recovery
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/verify-email` | Verify email via token link. |
| `POST` | `/verify-code` | Verify email via 6-digit code. |
| `POST` | `/resend-verify` | Resend verification link. |
| `POST` | `/resend-code` | Resend verification code. |
| `POST` | `/forgot-password` | Request password reset link. |
| `POST` | `/reset-password` | Reset password using token. |

### 💎 Premium Services
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/check-premium` | Query VIP tier and expiration status. |

## Development Setup

1. **Install dependencies**:
   ```bash
   yarn install
   ```

2. **Database Setup**:
   - Configure `.env` with your `DATABASE_URL`.
   - Run migrations: `npx prisma migrate dev`
   - Seed database: `npx prisma db seed`

3. **Run Application**:
   ```bash
   yarn start:dev
   ```

## Prisma Schema
The project uses a custom schema located in `prisma/schema.prisma`. After any changes, remember to run:
```bash
npx prisma generate
```
