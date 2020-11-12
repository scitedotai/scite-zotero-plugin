# scite-zotero-plugin

Welcome!

This is a Zotero plugin developed by scite so that you can enrich your library with information from us. To learn more about scite, give us a visit at `https://scite.ai`.

## Installation

- Get the XPI file and install it in Zotero following the normal plugin procedure.

## Changelog

### 1.0.0

Release initial version of plugin that allows you to:
- See the # supporting cites (separate column, sortable)
- See the # mentioning cites (separate column, sortable)
- See the # disputing cites (separate column, sortable)
- Directly view a scite report by right-clicking on a row and clicking 'View scite report')
- Refreshing the tallies whenever you want (right-click row and click the refresh tallies option)

## Instructions for local development

(These were originally from `https://www.zotero.org/support/dev/client_coding/plugin_development` but replicated here for convenience)

- Clone the repo
- `npm install` to get any dependencies
- `npm run build` will generate a `build/` folder for you. You should see an `install.rdf` file in this directory. If you open it, find the `<em:id>` tag and make note of the value.
- Make sure Zotero is closed
- In terminal, navigate to your Zotero profile directory

| Operating System      | Location |
| ----------- | ----------- |
| Mac      | /Users/<username>/Library/Application Support/Zotero/Profiles/<randomstring>       |
| Windows 10/8/7/Vista   | C:\Users\<User Name>\AppData\Roaming\Zotero\Zotero\Profiles\<randomstring>        |
| Windows XP/2000  | C:\Documents and Settings\<username>\Application Data\Zotero\Zotero\Profiles\<randomstring>        |
| Linux  | ~/.zotero/zotero/<randomstring>       |

NOTE: The above table is from `https://www.zotero.org/support/kb/profile_directory`

- Next, go into `extensions/` and create a text file matching the value you saw in the `<em:id>` tag. e.g. a file called `scite@scite.ai`
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

Notes:
- The lines in `prefs.js` will be re-written whenever you open Zotero so you have to remember to comment them out each time!
- Doing `npm run build` will also generate an `xpi/` directory locally that you can directly add as a plugin into your Zotero
- It looks like Zotero has been migrating to Electron (or at least there may be plans for this; it's been discussed for the past 4 years). Due to the lack of support for XUL, clear plugin documentation, and the potential deprecation of this version of Zotero, a lot of this codebase was put together by looking at existing plugins that worked in similar ways. Namely: `https://github.com/PubPeerFoundation/pubpeer_zotero_plugin`, `https://github.com/jlegewie/zotfile`, and `https://github.com/bwiernik/zotero-shortdoi`. If you're trying to write a plugin, I'd recommend poking around all 3 of those!

## Release

It will auto-release on merge to master. Shoutout to this wonderful package: `https://github.com/retorquere/zotero-plugin-webpack`. NOTE: At the moment, this package expects your default branch to be `master`, so just a heads up if you use `main`!

## Questions

If you have any questions or have feedback, feel free to write to us at hi@scite.ai, or create an issue here.
