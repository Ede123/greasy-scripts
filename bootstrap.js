"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import("resource://gre/modules/Services.jsm");



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
	Services.wm.addListener(greasyscripts.getWindowListener());
}

function shutdown(data, reason) {
	// When the application is shutting down we don't have to clean up any UI changes made
	if (reason == APP_SHUTDOWN)
		return;

	// Stop listening for new windows
	Services.wm.removeListener(greasyscripts.getWindowListener());

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