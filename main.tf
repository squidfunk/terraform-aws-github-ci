# Copyright (c) 2016-2017 Martin Donath <martin.donath@squidfunk.com>

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

# -----------------------------------------------------------------------------
# Data: IAM
# -----------------------------------------------------------------------------

# data.aws_iam_policy_document.codebuild_assume_role_policy.json
data "aws_iam_policy_document" "codebuild_assume_role_policy" {
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

# data.aws_iam_policy_document.codebuild_policy.json                            # TODO: fix s3 policy (here and in codepipeline)
data "aws_iam_policy_document" "codebuild_policy" {
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
      "s3:*",
    ]

    resources = [
      "${aws_s3_bucket._.arn}",
      "${aws_s3_bucket._.arn}/*",
    ]
  }
}

# -----------------------------------------------------------------------------

# data.aws_iam_policy_document.codepipeline_assume_role_policy.json
data "aws_iam_policy_document" "codepipeline_assume_role_policy" {
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

# data.aws_iam_policy_document.codepipeline_policy.json
data "aws_iam_policy_document" "codepipeline_policy" {
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
      "s3:*",
    ]

    resources = [
      "${aws_s3_bucket._.arn}",
      "${aws_s3_bucket._.arn}/*",
    ]
  }
}

# -----------------------------------------------------------------------------

# data.aws_iam_policy_document.codepipeline_manager_assume_role_policy.json
data "aws_iam_policy_document" "codepipeline_manager_assume_role_policy" {
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

# data.aws_iam_policy_document.codepipeline_manager_policy.json
data "aws_iam_policy_document" "codepipeline_manager_policy" {
  statement {
    actions = [
      "codepipeline:CreatePipeline",
      "codepipeline:DeletePipeline",
      "codepipeline:GetPipelineState",
      "codepipeline:ListPipelines",
      "codepipeline:GetPipeline",
      "codepipeline:UpdatePipeline",
    ]

    resources = [
      "*",
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
# Resources: IAM
# -----------------------------------------------------------------------------

# aws_iam_role.codebuild_role
resource "aws_iam_role" "codebuild_role" {
  name = "CodeBuild"
  path = "/codebuild/"

  assume_role_policy = "${
    data.aws_iam_policy_document.codebuild_assume_role_policy.json
  }"
}

# aws_iam_policy.codebuild_policy
resource "aws_iam_policy" "codebuild_policy" {
  name = "CodeBuildPolicy"
  path = "/codebuild/"

  policy = "${
    data.aws_iam_policy_document.codebuild_policy.json
  }"
}

# aws_iam_policy_attachment.codebuild_policy_attachment
resource "aws_iam_policy_attachment" "codebuild_policy_attachment" {
  name = "CodeBuildPolicyAttachment"

  policy_arn = "${aws_iam_policy.codebuild_policy.arn}"
  roles      = ["${aws_iam_role.codebuild_role.id}"]
}

# -----------------------------------------------------------------------------

# aws_iam_role.codepipeline_role
resource "aws_iam_role" "codepipeline_role" {
  name = "CodePipeline"
  path = "/codepipeline/"

  assume_role_policy = "${
    data.aws_iam_policy_document.codepipeline_assume_role_policy.json
  }"
}

# aws_iam_policy.codepipeline_policy
resource "aws_iam_policy" "codepipeline_policy" {
  name = "CodePipelinePolicy"
  path = "/codepipeline/"

  policy = "${
    data.aws_iam_policy_document.codepipeline_policy.json
  }"
}

# aws_iam_policy_attachment.codepipeline_policy_attachment
resource "aws_iam_policy_attachment" "codepipeline_policy_attachment" {
  name = "CodePipelinePolicyAttachment"

  policy_arn = "${aws_iam_policy.codepipeline_policy.arn}"
  roles      = ["${aws_iam_role.codepipeline_role.id}"]
}

# -----------------------------------------------------------------------------

# aws_iam_role.codepipeline_manager_role
resource "aws_iam_role" "codepipeline_manager_role" {
  name = "CodePipelineManager"
  path = "/codepipeline/"

  assume_role_policy = "${
    data.aws_iam_policy_document.codepipeline_manager_assume_role_policy.json
  }"
}

# aws_iam_policy.codepipeline_manager_policy
resource "aws_iam_policy" "codepipeline_manager_policy" {
  name = "CodePipelineManagerPolicy"
  path = "/codepipeline/"

  policy = "${
    data.aws_iam_policy_document.codepipeline_manager_policy.json
  }"
}

# aws_iam_policy_attachment.codepipeline_manager_policy_attachment
resource "aws_iam_policy_attachment" "codepipeline_manager_policy_attachment" {
  name = "CodePipelineManagerPolicyAttachment"

  policy_arn = "${aws_iam_policy.codepipeline_manager_policy.arn}"
  roles      = ["${aws_iam_role.codepipeline_manager_role.id}"]
}

# -----------------------------------------------------------------------------
# Resources: S3
# -----------------------------------------------------------------------------

# aws_s3_bucket._
resource "aws_s3_bucket" "_" {
  bucket = "${var.codepipeline_store_bucket}"
  acl    = "private"
}

# -----------------------------------------------------------------------------
# Resources: CodeBuild
# -----------------------------------------------------------------------------

# aws_codebuild_project._
resource "aws_codebuild_project" "_" {
  name = "${var.github_repository}"

  build_timeout = "5"
  service_role  = "${aws_iam_role.codebuild_role.arn}"

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

# aws_codepipeline._
resource "aws_codepipeline" "_" {
  name = "${var.github_repository}"

  role_arn = "${aws_iam_role.codepipeline_role.arn}"

  artifact_store {
    type     = "S3"
    location = "${aws_s3_bucket._.bucket}"
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
        ProjectName = "${aws_codebuild_project._.name}"
      }
    }
  }

  # stage {
  #   name = "Deploy"
  #
  #   action {
  #     name     = "Deploy"
  #     category = "Invoke"
  #     owner    = "AWS"
  #     provider = "Lambda"
  #
  #     input_artifacts = [
  #       "source",
  #     ]
  #
  #     configuration {
  #       FunctionName = "index.handler"
  #
  #       // Upload release to S3 as zip file,
  #       // Then register deployment bucket
  #
  #       // TODO: we should upload results to S3
  #       // and then run a ginseng-analytics deploy action.
  #     }
  #   }
  # }
}
