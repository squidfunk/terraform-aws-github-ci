/*
 * Copyright (c) 2017 Martin Donath <martin.donath@squidfunk.com>
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

import AWS from "aws-sdk"
import GitHub from "github"

/* ----------------------------------------------------------------------------
 * Variables
 * ------------------------------------------------------------------------- */

/**
 * Build manager
 *
 * @type {AWS.CodeBuild}
 */
const codebuild = new AWS.CodeBuild({ apiVersion: "2016-10-06" })

/**
 * GitHub client
 *
 * @type {AWS.GitHub}
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
 * @param {Object} event - Event
 * @param {Object} context - Context
 * @param {Function} cb - Completion callback
 */
export default (event, context, cb) => {
  event.Records.reduce((promise, record) => {
    const type = record.Sns.MessageAttributes["X-Github-Event"].Value
    const message = JSON.parse(record.Sns.Message)

    /* Retrieve commit SHA and reference */
    const [sha, ref] = type === "pull_request"
      ? [message.pull_request.head.sha, message.pull_request.head.ref]
      : [message.after, message.ref.replace("refs/heads/", "")]

    /* Return promise chain */
    return promise.then(() => {

      /* Start build for open pull request */
      if (type === "pull_request" && message.pull_request.state !== "closed" ||
          type === "push" && ref === "master") {
        return new Promise((resolve, reject) => {
          codebuild.startBuild({
            projectName: message.repository.name,
            sourceVersion: sha,
            environmentVariablesOverride: [
              {
                name: "GIT_COMMIT",
                value: ref
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
      }
    })
  }, Promise.resolve())

    /* The event was processed */
    .then(data => cb(null, data))

    /* An error occurred */
    .catch(cb)
}
