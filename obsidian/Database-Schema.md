---
tags: [database, schema, postgresql, models]
---

# Database Schema

## Tables

### tenants

| Column     | Type      | Notes                  |
| ---------- | --------- | ---------------------- |
| id         | UUID PK   | auto-generated         |
| name       | VARCHAR   | tenant display name    |
| created_at | TIMESTAMP | UTC                    |

### users

| Column       | Type      | Notes                       |
| ------------ | --------- | --------------------------- |
| id           | UUID PK   |                             |
| tenant_id    | UUID FK   | references tenants.id       |
| email        | VARCHAR   | unique                      |
| full_name    | VARCHAR   |                             |
| hashed_password | VARCHAR | bcrypt                   |
| created_at   | TIMESTAMP |                             |

### api_keys

| Column        | Type      | Notes                        |
| ------------- | --------- | ---------------------------- |
| id            | UUID PK   |                              |
| tenant_id     | UUID FK   |                              |
| provider      | VARCHAR   | virustotal/abuseipdb/shodan/otx |
| encrypted_key | TEXT    | Fernet encrypted             |
| status        | VARCHAR   | pending/valid/invalid        |
| updated_at    | TIMESTAMP |                              |

### analyses

| Column       | Type      | Notes                        |
| ------------ | --------- | ---------------------------- |
| id           | UUID PK   |                              |
| tenant_id    | UUID FK   |                              |
| user_id      | UUID FK   |                              |
| ioc_value    | VARCHAR   | raw IOC                      |
| ioc_type     | VARCHAR   | ip/domain/url/hash           |
| score        | INTEGER   | 0-100 aggregate              |
| severity     | VARCHAR   | LOW/MEDIUM/HIGH/CRITICAL     |
| results_json | JSONB     | per-source results           |
| created_at   | TIMESTAMP |                              |

### batch_jobs

| Column      | Type      | Notes                        |
| ----------- | --------- | ---------------------------- |
| id          | UUID PK   |                              |
| tenant_id   | UUID FK   |                              |
| filename    | VARCHAR   |                              |
| total_iocs  | INTEGER   |                              |
| processed   | INTEGER   |                              |
| status      | VARCHAR   | pending/running/done/error     |
| created_at  | TIMESTAMP |                              |
| source_text | TEXT      | uploaded file contents (MVP) |

## Indexes

- `analyses(tenant_id, created_at)` — dashboard queries
- `analyses(tenant_id, ioc_value)` — history
- `api_keys(tenant_id, provider)` — key lookup

## Related Notes

- [[Architecture]]
- [[Auth-Flow]]
