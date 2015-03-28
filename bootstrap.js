"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import("resource://gre/modules/Services.jsm");


this.windowListener = {
	onOpenWindow: function(aWindow) {
		var domWindow = aWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);
		// Wait for the window to finish loading
		domWindow.addEventListener("load", function onLoad() {
			domWindow.removeEventListener("load", onLoad, false);
			if (domWindow.document.documentElement.getAttribute("windowtype") == "navigator:browser") {
				greasyscripts.loadIntoWindow(domWindow);
			}
		}, false);
	},

	onCloseWindow: function(aWindow) {},
	onWindowTitleChange: function(aWindow, aTitle) {}
};


/** Bootstrap Entry Points **/

function startup(data, reason) {
	// Import add-on modules
	Cu.import("chrome://greasyscripts/content/greasyscripts.jsm");

	// Load into any existing windows
	var windows = Services.wm.getEnumerator("navigator:browser");
	while (windows.hasMoreElements()) {
		var domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
		greasyscripts.loadIntoWindow(domWindow);
	}

	// Load into any new windows
	Services.wm.addListener(windowListener);
}

function shutdown(data, reason) {
	// When the application is shutting down we don't have to clean up any UI changes made
	if (reason == APP_SHUTDOWN)
		return;

	// Stop listening for new windows
	Services.wm.removeListener(windowListener);

	// Unload from any existing windows
	var windows = Services.wm.getEnumerator("navigator:browser");
	while (windows.hasMoreElements()) {
		var domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
		greasyscripts.unloadFromWindow(domWindow);
	}

	// Unload add-on modules
	Cu.unload("chrome://greasyscripts/content/greasyscripts.jsm");
}

function install(data, reason) {}

function uninstall(data, reason) {}