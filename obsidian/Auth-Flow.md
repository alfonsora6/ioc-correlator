---
tags: [auth, jwt, security, multitenancy]
---

# Auth Flow

## Register Sequence

```mermaid
sequenceDiagram
  User->>Frontend: Fill register form (email, password, name, tenant)
  Frontend->>Backend: POST /api/v1/auth/register
  Backend->>DB: Check email not taken
  Backend->>DB: Create tenant record
  Backend->>DB: Create user record (bcrypt hash)
  Backend->>Frontend: Return JWT access_token + set refresh httpOnly cookie
  Frontend->>User: Redirect to Dashboard
```

## Login Sequence

```mermaid
sequenceDiagram
  User->>Frontend: Fill login form
  Frontend->>Backend: POST /api/v1/auth/login
  Backend->>DB: Verify email + bcrypt password
  Backend->>Frontend: Return JWT access_token + set refresh httpOnly cookie
  Frontend->>User: Redirect to Dashboard
```

## Token Refresh

- Access token expires in 15 minutes (configurable)
- On 401, frontend calls `POST /api/v1/auth/refresh` using the httpOnly cookie
- Backend validates refresh token row, rotates refresh token, issues a new access token

## Multi-Tenancy

- Every protected query is scoped by `tenant_id` from the authenticated user
- API keys and analyses are isolated per tenant

## Related Notes

- [[Database-Schema]]
- [[Architecture]]
