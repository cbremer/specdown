# Sign-In Flow

Sequence diagrams stay readable on a phone — tap to open fullscreen and pinch to zoom.

```mermaid
sequenceDiagram
    actor U as User
    participant A as App
    participant S as Server
    U->>A: Sign in
    A->>S: Authorize
    S-->>A: Code
    A->>S: Exchange code
    S-->>A: Token
    A-->>U: Welcome back!
```
