# Job client contract

## Retry policy

The client **retries twice** after a timeout. It uses the original job identifier for both retries.

## Permission errors

The client must report a permission error immediately. It must never retry a denied request.

```js
function shouldRetry(error, attempts) {
  return error === 'timeout' && attempts < 2;
}
```

## Worker lifecycle

```mermaid
sequenceDiagram
    participant C as Client
    participant A as API
    participant W as Worker
    C->>A: Submit job
    A->>W: Run job
    alt Job completes
        W-->>A: Result
        A-->>C: Success
        A->>A: Record outcome
    else Worker times out
        A->>W: Cancel job
        A-->>C: Timeout response
        A->>A: Record outcome
    end
```
