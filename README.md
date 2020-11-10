# scite-zotero-plugin

Welcome!

This is a Zotero plugin developed by scite so that you can enrich your library with information from us. Namely, for each paper, we let you:
- See the # supporting cites (separate column)
- See the # mentioning cites (separate column)
- See the # disputing cites (separate column)
- Directly view a scite Report by right-clicking on a row and clicking 'view scite Report')
- Refreshing the tallies whenever you want

## Installation

- Get the XPI file and install it in Zotero following the normal plugin procedure.

## Instructions for local development

(These were originally from `https://www.zotero.org/support/dev/client_coding/plugin_development` but replicated here for convenience)

- Clone the repo
- `npm install` to get any dependencies
- `npm run build` will generate a `build/` folder for you. You should see an `install.rdf` file in this directory. If you open it, find the `<em:id>` tag and make note of the value.
- Make sure Zotero is closed
- In terminal, navigate to your Zotero profile directory (see: `https://www.zotero.org/support/kb/profile_directory`)
- Go into `extensions/` and create a text file matching the value you saw in the `<em:id>` tag. e.g. a file called `scite@scite.ai`
- Open this file, and in it, set the contents to be the absolute path to the `install.rdf` file from your `build/` directory
- `cd` back to the profile directory (one level above `extensions/`)
- Open the `prefs.js` file
- Comment out the lines containing `extensions.lastAppVersion` and `extensions.lastPlatformVersion`
- Open Zotero, and you should see the extension get loaded

Now, whenever you make changes to the source code, all you have to do for Zotero to pick it up is:
- Close Zotero
- Open `prefs.js`
- Comment out the lines containing `extensions.lastAppVersion` and `extensions.lastPlatformVersion`
- Open Zotero

## Release

TODO! (It just uses the zotero-plugin package to generate the XPI file, will add it to circle)

## Questions

If you have any questions or have feedback, feel free to write to us at hi@scite.ai, or create an issue here.