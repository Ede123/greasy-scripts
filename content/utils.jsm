"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import("resource://gre/modules/Services.jsm");

const XMLHttpRequest = Components.Constructor("@mozilla.org/xmlextras/xmlhttprequest;1", "nsIXMLHttpRequest");
const console = (Cu.import("resource://gre/modules/devtools/Console.jsm", {})).console;


this.EXPORTED_SYMBOLS = ["utils"];


var styleSheetService = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);


this.utils = {
	// (un)register style sheets
	AGENT_SHEET: styleSheetService.AGENT_SHEET,
	USER_SHEET: styleSheetService.USER_SHEET,
	AUTHOR_SHEET: styleSheetService.AGENT_SHEET,

	registerStyleSheet: function(url, type) {
		var uri = ioService.newURI(url, null, null);
		styleSheetService.loadAndRegisterSheet(uri, type);
	},

	unregisterStyleSheet: function(url, type) {
		var uri = ioService.newURI(url, null, null);
		styleSheetService.unregisterSheet(uri, type);
	},


	// make an XMLHttpRequest
	httpRequest: function(url, type, callback) {
		var request = new XMLHttpRequest();
		request.open("get", url, true);
		request.responseType = type;
		request.onload = callback;
		request.onerror = function(event) {console.log(event);};
		request.send();
	},


	// iterate through all opened windows and execute a callback for each of them
	forWindows: function(callback) {
		var windows = Services.wm.getEnumerator("navigator:browser");
		while (windows.hasMoreElements()) {
			var domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
			callback(domWindow);
		}
	}
};