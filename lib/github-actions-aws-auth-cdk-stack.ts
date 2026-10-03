import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { aws_iam as iam } from 'aws-cdk-lib'

export interface GithubActionsAwsAuthCdkStackProps extends cdk.StackProps {
  readonly repositoryConfig: { owner: string; ownerId: string }[]
}

export class GithubActionsAwsAuthCdkStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: GithubActionsAwsAuthCdkStackProps,
  ) {
    super(scope, id, props)

    validateRepositoryConfig(props.repositoryConfig)

    const githubDomain = 'https://token.actions.githubusercontent.com'

    const githubProvider = new iam.OidcProviderNative(
      this,
      'GithubActionsProvider',
      {
        url: githubDomain,
        clientIds: ['sts.amazonaws.com'],
      },
    )

    const iamRepoDeployAccess = props.repositoryConfig.flatMap(
      ({ owner, ownerId }) => [`repo:${owner}/*`, `repo:${owner}@${ownerId}/*`],
    )

    const conditions: iam.Conditions = {
      StringLike: {
        ['token.actions.githubusercontent.com:sub']: iamRepoDeployAccess,
      },
      StringEquals: {
        ['token.actions.githubusercontent.com:aud']: 'sts.amazonaws.com',
      },
    }

    const role = new iam.Role(this, 'gitHubDeployRole', {
      assumedBy: new iam.WebIdentityPrincipal(
        githubProvider.oidcProviderArn,
        conditions,
      ),
      managedPolicies: [
        /* Demo permissions. Scope to your deployment before production use,
         * including any CDK bootstrap and CloudFormation execution roles. */
        iam.ManagedPolicy.fromAwsManagedPolicyName('PowerUserAccess'),
      ],
      roleName: 'githubActionsDeployRole',
      description:
        'This role is used via GitHub Actions to deploy with AWS CDK or Terraform on the target AWS account',
      maxSessionDuration: cdk.Duration.hours(12),
    })

    new cdk.CfnOutput(this, 'GithubActionOidcIamRoleArn', {
      value: role.roleArn,
      description: `Arn for AWS IAM role with Github oidc auth for ${iamRepoDeployAccess}`,
      exportName: 'GithubActionOidcIamRoleArn',
    })

    cdk.Tags.of(this).add('component', 'CdkGithubActionsOidcIamRole')
  }
}

function validateRepositoryConfig(
  repositoryConfig: GithubActionsAwsAuthCdkStackProps['repositoryConfig'],
): void {
  if (!Array.isArray(repositoryConfig) || repositoryConfig.length === 0) {
    throw new Error('repositoryConfig must contain at least one GitHub owner')
  }
  for (const entry of repositoryConfig) {
    if (
      typeof entry?.owner !== 'string' ||
      !/^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*$/.test(entry.owner) ||
      entry.owner.length > 39
    ) {
      throw new Error(
        'repoOwner must be a valid GitHub owner name, without wildcards or separators',
      )
    }
    if (
      typeof entry.ownerId !== 'string' ||
      !/^[1-9]\d*$/.test(entry.ownerId)
    ) {
      throw new Error(
        'repoOwnerId must be a positive decimal GitHub owner ID string',
      )
    }
  }
}
