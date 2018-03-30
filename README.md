[![Travis][travis-image]][travis-link]
[![Gitter][gitter-image]][gitter-link]
[![GitHub][github-image]][github-link]

  [travis-image]: https://travis-ci.org/squidfunk/terraform-aws-github-ci.svg?branch=master
  [travis-link]: https://travis-ci.org/squidfunk/terraform-aws-github-ci
  [gitter-image]: https://badges.gitter.im/squidfunk/terraform-aws-github-ci.svg
  [gitter-link]: https://gitter.im/squidfunk/terraform-aws-github-ci
  [github-image]: https://img.shields.io/github/release/squidfunk/terraform-aws-github-ci.svg
  [github-link]: https://github.com/squidfunk/terraform-aws-github-ci/releases

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

### Cost

Building with this CI server is unbelievably cheap - you only pay what you use.
Pricings starts at 0,5 ct per build minute, and AWS CodeBuild offers 100 free
build minutes every month. The price for the other services (Lambda, SNS, S3
and CloudWatch) are negligible and should only add a few cents to your monthly
bill. Compare that to the $69 that services like Travis cost every month,
regardless of how much you use them.

## Usage

### Standalone

You need an AWS and GitHub account and a repository you want to be built. The
repository must specify a `buildspec.yml` which is documented [here][2]. If you
want to get started straight away and have no experience in Terraform, just
[set up your AWS credentials][3], [install Terraform][4], clone the repository
and apply the configuration from the root folder with:

``` bash
terraform apply \
  -var github_owner=<owner> \
  -var github_repository=<repository> \
  -var github_oauth_token=<oauth-token>
```

Now, when you push to `master`, or create a pull request, CodeBuild will
automatically build the commit and report the status back to GitHub.

### Module

Include and configure this module in your Terraform configuration:

``` hcl
module "github_ci" {
  source  = "github.com/squidfunk/terraform-aws-github-ci"
  version = "0.3.0"

  github_owner       = "<owner>"
  github_repository  = "<repository>"
  github_oauth_token = "<oauth-token>"
}
```

All resources (including the S3 bucket) are created through this module. After
applying your configuration, a status badge can be added to your project's
README using the `codebuild_badge_url` and `codebuild_url` outputs printed to
the terminal.

**Note**: the OAuth-token is currently mandatory, because Terraform doesn't
support conditional blocks inside resources. However, this feature is currently
[being implemented][5] and should be released shortly.

  [2]: http://docs.aws.amazon.com/codebuild/latest/userguide/build-spec-ref.htm
  [3]: http://docs.aws.amazon.com/de_de/cli/latest/userguide/cli-chap-getting-started.html
  [4]: https://www.terraform.io/downloads.html
  [5]: https://github.com/hashicorp/terraform/issues/7034

## Configuration

The following variables can be configured:

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

### Optional

#### `github_reporter`

- **Description**: GitHub commit status reporter
- **Default**: `"AWS CodeBuild"`

#### `codebuild_project`

- **Description**: CodeBuild project name (won't create [default project][6])
- **Default**: `""`
- **Conflicts with**: `codebuild_compute_type`, `codebuild_image`

  [6]: #default-project

#### `codebuild_compute_type`

- **Description**: Compute resources used by the build
- **Default**: `"BUILD_GENERAL1_SMALL"`
- **Conflicts with**: `codebuild_project`

#### `codebuild_image`

- **Description**: Base image for provisioning (AWS Registry, Docker)
- **Default**: `"aws/codebuild/ubuntu-base:14.04"`
- **Conflicts with**: `codebuild_project`

#### `codebuild_bucket`

- **Description**: S3 bucket to store status badge and artifacts
- **Default**: `"github-ci"` (equal to namespace)

#### `namespace`

- **Description**: AWS resource namespace/prefix
- **Default**: `"github-ci"`

### Default project

If you need more control over the CodeBuild project, you can pass the name of
an external CodeBuild project in this variable. This will avoid the creation
of the default project which has the following configuration:

``` hcl
resource "aws_codebuild_project" "codebuild" {
  name = "${var.github_repository}"

  build_timeout = "5"
  service_role  = "${aws_iam_role.codebuild.arn}"

  source {
    type     = "GITHUB"
    location = "..."

    auth {
      type     = "OAUTH"
      resource = "${var.github_oauth_token}"
    }
  }

  environment {
    compute_type = "${var.codebuild_compute_type}"
    type         = "LINUX_CONTAINER"
    image        = "${var.codebuild_image}"
  }

  artifacts {
    type           = "S3"
    location       = "${var.codebuild_bucket}"
    name           = "${var.github_repository}"
    namespace_type = "BUILD_ID"
    packaging      = "ZIP"
  }
}
```

The corresponding service role and the bucket are always created and exported
as `codebuild_service_role_arn`, `codebuild_service_role_name` and
`codebuild_bucket`. You can reference them in your CodeBuild resource
definition, e.g. to attach further policies, and thus avoid the creation of
your own service role and bucket.

## Limitations

This module first integrated with AWS CodePipeline but switched to CodeBuild,
because the former is heavily opinionated in terms of configuration and much,
much slower. For this reason, the deployment of your build artifacts must be
handled by another module which can be triggered when the build artifacts are
written to S3, most likely by [using a Lambda function][7].

  [7]: http://docs.aws.amazon.com/lambda/latest/dg/with-s3-example.html

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
