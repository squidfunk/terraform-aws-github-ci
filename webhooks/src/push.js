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

/* ----------------------------------------------------------------------------
 * Variables
 * ------------------------------------------------------------------------- */

/**
 * Pipeline manager
 *
 * @type {AWS.CodePipeline}
 */
const manager = new AWS.CodePipeline({ apiVersion: "2015-07-09" })

/* ----------------------------------------------------------------------------
 * Functions
 * ------------------------------------------------------------------------- */

/**
 * Clone pipeline master for pull requests and execute on push events
 *
 * @param {Object} event - Event
 * @param {Object} context - Context
 * @param {Function} cb - Completion callback
 */
export default (event, context, cb) => {
  new Promise((resolve, reject) => {
    for (const record of event.Records) {
      const type = record.Sns.MessageAttributes["X-Github-Event"].Value

      /* Event for pull request */
      if (type === "pull_request") {
        const message = JSON.parse(record.Sns.Message)                          // TODO: restructure, always parse message!

        /* Retrieve pipeline master */
        return new Promise((resolveMaster, rejectMaster) => {
          manager.getPipeline({
            name: process.env.CODEPIPELINE_NAME
          }, (err, master) => {
            return err
              ? rejectMaster(err)
              : resolveMaster(master.pipeline)
          })
        })

          /* Create and retrieve pipeline for pull request */
          .then(master => {
            const name = `${master.name}.PR-${message.number}`
            return new Promise((resolveBranch, rejectBranch) => {
              manager.getPipeline({ name }, (err, branch) => {
                if (branch)
                  return resolveBranch(branch.pipeline)

                /* Adjust params to clone pipeline master */
                master.stages[0].actions[0].configuration.Branch =
                  message.pull_request.head.ref
                master.stages[0].actions[0].configuration.OAuthToken =
                  process.env.GITHUB_OAUTH_TOKEN
                master.name = name

                /* Create pipeline for pull request */
                manager.createPipeline({
                  pipeline: master
                }, (cloneErr, cloned) => {
                  return cloneErr
                    ? rejectBranch(cloneErr)
                    : resolveBranch(cloned.pipeline)
                })
              })
            })
          })

          /* Handle pull request state */
          .then(pipeline => {
            return new Promise((resolveAction, rejectAction) => {
              const action = message.pull_request.state === "closed"
                ? "deletePipeline"
                : "startPipelineExecution"
              manager[action]({
                name: pipeline.name
              }, actionErr => {
                return actionErr
                  ? rejectAction(actionErr)
                  : resolveAction()
              })
            })
          })

          /* The event was processed */
          .then(resolve)

          /* Something went wrong */
          .catch(reject)

      /* Event for push on master */
      } else if (type === "push") {
        const message = JSON.parse(record.Sns.Message)

        // trigger build on master!

      /* Abort, if we encounter an unsupported event */
      } else {
        return reject(
          new Error(`Invalid event type: ${type}`))
      }
    }
  })

    /* The event was processed */
    .then(result => cb(null, result))

    /* An Error occurred */
    .catch(cb)
}
