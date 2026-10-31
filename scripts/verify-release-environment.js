// Fail closed: naming an environment alone does not create an approval boundary.
async function verifyReleaseEnvironment(name) {
  if (!/^[a-z][a-z-]+$/.test(name || ''))
    throw new Error('Invalid environment name');
  const base = process.env.GITHUB_API_URL || 'https://api.github.com';
  const repository = process.env.GITHUB_REPOSITORY;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || ''))
    throw new Error('Invalid repository');
  async function get(path) {
    const response = await fetch(`${base}/repos/${repository}/${path}`, {
      headers: {
        Authorization: `Bearer ${process.env.GH_TOKEN}`,
        Accept: 'application/vnd.github+json',
      },
    });
    if (!response.ok)
      throw new Error(
        `Release environment could not be verified (${response.status})`
      );
    return response.json();
  }
  const environment = await get(`environments/${name}`);
  const approval = environment.protection_rules?.find(
    (rule) => rule.type === 'required_reviewers'
  );
  if (
    !approval?.reviewers?.length ||
    approval.prevent_self_review !== true ||
    environment.can_admins_bypass !== false
  )
    throw new Error(
      'Release requires independent reviewers, no self-approval and no administrator bypass'
    );
  if (!environment.deployment_branch_policy?.custom_branch_policies)
    throw new Error('Release environment must allow main only');
  const branches = await get(`environments/${name}/deployment-branch-policies`);
  if (
    branches.total_count !== 1 ||
    branches.branch_policies[0]?.name !== 'main' ||
    branches.branch_policies[0]?.type !== 'branch'
  )
    throw new Error('Release environment must allow only the main branch');
}
module.exports = { verifyReleaseEnvironment };
if (require.main === module)
  verifyReleaseEnvironment(process.argv[2]).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
