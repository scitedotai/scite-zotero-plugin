function log(msg) {
	Zotero.debug("Scite Plugin Zotero (V7): " + msg);
}

async function init() {
	log("Initializing");
	await Zotero.initializationPromise;
	Zotero.ScitePluginZoteroV7.foo();

	// Use strings from scite-zotero-plugin.properties -
	// Fluent is available in Zotero 6 but unreliable and difficult to configure
	let stringBundle = Services.strings.createBundle('chrome://scite-zotero-plugin/locale/scite-zotero-plugin.properties');
	Zotero.getMainWindow().document.getElementById('make-it-green-instead')
		.setAttribute('label', stringBundle.GetStringFromName('makeItGreenInstead.label'));
}

window.addEventListener('load', function (event) {
	init();
});
