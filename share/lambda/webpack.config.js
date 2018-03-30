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

const archiver = require("archiver")
const externals = require("webpack-node-externals")
const fs = require("fs")
const path = require("path")
const webpack = require("webpack")

const EventHooksPlugin = require("event-hooks-webpack-plugin")

/* ----------------------------------------------------------------------------
 * Functions
 * ------------------------------------------------------------------------- */

/**
 * Resolve module dependencies recursively
 *
 * @param {string} module - Module path
 * @param {Array<string>} parents - Parent module paths
 *
 * @return {Array<string>} Paths of dependent modules
 */
const resolve = (module, ...parents) => {
  const metadata = require(path.resolve(module, "package.json"))
  return Object.keys(metadata.dependencies || {}).reduce(
    (dependencies, name) => {
      const dependency = path.resolve([
        module, ...parents, __dirname
      ].find(base => {
        return fs.existsSync(path.resolve(base, "node_modules", name))
      }), "node_modules", name)
      return [
        ...dependencies, dependency,
        ...resolve(dependency, module, ...parents)
      ]
    }, [])
}

/**
 * Automatically resolve entrypoints
 *
 * @param  {string} directory Directory
 *
 * @return {Object} Entrypoints
 */
const entry = directory => {
  return fs.readdirSync(directory).reduce((entrypoints, file) => {
    if (fs.statSync(`${directory}/${file}`).isDirectory()) {
      return { ...entrypoints, ...entry(`${directory}/${file}`) }
    } else if (file.match(/\.js$/)) {
      const [, name] = /^(.*?)\.js$/.exec(path.relative(
        path.resolve(__dirname, "src"), `${directory}/${file}`
      ))
      entrypoints[name] = path.resolve(__dirname, "src", `${name}.js`)
    }
    return entrypoints
  }, {})
}

/* ----------------------------------------------------------------------------
 * Configuration
 * ------------------------------------------------------------------------- */

module.exports = env => {
  const config = {
    target: "node",

    /* Entrypoints */
    entry: entry(path.resolve(__dirname, "src")),

    /* Loaders */
    module: {
      rules: [
        {
          test: /\.js$/,
          use: "babel-loader",
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
      path: path.join(__dirname, "dist"),
      filename: "[name]/index.js",
      libraryTarget: "commonjs2"
    },

    /* Plugins */
    plugins: [

      /* Hack: The webpack development middleware sometimes goes into a loop on
         macOS when starting for the first time. This is a quick fix until
         this issue is resolved. See: http://bit.ly/2AsizEn */
      new EventHooksPlugin({
        "watch-run": (compiler, cb) => {
          compiler.startTime += 10000
          cb()
        },
        done: stats => {
          stats.startTime -= 10000
        }
      }),

      /* Post-compilation hook to bundle sources with dependencies */
      new EventHooksPlugin({
        done: stats => {
          Object.keys(stats.compilation.entrypoints).forEach(name => {
            const entrypoint = stats.compilation.entrypoints[name]
            entrypoint.chunks.forEach(chunk => {

              /* Create archive for each entrypoint */
              const archive = archiver("zip", { zlib: { level: 9 } })
              const zipfile = fs.createWriteStream(
                path.join(__dirname, "dist", `${name}.zip`))

              /* Iterate modules and include into archive if external */
              chunk.forEachModule(module => {
                module.dependencies.forEach(dependency => {

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
      extensions: [".js"]
    },

    /* Sourcemaps */
    devtool: !env || env.prod ? "inline-source-map" : ""
  }

  /* Production compilation */
  if (env && env.prod) {
    config.plugins.push(

      /* Beautify sources */
      new webpack.optimize.UglifyJsPlugin({
        beautify: true,
        compress: false,
        mangle: false,
        output: {
          comments: false,
          indent_level: 2, // eslint-disable-line camelcase
          width: 80
        }
      }))
  }

  /* We're good to go */
  return config
}
