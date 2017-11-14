[![Travis][travis-image]][travis-link]
[![Gitter][gitter-image]][gitter-link]

  [travis-image]: https://travis-ci.org/squidfunk/terraform-aws-github-ci.svg?branch=master
  [travis-link]: https://travis-ci.org/squidfunk/terraform-aws-github-ci
  [gitter-image]: https://badges.gitter.im/squidfunk/terraform-aws-github-ci.svg
  [gitter-link]: https://gitter.im/squidfunk/terraform-aws-github-ci

# Terraform AWS GitHub CI

A Terraform module to setup a GitHub CI server with pull request and build
status support using AWS CodeBuild.

## Architecture

![Architecture][1]

  [1]: assets/architecture.png

This module registers a GitHub webhook which is triggered for `push` and
`pull_request` events and starts the build for the respective branch. All
builds run in parallel. The build progress and status for a respective commit
is reported back to GitHub. Furthermore, a badge for the status of `master` is
generated and hosted on S3.

## Usage

Include and configure this module in your Terraform configuration:

``` hcl
module "github_ci" {
  source = "git::https://github.com/squidfunk/terraform-aws-github-ci.git"

  github_owner       = "<owner>"
  github_repository  = "<repository>"
  github_oauth_token = "<oauth-token>"
  codebuild_bucket   = "<bucket-name>"
}
```

After applying your configuration, a status badge can be added to your project's
README using the `codebuild_badge` and `codebuild_url` outputs printed to the
terminal.

**Note**: the OAuth-token is currently mandatory, because Terraform doesn't
support conditional blocks inside resources. However, this feature is currently
[being implemented][2] and should be released shortly.

  [2]: https://github.com/hashicorp/terraform/issues/7034

## Configuration

The following parameters can be configured:

### Required

#### `github_owner`

- **Description**: GitHub repository owner
- **Default**: `none`

#### `github_repository`

- **Description**: GitHub repository name
- **Default**: `none`

#### `github_oauth_token`

- **Description**: GitHub OAuth token for repository access
- **Default**: `none`

#### `codebuild_bucket`

- **Description**: S3 bucket to store status badge and artifacts
- **Default**: `none`

### Optional

#### `github_reporter`

- **Description**: GitHub commit status reporter
- **Default**: `"AWS CodeBuild"`

#### `codebuild_compute_type`

- **Description**: Compute resources used by the build
- **Default**: `"BUILD_GENERAL1_SMALL"`

#### `codebuild_image`

- **Description**: Base image for provisioning (AWS Registry, Docker)
- **Default**: `"aws/codebuild/ubuntu-base:14.04"`

#### `namespace`

- **Description**: AWS resource namespace/prefix
- **Default**: `"github-ci"`

## Design

This module first integrated with AWS CodePipeline but switched to CodeBuild,
because the former is heavily opinionated in terms of configuraiton and much,
much slower. For this reason, the deployment of your build artifacts must be
handled by another module which can be triggered when the build artifacts are
written to S3.

## License

**MIT License**

Copyright (c) 2017 Martin Donath

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
