const path = require('path')
const fs = require('fs')
const esbuild = require('esbuild')
const rmrf = require('rimraf')
rmrf.sync('gen')

require('zotero-plugin/copy-assets')
require('zotero-plugin/rdf')
require('zotero-plugin/version')

function js(src) {
  return src.replace(/[.]ts$/, '.js')
}

async function bundle(config) {
  config = {
    bundle: true,
    format: 'iife',
    target: ['firefox60'],
    inject: [],
    treeShaking: true,
    keepNames: true,
    ...config,
  }

  let target
  if (config.outfile) {
    target = config.outfile
  }
  else if (config.entryPoints.length === 1 && config.outdir) {
    target = path.join(config.outdir, js(path.basename(config.entryPoints[0])))
  }
  else {
    target = `${config.outdir} [${config.entryPoints.map(js).join(', ')}]`
  }

  const exportGlobals = config.exportGlobals
  delete config.exportGlobals
  if (exportGlobals) {
    const esm = await esbuild.build({ ...config, logLevel: 'silent', format: 'esm', metafile: true, write: false })
    if (Object.values(esm.metafile.outputs).length !== 1) throw new Error('exportGlobals not supported for multiple outputs')

    for (const output of Object.values(esm.metafile.outputs)) {
      if (output.entryPoint) {
        config.globalName = escape(`{ ${output.exports.sort().join(', ')} }`).replace(/%/g, '$')
        // make these var, not const, so they get hoisted and are available in the global scope.
      }
    }
  }

  console.log('* bundling', target)
  await esbuild.build(config)
  if (exportGlobals) {
    await fs.promises.writeFile(
      target,
      (await fs.promises.readFile(target, 'utf-8')).replace(config.globalName, unescape(config.globalName.replace(/[$]/g, '%')))
    )
  }
}

async function build() {
  await bundle({
    exportGlobals: true,
    entryPoints: [ 'bootstrap.ts' ],
    outdir: 'build',
    banner: { js: 'var Zotero;\n' },
  })

  await bundle({
    entryPoints: [ 'chrome/content/lib.ts' ],
    outdir: 'build/chrome/content',
  })
}

build().catch(err => {
  console.log(err)
  process.exit(1)
})
