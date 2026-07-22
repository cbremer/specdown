# Diagram Showcase

A test document packed with **every major Mermaid diagram type** — handy for
exercising SpecDown's diagram features: inline diagrams that expand into a
fullscreen explorer with zoom/pan, minimap, SVG/PNG export, and share links,
plus theme re-rendering and **presentation mode** (hit *Present* and step
through with `←` / `→`).

Between the diagrams there's ordinary markdown — headings for the table of
contents, a table, and a code block — so this file also works as a general
smoke-test document.

---

## 1. Flowchart — system architecture

The classic. Expand it to zoom, pan, and explore.

```mermaid
graph TD
    U[User] -->|HTTPS| LB[Load Balancer]
    LB --> A[App Server 1]
    LB --> B[App Server 2]
    A --> C{Cache hit?}
    B --> C
    C -->|yes| R[(Redis)]
    C -->|no| DB[(PostgreSQL)]
    DB --> Q[Job Queue]
    Q --> W1[Worker]
    Q --> W2[Worker]
    W1 --> S3[Object Storage]
    W2 --> S3
    A -.->|metrics| M[Prometheus]
    B -.->|metrics| M
    M --> G[Grafana]
```

## 2. Sequence diagram — auth flow

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant App as SpecDown
    participant API as Auth API
    participant IdP as Identity Provider

    U->>App: Click "Sign in"
    App->>API: /authorize
    API->>IdP: Redirect (OIDC)
    IdP-->>U: Login prompt
    U->>IdP: Credentials + MFA
    IdP-->>API: Authorization code
    API-->>App: Access + refresh tokens
    App-->>U: Signed in
    Note over App,API: Tokens rotate silently<br/>every 15 minutes
```

## 3. Class diagram — viewer internals

```mermaid
classDiagram
    class Tab {
        +int id
        +string filename
        +string filePath
        +bool watching
        +open()
        +close()
    }
    class Workspace {
        +string root
        +WorkspaceFile[] files
        +scan()
    }
    class DiagramSlide {
        +SVGElement svg
        +zoomIn()
        +zoomOut()
    }
    class Presenter {
        +int slideIndex
        +next()
        +prev()
    }
    Workspace "1" --> "*" Tab : opens
    Presenter "1" --> "*" DiagramSlide : steps through
    Tab --> DiagramSlide : renders
```

## 4. State diagram — live reload chip

The actual state machine behind the "Live" chip next to the filename.

```mermaid
stateDiagram-v2
    [*] --> Live : file-backed tab opened
    Live --> Paused : click chip
    Paused --> Live : click chip
    Live --> Updated : file changed on disk
    Updated --> Live : after 1.2s flash
    Paused --> Live : Reload from disk
    Live --> [*] : tab closed
```

## 5. Entity relationship — content model

```mermaid
erDiagram
    DOCUMENT ||--o{ HEADING : contains
    DOCUMENT ||--o{ DIAGRAM : contains
    DOCUMENT ||--o{ ANNOTATION : "annotated by"
    HEADING ||--o{ TOC_ENTRY : generates
    DIAGRAM ||--o| SHARE_LINK : "exported as"
    ANNOTATION {
        string id
        string text
        string anchor
    }
    DIAGRAM {
        string mermaidSource
        string type
    }
```

## 6. Gantt — release timeline

```mermaid
gantt
    title Modernization at a glance
    dateFormat  YYYY-MM-DD
    section Foundations
    Evaluation & roadmap      :done, a1, 2026-06-13, 1d
    Vite + module split       :done, a2, 2026-06-13, 3d
    TypeScript migration      :done, a3, 2026-06-14, 2d
    section Experience
    Design tokens & palette   :done, b1, 2026-06-14, 2d
    Consolidate & harden      :done, b2, 2026-07-14, 2d
    section Shipping
    Update pipeline repair    :done, c1, 2026-07-15, 1d
    Bug-fix wave              :active, c2, 2026-07-18, 2d
    iOS TestFlight            :c3, after c2, 5d
```

## 7. Pie — where the bytes live

```mermaid
pie showData
    title Bundle composition (gzipped)
    "Mermaid (lazy)" : 380
    "App shell" : 92
    "Highlight.js" : 45
    "KaTeX" : 77
    "Everything else" : 60
```

## 8. Git graph — merge discipline

```mermaid
gitGraph
    commit id: "v0.0.165"
    branch claude/fix
    checkout claude/fix
    commit id: "fix: drop paths"
    commit id: "test: regression"
    checkout main
    merge claude/fix id: "rebase-merge"
    commit id: "v0.0.166" tag: "release"
```

## 9. User journey — opening a spec

```mermaid
journey
    title Reading a spec in SpecDown
    section Getting in
      Drag folder onto app: 5: Reader
      Workspace sidebar appears: 5: Reader
    section Reading
      Follow relative links: 4: Reader
      Zoom into architecture diagram: 5: Reader
    section Sharing
      Present diagrams full-screen: 5: Reader, Teammate
      Export slide as PNG: 4: Reader
```

## 10. Mindmap — feature map

```mermaid
mindmap
  root((SpecDown))
    Reading
      Tabs
      TOC
      Search
      Split view
    Diagrams
      Zoom & pan
      Fullscreen + minimap
      Presentation mode
      SVG / PNG export
    Disk
      Live reload
      Reload from disk
      Workspaces
    Review
      Annotations
      Author comments
```

---

## Non-diagram content

A table, for rendering sanity:

| Feature | Surface | Shortcut |
| --- | --- | --- |
| Command palette | All | `Cmd/Ctrl + K` |
| Present diagrams | All | — |
| Live reload | Desktop | chip click |

And a code block, for highlight + copy-button testing:

```javascript
export function hasPresentableDiagrams() {
  // Scoped to the wrapper — the controls' icon SVGs don't count.
  return collectDiagrams().length > 0;
}
```

<!-- This authored HTML comment tests the Comments toggle. -->

*End of showcase — ten diagrams, one of each flavor.*
