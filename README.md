# GitHub Actions AWS authentication

This CDK application creates a GitHub OIDC provider and IAM role for GitHub Actions to access AWS without stored access keys. Based on the [AWS sample](https://github.com/aws-samples/github-actions-oidc-cdk-construct).

The role trusts all repositories, branches, and environments under each configured GitHub owner.

`PowerUserAccess` is a demo default and excludes most IAM operations. For production, scope repository trust and deployment permissions, including any assumed CDK roles.

## Requirements

- Node.js 24 and npm.
- AWS CLI credentials with permission to bootstrap CDK and create IAM resources in the target account.
- No existing GitHub OIDC provider in the target AWS account; importing providers or migrating existing stacks is not supported.

## Deploy

```sh
git clone https://github.com/deeheber/github-actions-oidc-cdk-construct.git
cd github-actions-oidc-cdk-construct
npm ci
```

Set your GitHub owner in `cdk.context.json`:

| Field         | Value                                            |
| ------------- | ------------------------------------------------ |
| `repoOwner`   | GitHub user or organization name                 |
| `repoOwnerId` | Numeric GitHub owner ID, stored as a JSON string |
| `awsRegion`   | Optional CloudFormation stack region override    |

Find the user or organization ID with GitHub CLI:

```sh
gh api users/YOUR-OWNER --jq .id
```

Or use the `id` field at `https://api.github.com/users/YOUR-OWNER`. Use the owner's ID, not the repository ID.

Select your AWS profile and region, then check the target account:

```sh
export AWS_PROFILE=your-profile
export AWS_REGION=your-region
aws sts get-caller-identity
```

Build, bootstrap, inspect, and deploy:

```sh
npm run build
npm test
npm run cdk -- bootstrap
npm run cdk -- synth
npm run cdk -- diff
npm run cdk -- deploy
```

Deploy once per AWS account. IAM resources are global; CloudFormation and CDK bootstrap resources use the selected region. Keep that region for future updates. The `awsRegion` context value takes precedence.

Deployment outputs the role ARN as `GithubActionOidcIamRoleArn`.

## Use from GitHub Actions

1. In a repository under the configured owner, create a GitHub environment named `dev`.
2. Add an environment secret named `AWS_ROLE_TO_ASSUME` containing the output role ARN.
3. Use [the example workflow](.github/workflows/assume-role-test.yml), adjusting its AWS region if needed.
4. Run **Assume Role and Run AWS STS Get Caller Identity** from the Actions tab.

The workflow prints the assumed AWS identity to verify authentication, not deployment permissions.

The trust policy accepts legacy and immutable subjects:

```text
repo:OWNER/*
repo:OWNER@OWNER_ID/*
```

Legacy subjects trust owners by name. See [GitHub's OIDC reference](https://docs.github.com/en/actions/reference/security/oidc#immutable-subject-claims) for immutable subjects. Custom subject templates are not covered.

## Development

- `npm run build`: compile and type-check with TypeScript.
- `npm run watch`: compile on changes.
- `npm test`: run Vitest once.
- `npm run test:watch`: rerun tests on changes.
- `npm run format:check`: check formatting without edits.
- `npm run format`: apply formatting.

See [CONTRIBUTING.md](CONTRIBUTING.md) and [LICENSE](LICENSE).
