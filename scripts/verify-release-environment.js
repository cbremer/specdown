// Fail closed: naming an environment alone does not create an approval boundary.
// Owner approval is an explicit alternative for a user-owned repository. It is
// never inferred from absent reviewers or an inaccessible environment.
async function verifyReleaseEnvironment(name, reviewMode = 'independent') {
  if (!/^[a-z][a-z-]+$/.test(name || ''))
    throw new Error('Invalid environment name');
  if (!['independent', 'repository-owner'].includes(reviewMode))
    throw new Error('Expected independent or repository-owner approval mode');
  const base = process.env.GITHUB_API_URL || 'https://api.github.com';
  const repository = process.env.GITHUB_REPOSITORY;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || ''))
    throw new Error('Invalid repository');
  async function get(path) {
    const response = await fetch(
      `${base}/repos/${repository}${path ? `/${path}` : ''}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.GH_TOKEN}`,
          Accept: 'application/vnd.github+json',
        },
      }
    );
    if (!response.ok)
      throw new Error(
        `Release environment could not be verified (${response.status})`
      );
    return response.json();
  }
  const environment = await get(`environments/${name}`);
  const approvals = environment.protection_rules?.filter(
    (rule) => rule.type === 'required_reviewers'
  );
  const approval = approvals?.length === 1 ? approvals[0] : null;
  if (
    !Array.isArray(approval?.reviewers) ||
    !approval.reviewers.length ||
    environment.can_admins_bypass !== false
  )
    throw new Error('Release requires reviewers and no administrator bypass');
  if (reviewMode === 'independent') {
    if (approval.prevent_self_review !== true)
      throw new Error('Independent release approval must prevent self-review');
  } else {
    const metadata = await get('');
    const owner = metadata.owner;
    const reviewer = approval.reviewers[0];
    // An organization or team cannot stand in for the sole maintainer. Compare
    // stable numeric IDs as well as login/type; never trust a dispatch-supplied
    // reviewer name or an environment label as proof of repository ownership.
    if (
      metadata.full_name?.toLowerCase() !== repository.toLowerCase() ||
      owner?.type !== 'User' ||
      !Number.isSafeInteger(owner.id) ||
      owner.id <= 0 ||
      typeof owner.login !== 'string' ||
      owner.login.toLowerCase() !== repository.split('/')[0].toLowerCase() ||
      approval.reviewers.length !== 1 ||
      reviewer.type !== 'User' ||
      reviewer.reviewer?.type !== 'User' ||
      reviewer.reviewer.id !== owner.id ||
      typeof reviewer.reviewer.login !== 'string' ||
      reviewer.reviewer.login.toLowerCase() !== owner.login.toLowerCase() ||
      approval.prevent_self_review !== false
    )
      throw new Error(
        'Owner approval requires exactly the verified repository owner as reviewer and allows that owner to approve their own dispatch'
      );
  }
  if (environment.deployment_branch_policy?.custom_branch_policies !== true)
    throw new Error('Release environment must allow main only');
  const branches = await get(`environments/${name}/deployment-branch-policies`);
  if (
    branches.total_count !== 1 ||
    !Array.isArray(branches.branch_policies) ||
    branches.branch_policies.length !== 1 ||
    branches.branch_policies[0]?.name !== 'main' ||
    branches.branch_policies[0]?.type !== 'branch'
  )
    throw new Error('Release environment must allow only the main branch');
}
module.exports = { verifyReleaseEnvironment };
if (require.main === module) {
  const reviewMode = process.argv[3] ?? 'independent';
  const run = async () => {
    if (process.argv.length < 3 || process.argv.length > 4)
      throw new Error(
        'Usage: verify-release-environment.js <environment> [independent|repository-owner]'
      );
    await verifyReleaseEnvironment(process.argv[2], reviewMode);
    console.log(`Release approval mode verified: ${reviewMode}`);
  };
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
