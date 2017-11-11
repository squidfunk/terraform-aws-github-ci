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

# data.aws_caller_identity._
data "aws_caller_identity" "_" {}

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

# data.aws_iam_policy_document.github_webhook.json
data "aws_iam_policy_document" "github_webhook" {
  statement {
    actions = [
      "sns:Publish",
    ]

    resources = [
      "${aws_sns_topic.github_webhook.arn}",
    ]
  }
}

# -----------------------------------------------------------------------------
# Resources: IAM
# -----------------------------------------------------------------------------

# aws_iam_role.codebuild
resource "aws_iam_role" "codebuild" {
  name = "CodeBuild"
  path = "/codebuild/"

  assume_role_policy = "${
    data.aws_iam_policy_document.codebuild_assume_role.json
  }"
}

# aws_iam_policy.codebuild
resource "aws_iam_policy" "codebuild" {
  name = "CodeBuild"
  path = "/codebuild/"

  policy = "${
    data.aws_iam_policy_document.codebuild.json
  }"
}

# aws_iam_policy_attachment.codebuild
resource "aws_iam_policy_attachment" "codebuild" {
  name = "CodeBuild"

  policy_arn = "${aws_iam_policy.codebuild.arn}"
  roles      = ["${aws_iam_role.codebuild.id}"]
}

# -----------------------------------------------------------------------------

# aws_iam_role.codepipeline
resource "aws_iam_role" "codepipeline" {
  name = "CodePipeline"
  path = "/codepipeline/"

  assume_role_policy = "${
    data.aws_iam_policy_document.codepipeline_assume_role.json
  }"
}

# aws_iam_policy.codepipeline
resource "aws_iam_policy" "codepipeline" {
  name = "CodePipeline"
  path = "/codepipeline/"

  policy = "${
    data.aws_iam_policy_document.codepipeline.json
  }"
}

# aws_iam_policy_attachment.codepipeline
resource "aws_iam_policy_attachment" "codepipeline" {
  name = "CodePipeline"

  policy_arn = "${aws_iam_policy.codepipeline.arn}"
  roles      = ["${aws_iam_role.codepipeline.id}"]
}

# -----------------------------------------------------------------------------

# aws_iam_role.codepipeline_manager
resource "aws_iam_role" "codepipeline_manager" {
  name = "CodePipelineManager"
  path = "/codepipeline/"

  assume_role_policy = "${
    data.aws_iam_policy_document.codepipeline_manager_assume_role.json
  }"
}

# aws_iam_policy.codepipeline_manager
resource "aws_iam_policy" "codepipeline_manager" {
  name = "CodePipelineManager"
  path = "/codepipeline/"

  policy = "${
    data.aws_iam_policy_document.codepipeline_manager.json
  }"
}

# aws_iam_policy_attachment.codepipeline_manager
resource "aws_iam_policy_attachment" "codepipeline_manager" {
  name = "CodePipelineManager"

  policy_arn = "${aws_iam_policy.codepipeline_manager.arn}"
  roles      = ["${aws_iam_role.codepipeline_manager.id}"]
}

# -----------------------------------------------------------------------------

# aws_iam_user.github_webhook
resource "aws_iam_user" "github_webhook" {
  name = "${var.name}GitHubWebhook"
  path = "/codepipeline/"
}

# aws_iam_access_key.github_webhook
resource "aws_iam_access_key" "github_webhook" {
  user = "${aws_iam_user.github_webhook.name}"
}

# aws_iam_user_policy.github_webhook
resource "aws_iam_user_policy" "github_webhook" {
  name = "${var.name}GitHubWebhook"
  user = "${aws_iam_user.github_webhook.name}"

  policy = "${
    data.aws_iam_policy_document.github_webhook.json
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
  name = "${var.name}"

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
  name = "${var.name}"

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
        ProjectName = "${var.name}"
      }
    }
  }
}

# -----------------------------------------------------------------------------
# Resources: SNS
# -----------------------------------------------------------------------------

# aws_sns_topic.github_webhook
resource "aws_sns_topic" "github_webhook" {
  name         = "github-webhook-${var.github_repository}"
  display_name = "${var.name}GitHubWebhook"
}

# aws_sns_topic_subscription.github_webhook
resource "aws_sns_topic_subscription" "github_webhook" {
  topic_arn = "${aws_sns_topic.github_webhook.arn}"
  protocol  = "lambda"
  endpoint  = "${aws_lambda_function.github_webhook.arn}"
}

# -----------------------------------------------------------------------------
# Resources: Distribution files
# -----------------------------------------------------------------------------

# null_resource._
resource "null_resource" "github_webhook" {
  provisioner "local-exec" {
    command = "make -C webhooks build"
  }
}

# -----------------------------------------------------------------------------
# Resources: Lambda
# -----------------------------------------------------------------------------

# aws_lambda_function.github_webhook
resource "aws_lambda_function" "github_webhook" {
  function_name = "github-webhook-${var.github_repository}"
  role          = "${aws_iam_role.codepipeline_manager.arn}"
  runtime       = "nodejs6.10"
  filename      = "${path.module}/webhooks/dist/push.zip"
  handler       = "index.default"

  source_code_hash = "${
    base64sha256(file("${path.module}/webhooks/dist/push.zip"))
  }"

  environment {
    variables = {
      CODEPIPELINE_NAME  = "${var.name}"
      GITHUB_OAUTH_TOKEN = "${var.github_oauth_token}"
    }
  }
}

# aws_lambda_permission.github_webhook
resource "aws_lambda_permission" "github_webhook" {
  statement_id  = "AllowExecutionFromSNS"
  action        = "lambda:InvokeFunction"
  function_name = "${aws_lambda_function.github_webhook.arn}"
  principal     = "sns.amazonaws.com"
  source_arn    = "${aws_sns_topic.github_webhook.arn}"
}

# -----------------------------------------------------------------------------
# Resources: GitHub
# -----------------------------------------------------------------------------

# github_repository_webhook.github_webhook
resource "github_repository_webhook" "github_webhook" {
  repository = "${var.github_repository}"
  name       = "amazonsns"

  configuration {
    aws_key    = "${aws_iam_access_key.github_webhook.id}"
    aws_secret = "${aws_iam_access_key.github_webhook.secret}"
    sns_topic  = "${aws_sns_topic.github_webhook.arn}"
    sns_region = "${data.aws_region._.name}"
  }

  events = ["push", "pull_request"]
}
