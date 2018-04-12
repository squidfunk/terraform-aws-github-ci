/*
 * Copyright (c) 2017-2018 Martin Donath <martin.donath@squidfunk.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

import * as GitHub from "github"

import { Callback, Context } from "aws-lambda"
import { CodeBuild, SNS } from "aws-sdk"

/* ----------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

/**
 * GitHub source change
 */
export interface GitHubSourceChange {
  repository: {
    owner: {
      login: string                    /* Repository owner name */
    }
    name: string                       /* Repository name */
  }
  ref: string                          /* Commit SHA */
  after: string                        /* Last commit SHA */
  pull_request: {
    head: {
      ref: string                      /* Pull Request branch name */
      sha: string                      /* Pull Request commit SHA */
    }
    state: string                      /* Pull request state */
  }
}

/**
 * GitHub webhook event
 */
export interface GitHubWebhookEvent {
  Records: Array<{
    Sns: SNS.PublishInput
  }>
}

/* ----------------------------------------------------------------------------
 * Variables
 * ------------------------------------------------------------------------- */

/**
 * Build manager
 */
const codebuild = new CodeBuild({ apiVersion: "2016-10-06" })

/**
 * GitHub client
 */
const github = new GitHub()
if (process.env.GITHUB_OAUTH_TOKEN)
  github.authenticate({
    type: "oauth",
    token: process.env.GITHUB_OAUTH_TOKEN
  })

/* ----------------------------------------------------------------------------
 * Functions
 * ------------------------------------------------------------------------- */

/**
 * Run build on source change
 *
 * @param event - GitHub webhook event
 * @param context - Context
 * @param cb - Completion callback
 */
export default (event: GitHubWebhookEvent, _: Context, cb: Callback) => {
  event.Records.reduce((promise, record) => {
    const type = (record.Sns.MessageAttributes!["X-Github-Event"] as any).Value
    const message: GitHubSourceChange = JSON.parse(record.Sns.Message)

    /* Retrieve commit SHA and reference */
    const [sha, ref] = type === "pull_request"
      ? [message.pull_request.head.sha, message.pull_request.head.ref]
      : [message.after, message.ref.replace("refs/heads/", "")]

    /* Return promise chain */
    return promise.then(() => {

      /* Start build for open pull request or master branch */
      if (type === "pull_request" && message.pull_request.state !== "closed" ||
          type === "push" && ref === "master") {
        return new Promise((resolve, reject) => {
          codebuild.startBuild({
            projectName: message.repository.name,
            sourceVersion: sha,
            environmentVariablesOverride: [
              {
                name: "GIT_BRANCH",
                value: ref
              },
              {
                name: "GIT_COMMIT",
                value: sha
              }
            ]
          }, err => {
            return err
              ? reject(err)
              : resolve()
          })
        })

          /* Update commit SHA with pipeline state */
          .then(() => {
            return github.repos.createStatus({
              owner: message.repository.owner.login,
              repo: message.repository.name,
              sha,
              state: "pending",
              context: process.env.GITHUB_REPORTER,
              description: "Waiting for status to be reported"
            })
          })
      } else {
        return Promise.resolve() // TODO: ugly...
      }
    })
  }, Promise.resolve())

    /* The event was processed */
    .then(data => cb(undefined, data))

    /* An error occurred */
    .catch(cb)
}
