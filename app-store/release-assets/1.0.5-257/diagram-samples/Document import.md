# Document import

```mermaid
flowchart TD
%% specdown:brand
    A[Open File] --> B{Document type}
    B -->|Word| C[Read text]
    B -->|PDF| D[Read or scan]
    C --> E[Edit Markdown]
    D --> E
    E --> F[Save a copy]
```

```mermaid
flowchart LR
%% specdown:brand
    Open --> Edit --> Save
```
