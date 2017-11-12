# Copyright (c) 2017 Martin Donath <martin.donath@squidfunk.com>

# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to
# deal in the Software without restriction, including without limitation the
# rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
# sell copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:

# The above copyright notice and this permission notice shall be included in
# all copies or substantial portions of the Software.

# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
# FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
# IN THE SOFTWARE.

provider "aws" {}

provider "github" {
  token        = "${var.github_oauth_token}"
  organization = "${var.github_organization}"
}

# -----------------------------------------------------------------------------
# Data: Credentials
# -----------------------------------------------------------------------------

# data.aws_region._
data "aws_region" "_" {
  current = true
}

# -----------------------------------------------------------------------------
# Data: IAM
# -----------------------------------------------------------------------------

# data.aws_iam_policy_document.codebuild_assume_role.json
data "aws_iam_policy_document" "codebuild_assume_role" {
  statement {
    actions = [
      "sts:AssumeRole",
    ]

    principals {
      type = "Service"

      identifiers = [
        "codebuild.amazonaws.com",
      ]
    }
  }
}

# data.aws_iam_policy_document.codebuild.json
data "aws_iam_policy_document" "codebuild" {
  statement {
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]

    resources = [
      "arn:aws:logs:*:*:*",
    ]
  }

  statement {
    actions = [
      "s3:GetObject",
      "s3:GetObjectVersion",
      "s3:GetBucketVersioning",
      "s3:PutObject",
    ]

    resources = [
      "${aws_s3_bucket.codepipeline.arn}",
      "${aws_s3_bucket.codepipeline.arn}/*",
    ]
  }
}

# -----------------------------------------------------------------------------

# data.aws_iam_policy_document.codepipeline_assume_role.json
data "aws_iam_policy_document" "codepipeline_assume_role" {
  statement {
    actions = [
      "sts:AssumeRole",
    ]

    principals {
      type = "Service"

      identifiers = [
        "codepipeline.amazonaws.com",
      ]
    }
  }
}

# data.aws_iam_policy_document.codepipeline.json
data "aws_iam_policy_document" "codepipeline" {
  statement {
    actions = [
      "codebuild:BatchGetBuilds",
      "codebuild:StartBuild",
    ]

    resources = [
      "*",
    ]
  }

  statement {
    actions = [
      "s3:PutObject",
    ]

    resources = [
      "${aws_s3_bucket.codepipeline.arn}",
      "${aws_s3_bucket.codepipeline.arn}/*",
    ]
  }
}

# -----------------------------------------------------------------------------

# data.aws_iam_policy_document.codepipeline_manager_assume_role.json
data "aws_iam_policy_document" "codepipeline_manager_assume_role" {
  statement {
    actions = [
      "sts:AssumeRole",
    ]

    principals {
      type = "Service"

      identifiers = [
        "lambda.amazonaws.com",
      ]
    }
  }
}

# data.aws_iam_policy_document.codepipeline_manager.json
data "aws_iam_policy_document" "codepipeline_manager" {
  statement {
    actions = [
      "codepipeline:CreatePipeline",
      "codepipeline:DeletePipeline",
      "codepipeline:GetPipeline",
      "codepipeline:GetPipelineExecution",
      "codepipeline:StartPipelineExecution",
    ]

    resources = [
      "*",
    ]
  }

  statement {
    actions = [
      "iam:PassRole",
    ]

    resources = [
      "${aws_iam_role.codepipeline.arn}",
    ]
  }

  statement {
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]

    resources = [
      "arn:aws:logs:*:*:*",
    ]
  }
}

# -----------------------------------------------------------------------------

# data.aws_iam_policy_document.github.json
data "aws_iam_policy_document" "github" {
  statement {
    actions = [
      "sns:Publish",
    ]

    resources = [
      "${aws_sns_topic.github.arn}",
    ]
  }
}

# -----------------------------------------------------------------------------
# Resources: IAM
# -----------------------------------------------------------------------------

# aws_iam_role.codebuild
resource "aws_iam_role" "codebuild" {
  name = "${var.namespace}-codebuild"
  path = "/${var.namespace}/codebuild/"

  assume_role_policy = "${
    data.aws_iam_policy_document.codebuild_assume_role.json
  }"
}

# aws_iam_policy.codebuild
resource "aws_iam_policy" "codebuild" {
  name = "${var.namespace}-codebuild"
  path = "/${var.namespace}/codebuild/"

  policy = "${
    data.aws_iam_policy_document.codebuild.json
  }"
}

