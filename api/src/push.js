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
 * Pipeline manager
 *
 * @type {AWS.CodePipeline}
 */
const manager = new AWS.CodePipeline({ apiVersion: "2015-07-09" })

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
 * Clone pipeline master for pull requests
 *
 * @param {Object} event - Event
 * @param {Object} context - Context
 * @param {Function} cb - Completion callback
 */
export default (event, context, cb) => {
  event.Records.reduce((promise, record) => {
    const type = record.Sns.MessageAttributes["X-Github-Event"].Value
    const message = JSON.parse(record.Sns.Message)

    /* Return promise chain */
    return promise.then(() => {
      new Promise((resolve, reject) => {
        manager.getPipeline({
          name: message.repository.name
        }, (err, data) => {
          return err
            ? reject(err)
            : resolve(data.pipeline)
        })
      })
        .then(master => {

          /* Pull request event */
          if (type === "pull_request") {
            const name = `${master.name}.pr-${message.number}`
            return new Promise((resolve, reject) => {
              manager.getPipeline({ name }, (err, data) => {
                if (data)
                  return resolve(data.pipeline)

                /* Adjust params to clone pipeline master */
                master.stages[0].actions[0].configuration.Branch =
                  message.pull_request.head.ref
                master.stages[0].actions[0].configuration.OAuthToken =
                  process.env.GITHUB_OAUTH_TOKEN
                master.name = name

                /* Create pipeline for pull request */
                manager.createPipeline({
                  pipeline: master
                }, (createErr, data2) => {
                  return createErr
                    ? reject(createErr)
                    : resolve(data2.pipeline)
                })
              })
            })

              /* Handle pull request state */
              .then(pipeline => {
                return new Promise((resolve, reject) => {
                  const action = message.pull_request.state === "closed"
                    ? "deletePipeline"
                    : "startPipelineExecution"
                  manager[action]({
                    name: pipeline.name
                  }, err => {
                    return err
                      ? reject(err)
                      : resolve(pipeline)
                  })
                })
              })

              /* Update commit SHA with pipeline state */
              .then(pipeline => {
                return github.repos.createStatus({
                  owner: pipeline.stages[0].actions[0].configuration.Owner,
                  repo: pipeline.stages[0].actions[0].configuration.Repo,
                  sha: message.pull_request.head.sha,
                  state: "pending",
                  context: process.env.GITHUB_BOT_NAME,
                  description: "Pending"
                })
              })

          /* Push event */
          } else if (type === "push") {
            return new Promise((resolve, reject) => {
              if (message.ref.match(/master$/)) {
                manager.startPipelineExecution({
                  name: master.name
                }, err => {
                  return err
                    ? reject(err)
                    : resolve()
                })

              /* Don't build branches without pull requests */
              } else {
                resolve()
              }
            })
          }
        })
    })
  }, Promise.resolve())

    /* The event was processed */
    .then(data => cb(null, data))

    /* An error occurred */
    .catch(cb)
}
