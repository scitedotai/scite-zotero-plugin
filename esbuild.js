const path = require('path')
const fs = require('fs')
const esbuild = require('esbuild')
const rmrf = require('rimraf')
rmrf.sync('gen')

require('zotero-plugin/copy-assets')
require('zotero-plugin/rdf')
require('zotero-plugin/version')

// Newest Zotero version the plugin declares support for (zotero-plugin hardcodes 7.0.*)
const ZOTERO_STRICT_MAX_VERSION = '8.0.*'

// Fix manifest.json to support newer Zotero versions
// Also fix version to be valid (only numbers and dots allowed)
const manifestPath = path.join(__dirname, 'build/manifest.json')
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
manifest.applications.zotero.strict_max_version = ZOTERO_STRICT_MAX_VERSION
// Zotero requires version to be max 4 dot-separated integers. Release builds use
// the package.json version (the v<version> tag), so it always matches updates.json.
// Other builds keep the version zotero-plugin/version generated (e.g. 2.0.5.<run
// number> in CI) so a test build is not mistaken for the release, unless that is
// not a valid Zotero version (local builds append username and hostname).
const isReleaseTag = process.env.GITHUB_REF_TYPE === 'tag'
const isValidVersion = /^\d+(\.\d+){0,3}$/.test(manifest.version)
if (isReleaseTag || !isValidVersion) manifest.version = require('./package.json').version
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

function js(src) {
  return src.replace(/[.]ts$/, '.js')
}

async function bundle(config) {
  config = {
    bundle: true,
    format: 'iife',
    target: ['firefox60'],
    external: ['zotero/itemTree'],
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
    entryPoints: [ 'lib.ts' ],
    outdir: 'build',
    banner: { js: 'var Zotero;\nif (!Zotero.Scite) {\n' },
    footer: { js: '\n}' },
  })
}

build().catch(err => {
  console.log(err)
  process.exit(1)
})