# aws_iam_policy_attachment.codebuild
resource "aws_iam_policy_attachment" "codebuild" {
  name = "${var.namespace}-codebuild"

  policy_arn = "${aws_iam_policy.codebuild.arn}"
  roles      = ["${aws_iam_role.codebuild.id}"]
}

# -----------------------------------------------------------------------------

# aws_iam_role.codepipeline
resource "aws_iam_role" "codepipeline" {
  name = "${var.namespace}-codepipeline"
  path = "/${var.namespace}/codepipeline/"

  assume_role_policy = "${
    data.aws_iam_policy_document.codepipeline_assume_role.json
  }"
}

# aws_iam_policy.codepipeline
resource "aws_iam_policy" "codepipeline" {
  name = "${var.namespace}-codepipeline"
  path = "/${var.namespace}/codepipeline/"

  policy = "${
    data.aws_iam_policy_document.codepipeline.json
  }"
}

# aws_iam_policy_attachment.codepipeline
resource "aws_iam_policy_attachment" "codepipeline" {
  name = "${var.namespace}-codepipeline"

  policy_arn = "${aws_iam_policy.codepipeline.arn}"
  roles      = ["${aws_iam_role.codepipeline.id}"]
}

# -----------------------------------------------------------------------------

# aws_iam_role.codepipeline_manager
resource "aws_iam_role" "codepipeline_manager" {
  name = "${var.namespace}-codepipeline-manager"
  path = "/${var.namespace}/codepipeline/"

  assume_role_policy = "${
    data.aws_iam_policy_document.codepipeline_manager_assume_role.json
  }"
}

# aws_iam_policy.codepipeline_manager
resource "aws_iam_policy" "codepipeline_manager" {
  name = "${var.namespace}-codepipeline-manager"
  path = "/${var.namespace}/codepipeline/"

  policy = "${
    data.aws_iam_policy_document.codepipeline_manager.json
  }"
}

# aws_iam_policy_attachment.codepipeline_manager
resource "aws_iam_policy_attachment" "codepipeline_manager" {
  name = "${var.namespace}-codepipeline-manager"

  policy_arn = "${aws_iam_policy.codepipeline_manager.arn}"
  roles      = ["${aws_iam_role.codepipeline_manager.id}"]
}

# -----------------------------------------------------------------------------

# aws_iam_user.github
resource "aws_iam_user" "github" {
  name = "${var.namespace}-webhook-${var.github_repository}"
  path = "/${var.namespace}/codepipeline/"
}

# aws_iam_access_key.github
resource "aws_iam_access_key" "github" {
  user = "${aws_iam_user.github.name}"
}

# aws_iam_user_policy.github
resource "aws_iam_user_policy" "github" {
  name = "${var.namespace}-webhook-${var.github_repository}"
  user = "${aws_iam_user.github.name}"

  policy = "${
    data.aws_iam_policy_document.github.json
  }"
}

# -----------------------------------------------------------------------------
# Resources: S3
# -----------------------------------------------------------------------------

# aws_s3_bucket.codepipeline
resource "aws_s3_bucket" "codepipeline" {
  bucket = "${var.codepipeline_artifacts_bucket}"
  acl    = "private"
}

# -----------------------------------------------------------------------------
# Resources: CodeBuild
# -----------------------------------------------------------------------------

# aws_codebuild_project.codebuild
resource "aws_codebuild_project" "codebuild" {
  name = "${var.github_repository}"

  build_timeout = "5"
  service_role  = "${aws_iam_role.codebuild.arn}"

  source {
    type = "CODEPIPELINE"
  }

  environment {
    compute_type = "${var.codebuild_compute_type}"
    type         = "LINUX_CONTAINER"
    image        = "${var.codebuild_image}"
  }

  artifacts {
    type = "CODEPIPELINE"
  }
}

# -----------------------------------------------------------------------------
# Resources: CodePipeline
# -----------------------------------------------------------------------------

# aws_codepipeline.codepipeline
resource "aws_codepipeline" "codepipeline" {
  name = "${var.github_repository}"

  role_arn = "${aws_iam_role.codepipeline.arn}"

  artifact_store {
    type     = "S3"
    location = "${aws_s3_bucket.codepipeline.bucket}"
  }

  stage {
    name = "Source"

    action {
      name     = "Source"
      category = "Source"
      owner    = "ThirdParty"
      provider = "GitHub"
      version  = "1"

      output_artifacts = ["source"]

      configuration {
        OAuthToken = "${var.github_oauth_token}"
        Owner      = "${var.github_organization}"
        Repo       = "${var.github_repository}"
        Branch     = "master"

        PollForSourceChanges = false
      }
    }
  }

  stage {
    name = "Build"

    action {
      name     = "Build"
      category = "Build"
      owner    = "AWS"
      provider = "CodeBuild"
      version  = "1"

      input_artifacts  = ["source"]
      output_artifacts = ["artifacts"]

      configuration {
        ProjectName = "${aws_codebuild_project.codebuild.name}"
      }
    }
  }
}

