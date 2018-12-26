![Status][status-image]
[![Travis][travis-image]][travis-link]
[![Gitter][gitter-image]][gitter-link]
[![GitHub][github-image]][github-link]

  [status-image]: https://img.shields.io/badge/status-deprecated-red.svg
  [travis-image]: https://travis-ci.org/squidfunk/terraform-aws-github-ci.svg?branch=master
  [travis-link]: https://travis-ci.org/squidfunk/terraform-aws-github-ci
  [gitter-image]: https://badges.gitter.im/squidfunk/terraform-aws-github-ci.svg
  [gitter-link]: https://gitter.im/squidfunk/terraform-aws-github-ci
  [github-image]: https://img.shields.io/github/release/squidfunk/terraform-aws-github-ci.svg
  [github-link]: https://github.com/squidfunk/terraform-aws-github-ci/releases

# Terraform AWS GitHub CI

> This project has been deprecated, as AWS CodeBuild now natively supports
> automatic builds on new commits and reports status back to GitHub. However,
> it may serve as a template for anyone trying to get AWS CodeBuild working.

A Terraform module to setup a serverless GitHub CI build environment with pull
request and build status support using AWS CodeBuild.

## Usage

You need an AWS and GitHub account and a repository you want to be built. The
repository must specify a `buildspec.yml` which is documented [here][2]. First,
you need to go to the [CodeBuild][3] dashboard in your region, manually create
a new project and choose GitHub as the **Source provider**, allowing AWS to
authorize your account. Next, [set up your AWS credentials][4] and
[install Terraform][5] if you haven't got it available already.

  [2]: http://docs.aws.amazon.com/codebuild/latest/userguide/build-spec-ref.htm
  [3]: https://console.aws.amazon.com/codebuild/home
  [4]: http://docs.aws.amazon.com/de_de/cli/latest/userguide/cli-chap-getting-started.html
  [5]: https://www.terraform.io/downloads.html

Next, add the following module to your Terraform configuration and apply it:

``` hcl
module "github_ci" {
  source  = "github.com/squidfunk/terraform-aws-github-ci"
  version = "1.0.0"

  namespace          = "<namespace>"
  github_owner       = "<owner>"
  github_repository  = "<repository>"
  github_oauth_token = "<oauth-token>"
}
```

All resources are prefixed with the value specified as `namespace`. If the S3
bucket name (see below) is not explicitly set, it's set to the given `namespace`
which means there must not already exist an S3 bucket with the same name. This
is a common source of error.

Now, when you push to `master`, or create a pull request, CodeBuild will
automatically build the commit and report the status back to GitHub. A status
badge can be added to your project's README using the `codebuild_badge_url` and
`codebuild_url` outputs printed to the terminal.

**Note**: the OAuth-token is currently mandatory (also for public repositories),
because Terraform doesn't support conditional blocks inside resources. However,
this feature is currently [being implemented][6] and should be released shortly.
If you want to omit it, create your own CodeBuild project [see below][7].

  [6]: https://github.com/hashicorp/terraform/issues/7034

## Configuration

The following variables can be configured:

### Required

#### `namespace`

- **Description**: AWS resource namespace/prefix (lowercase alphanumeric)
- **Default**: `none`

#### `github_owner`

- **Description**: GitHub repository owner
- **Default**: `none`

#### `github_repository`

- **Description**: GitHub repository name
- **Default**: `none`

#### `github_oauth_token`

- **Description**: GitHub OAuth token for repository access
- **Default**: `none`

### Optional

#### `codebuild_compute_type`

- **Description**: Compute resources used by the build
- **Default**: `"BUILD_GENERAL1_SMALL"`

#### `codebuild_image`

- **Description**: Base image for provisioning (AWS Registry, Docker)
- **Default**: `"aws/codebuild/ubuntu-base:14.04"`

#### `codebuild_buildspec`

- **Description**: Build specification file location ([file format][2])
- **Default**: `"buildspec.yml"` (at repository root)

#### `codebuild_privileged_mode`

- **Description**: If set to true, enables running the Docker daemon inside a
                   Docker container.
- **Default**: `false`

#### `codebuild_bucket`

- **Description**: S3 bucket to store status badge and artifacts
- **Default**: `"${var.namespace}"` (equal to namespace)

#### `codebuild_environment_variables`

- **Description**: CodeBuild environment variables
- **Default**: []

#### `codebuild_badge_enabled`

- **Description**: Generates a publicly-accessible URL for the projects build
                   badge
- **Default**: `true`

### Outputs

The following outputs are exported:

#### `codebuild_service_role_name`

- **Description**: CodeBuild service role name

#### `codebuild_service_role_arn`

- **Description**: CodeBuild service role ARN

#### `codebuild_bucket`

- **Description**: CodeBuild artifacts bucket name

#### `codebuild_badge_url`

- **Description**: CodeBuild status badge URL

#### `codebuild_url`

- **Description**: CodeBuild project URL

## Limitations

This module first integrated with AWS CodePipeline but switched to CodeBuild,
because the former is heavily opinionated in terms of configuration and much,
much slower. For this reason, the deployment of your build artifacts must be
handled by another module which can be triggered when the build artifacts are
written to S3, most likely by [using a Lambda function][8].

  [8]: http://docs.aws.amazon.com/lambda/latest/dg/with-s3-example.html

## License

**MIT License**

Copyright (c) 2017-2018 Martin Donath

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to
deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
IN THE SOFTWARE.
