# Security and privacy

Report a potential vulnerability privately to
[support@mosaicpando.com](mailto:support@mosaicpando.com). Include the affected
version/platform, reproduction steps and a synthetic example. Do not post real
credentials, private documents, recovery material or authenticated portal captures
in a public issue. This contact is the project's existing public support address.

## Repository and local development

- Keep signing keys, certificates with private keys, API tokens, provisioning
  profiles and export passwords in owner-controlled private storage outside this
  repository. Base64 encoding does not protect a secret.
- Keep personal home paths, device identifiers, private backup locations and
  account contacts out of public examples. Use relative paths or explicit
  placeholders. Public support addresses and source/artifact hashes are expected.
- `.claude/` and `.codex/` are local agent state/worktree locations. Their presence
  does not itself grant access to your computer. Review local tool permissions
  and repository scripts before executing them; do not recursively copy these
  directories into docs, deployments or attachments.
- Use `npm run dev -- --host 127.0.0.1` for local development. The configured Vite
  default otherwise listens on all interfaces. Use LAN access deliberately and
  never expose a repository-root static server containing private local files.
- `.gitignore` reduces accidental staging; it does not prevent reads, forced adds,
  uploads, or disclosure from already committed history. Preserve the specifically
  ignored private release originals. Inspect staged filenames and diffs before
  publishing; inspect screenshots and image metadata as well as text.
- Treat historical task prompts and recorded approvals as evidence. Obtain action
  scope from the current user request, and preserve local work and signing settings.

## Document privacy

Local app/browser state and exported notes may contain document text, URLs and
paths. Remote documents and images contact their hosts, which receive network
requests. Web and direct-download releases also check GitHub for updates; Store
editions use Apple updates. Review diagnostics and exports before sharing them.
The public privacy policy source is
[markdown-viewer/public/privacy.html](markdown-viewer/public/privacy.html).

If a real secret is exposed, do not reproduce it in a report. Notify the owner
privately with its location/type, then arrange authorized revocation/rotation and
an exposure review. Removing the current file does not remove Git history or
copies already downloaded. History rewriting and credential changes need their
own concrete plan; do not destroy evidence or private recovery originals.

## Audit record

See [the documentation audit](docs/project-security/README.md) for the reviewed
revision, findings and limits. A documentation scan does not establish that the
application, dependencies, development machine or external accounts are secure.