# -----------------------------------------------------------------------------
# Resources: SNS
# -----------------------------------------------------------------------------

# aws_sns_topic.github
resource "aws_sns_topic" "github" {
  name = "${var.namespace}-webhook-${var.github_repository}"
}

# aws_sns_topic_subscription.github
resource "aws_sns_topic_subscription" "github" {
  topic_arn = "${aws_sns_topic.github.arn}"
  protocol  = "lambda"
  endpoint  = "${aws_lambda_function.github_push.arn}"
}

# -----------------------------------------------------------------------------
# Resources: CloudWatch
# -----------------------------------------------------------------------------

# aws_cloudwatch_event_rule.github_status
resource "aws_cloudwatch_event_rule" "github_status" {
  name = "${var.namespace}-webhook-${var.github_repository}"

  event_pattern = <<PATTERN
{
  "source": [
    "aws.codepipeline"
  ],
  "detail-type": [
    "CodePipeline Pipeline Execution State Change"
  ]
}
PATTERN
}

# aws_cloudwatch_event_target.github_status
resource "aws_cloudwatch_event_target" "github_status" {
  rule = "${aws_cloudwatch_event_rule.github_status.name}"
  arn  = "${aws_lambda_function.github_status.arn}"
}

# -----------------------------------------------------------------------------
# Resources: Lambda
# -----------------------------------------------------------------------------

# aws_lambda_function.github_push
resource "aws_lambda_function" "github_push" {
  function_name = "${var.namespace}-webhook-${var.github_repository}-push"
  role          = "${aws_iam_role.codepipeline_manager.arn}"
  runtime       = "nodejs6.10"
  filename      = "${path.module}/api/dist/push.zip"
  handler       = "index.default"
  timeout       = 10

  source_code_hash = "${
    base64sha256(file("${path.module}/api/dist/push.zip"))
  }"

  environment {
    variables = {
      CODEPIPELINE_NAME  = "${aws_codepipeline.codepipeline.name}"
      GITHUB_OAUTH_TOKEN = "${var.github_oauth_token}"
    }
  }
}

# aws_lambda_permission.github_push
resource "aws_lambda_permission" "github_push" {
  statement_id  = "AllowExecutionFromSNS"
  action        = "lambda:InvokeFunction"
  function_name = "${aws_lambda_function.github_push.arn}"
  principal     = "sns.amazonaws.com"
  source_arn    = "${aws_sns_topic.github.arn}"
}

# -----------------------------------------------------------------------------

# aws_lambda_function.github_status
resource "aws_lambda_function" "github_status" {
  function_name = "${var.namespace}-webhook-${var.github_repository}-status"
  role          = "${aws_iam_role.codepipeline_manager.arn}"
  runtime       = "nodejs6.10"
  filename      = "${path.module}/api/dist/status.zip"
  handler       = "index.default"
  timeout       = 10

  source_code_hash = "${
    base64sha256(file("${path.module}/api/dist/status.zip"))
  }"

  environment {
    variables = {
      GITHUB_OAUTH_TOKEN  = "${var.github_oauth_token}"
      GITHUB_ORGANIZATION = "${var.github_organization}"
      GITHUB_REPOSITORY   = "${var.github_repository}"
      GITHUB_BOT_NAME     = "${var.github_bot_name}"
    }
  }
}

# aws_lambda_permission.github_status
resource "aws_lambda_permission" "github_status" {
  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = "${aws_lambda_function.github_status.arn}"
  principal     = "events.amazonaws.com"
  source_arn    = "${aws_cloudwatch_event_rule.github_status.arn}"
}

# -----------------------------------------------------------------------------
# Resources: GitHub
# -----------------------------------------------------------------------------

# github_repository_webhook.github
resource "github_repository_webhook" "github" {
  repository = "${var.github_repository}"
  name       = "amazonsns"

  configuration {
    aws_key    = "${aws_iam_access_key.github.id}"
    aws_secret = "${aws_iam_access_key.github.secret}"
    sns_topic  = "${aws_sns_topic.github.arn}"
    sns_region = "${data.aws_region._.name}"
  }

  events = ["push", "pull_request"]
}
