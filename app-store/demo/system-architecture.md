# System Architecture

How a request travels from the app to storage — rendered live from a Mermaid block.

```mermaid
flowchart TD
    A[Mobile & Desktop Apps] --> B{API Gateway}
    B -->|Auth| C[Identity Service]
    B -->|Read| D[Catalog Service]
    B -->|Write| E[Orders Service]
    D --> F[(Search Index)]
    E --> G[(Orders DB)]
    E --> H[[Event Bus]]
    H --> I[Email Worker]
    H --> J[Analytics]
```

## Notes

- The gateway terminates TLS and routes by path.
- Orders publish events so downstream work never blocks checkout.
