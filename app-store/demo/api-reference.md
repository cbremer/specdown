# API Reference

Tables, code blocks and syntax highlighting — all from plain Markdown.

| Endpoint            | Method | Description       |
| ------------------- | ------ | ----------------- |
| `/v1/projects`      | GET    | List projects     |
| `/v1/projects/{id}` | GET    | Fetch one project |
| `/v1/projects`      | POST   | Create a project  |
| `/v1/tasks/{id}`    | PATCH  | Update a task     |

## Create a project

```js
const res = await fetch('/v1/projects', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Launch', owner: 'team-ios' }),
});
const project = await res.json();
console.log(project.id);
```

> **Tip:** Responses are paginated; follow the `next` link until it is empty.
