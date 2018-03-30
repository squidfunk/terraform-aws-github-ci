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

import * as archiver from "archiver"
import * as fs from "fs"
import * as path from "path"
import {
  Configuration,
  NoEmitOnErrorsPlugin,
  optimize
} from "webpack"
import * as externals from "webpack-node-externals"

/* Webpack plugins */
const {
  UglifyJsPlugin
} = optimize

/* ----------------------------------------------------------------------------
 * Plugins
 * ------------------------------------------------------------------------- */

import EventHooksPlugin = require("event-hooks-webpack-plugin")

/* ----------------------------------------------------------------------------
 * Functions
 * ------------------------------------------------------------------------- */

/**
 * Resolve module dependencies recursively
 *
 * @param module - Module path
 * @param parents - Parent module paths
 *
 * @return Paths of dependent modules
 */
function resolve(module: string, ...parents: string[]): string[] {
  const metadata = require(path.resolve(module, "package.json"))
  return Object.keys(metadata.dependencies || {}).reduce(
    (dependencies: string[], name: string) => {
      const dependency = path.resolve([
        module, ...parents, __dirname
      ].find(base => {
        return fs.existsSync(path.resolve(base, "node_modules", name))
      })!, "node_modules", name)
      return [
        ...dependencies, dependency,
        ...resolve(dependency, module, ...parents)
      ]
    }, [])
}

/**
 * Automatically resolve entrypoints
 *
 * @param directory Directory
 *
 * @return Entrypoints
 */
function entry(directory: string): { [key: string]: string } {
  return fs.readdirSync(directory)
    .reduce<{ [key: string]: string }>((entrypoints, file) => {
      if (fs.statSync(`${directory}/${file}`).isDirectory()) {
        return { ...entrypoints, ...entry(`${directory}/${file}`) }
      } else if (file.match(/\.ts$/)) {
        const [, name]: string[] = /^(.*?)\.ts$/.exec(path.relative(
          path.resolve(__dirname, "src"), `${directory}/${file}`
        )) || []
        entrypoints[name] = path.resolve(__dirname, "src", `${name}.ts`)
      }
      return entrypoints
    }, {})
}

/* ----------------------------------------------------------------------------
 * Configuration
 * ------------------------------------------------------------------------- */

export default (env?: { prod?: boolean }) => {
  const config: Configuration = {
    target: "node",

    /* Entrypoints */
    entry: entry(path.resolve(__dirname, "src")),

    /* Loaders */
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: ["babel-loader", "ts-loader"],
          exclude: /\/node_modules\//
        },
        {
          test: /\.svg$/,
          use: "binary-loader"
        }
      ]
    },

    /* Output */
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "[name]/index.js",
      libraryTarget: "commonjs2"
    },

    /* Plugins */
    plugins: [

      /* Don't emit assets if there were errors */
      new NoEmitOnErrorsPlugin(),

      /* Hack: The webpack development middleware sometimes goes into a loop
         on macOS when starting for the first time. This is a quick fix until
         this issue is resolved. See: http://bit.ly/2AsizEn */
      new EventHooksPlugin({
        "watch-run": (compiler: any, done: () => {}) => {
          compiler.startTime += 10000
          done()
        },
        "done": (stats: any) => {
          stats.startTime -= 10000
        }
      }),

      /* Post-compilation hook to bundle sources with dependencies */
      new EventHooksPlugin({
        done: (stats: any) => {
          Object.keys(stats.compilation.entrypoints).forEach(name => {
            const entrypoint = stats.compilation.entrypoints[name]
            entrypoint.chunks.forEach((chunk: any) => {

              /* Create archive for each entrypoint */
              const archive = archiver("zip", { zlib: { level: 9 } })
              const zipfile = fs.createWriteStream(
                path.join(__dirname, "dist", `${name}.zip`))

              /* Iterate modules and include into archive if external */
              chunk.forEachModule((module: any) => {
                module.dependencies.forEach((dependency: any) => {

                  /* Bundle all non-native modules, except aws-sdk */
                  if (dependency.request && dependency.request !== "aws-sdk" &&
                      dependency.request.match(/^[^.]/)) {
                    const external = path.resolve(
                      __dirname, "node_modules", dependency.request)
                    if (fs.existsSync(external)) {
                      archive.directory(external,
                        path.join("node_modules", dependency.request))

                      /* Bundle nested dependencies */
                      resolve(external).forEach(subexternal => {
                        archive.directory(subexternal,
                          path.relative(__dirname, subexternal))
                      })
                    }
                  }
                })
              })

              /* Append compiled sources to archive */
              archive.directory(path.resolve(__dirname, "dist", name), false)

              /* Finalize and write archive */
              archive.pipe(zipfile)
              archive.finalize()
            })
          })
        }
      })
    ],

    /* External modules */
    externals: [
      externals()
    ],

    /* Module resolver */
    resolve: {
      modules: [
        path.resolve(__dirname, "node_modules")
      ],
      extensions: [".ts"]
    }
  }

  /* Production compilation */
  if (env && env.prod) {
    config.plugins!.push(
      new UglifyJsPlugin({
        comments: false,
        beautify: true
      }))
  }

  /* We're good to go */
  return config
}
