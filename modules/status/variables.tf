# Copyright (c) 2017-2018 Martin Donath <martin.donath@squidfunk.com>

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

# -----------------------------------------------------------------------------
# Variables: General
# -----------------------------------------------------------------------------

# var.namespace
variable "namespace" {
  description = "AWS resource namespace/prefix"
}

# var.share
variable "share" {
  description = "Path to shared data"
}

# -----------------------------------------------------------------------------
# Variables: GitHub
# -----------------------------------------------------------------------------

# var.github_owner
variable "github_owner" {
  description = "GitHub repository owner"
}

# var.github_repository
variable "github_repository" {
  description = "GitHub repository name"
}

# var.github_oauth_token
variable "github_oauth_token" {
  description = "GitHub OAuth token for repository access"
}

# var.github_reporter
variable "github_reporter" {
  description = "GitHub commit status reporter"
}

# -----------------------------------------------------------------------------
# Variables: S3
# -----------------------------------------------------------------------------

# var.bucket_arn
variable "bucket_arn" {
  description = "S3 bucket ARN"
}

# var.bucket_name
variable "bucket_name" {
  description = "S3 bucket name"
}
