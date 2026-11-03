const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const yaml = require('js-yaml');

const root = path.resolve(__dirname, '../..');
const config = yaml.load(
  fs.readFileSync(
    path.join(root, '.github/workflows/credential-validation.yml'),
    'utf8'
  )
);

describe('protected credential validation workflow', () => {
  it('is manual, main-only and read-only with explicit checks', () => {
    expect(Object.keys(config.on)).toEqual(['workflow_dispatch']);
    expect(
      config.on.workflow_dispatch.inputs['verify-scope-only']
    ).toMatchObject({ type: 'boolean', default: false });
    expect(
      config.on.workflow_dispatch.inputs['require-environment-only']
    ).toMatchObject({ type: 'boolean', default: true });
    expect(
      config.on.workflow_dispatch.inputs['check-notarization']
    ).toMatchObject({ type: 'boolean', default: false });
    expect(config.permissions).toEqual({ contents: 'read' });
    expect(Object.keys(config.jobs)).toEqual(['preflight', 'credentials']);
    for (const job of Object.values(config.jobs)) {
      expect(job.if).toContain("github.ref == 'refs/heads/main'");
      expect(job['timeout-minutes']).toBeLessThanOrEqual(10);
      expect(Object.values(job.permissions || {})).not.toContain('write');
      const checkout = job.steps.find((step) =>
        step.uses?.startsWith('actions/checkout@')
      );
      expect(checkout.uses).toBe(
        'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1'
      );
      expect(checkout.with).toEqual({
        ref: '${{ github.sha }}',
        'persist-credentials': false,
      });
    }
  });

  it('gates all real credentials and exposes only availability booleans to preflight', () => {
    const { preflight, credentials } = config.jobs;
    expect(preflight.if).toBe("github.ref == 'refs/heads/main'");
    expect(credentials.if).toBe(
      "github.ref == 'refs/heads/main' && !inputs.verify-scope-only"
    );
    expect(preflight.environment).toBeUndefined();
    expect(
      preflight.steps.some(
        (step) =>
          step.run ===
          'node scripts/verify-release-environment.js desktop-release repository-owner'
      )
    ).toBe(true);
    const scope = preflight.steps.find((step) =>
      step.run?.endsWith('--scope-only')
    );
    const names = [
      'MAC_CERT_P12',
      'MAC_CERT_PASSWORD',
      'APPLE_ID',
      'APPLE_APP_SPECIFIC_PASSWORD',
      'APPLE_TEAM_ID',
    ];
    for (const name of names)
      expect(scope.env['HAS_' + name]).toBe(`\${{ secrets.${name} != '' }}`);
    expect(Object.keys(scope.env)).toHaveLength(6);
    expect(credentials.needs).toBe('preflight');
    expect(credentials.environment).toBe('desktop-release');
    expect(credentials['runs-on']).toBe('macos-latest');
    const validation = credentials.steps.find(
      (step) => step.run === 'python3 scripts/validate-desktop-credentials.py'
    );
    for (const name of names)
      expect(validation.env[name]).toBe(`\${{ secrets.${name} }}`);
    expect(validation.env.CHECK_NOTARIZATION).toBe(
      '${{ inputs.check-notarization }}'
    );
    expect(Object.keys(validation.env)).toHaveLength(6);
    const source = JSON.stringify(config);
    expect(source).not.toMatch(
      /upload-artifact|desktop:build|npm ci|release upload|release edit|pending_deployments|ADMIN_PAT/
    );
  });

  it('passes synthetic input, key binding, failure, cleanup and redaction checks', () => {
    const executable = process.platform === 'win32' ? 'python' : 'python3';
    const result = spawnSync(
      executable,
      ['-B', path.join(root, 'scripts/test-desktop-credentials.py')],
      {
        cwd: root,
        encoding: 'utf8',
        timeout: 30000,
        maxBuffer: 1024 * 1024,
      }
    );
    if (result.status !== 0)
      throw new Error(
        result.stderr ||
          result.error?.message ||
          'Synthetic credential checks failed'
      );
    expect(result.status).toBe(0);
    expect(result.stderr).toContain('OK');
  });
});
