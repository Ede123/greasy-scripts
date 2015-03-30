"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

const console = (Cu.import("resource://gre/modules/devtools/Console.jsm", {})).console;
const XMLHttpRequest = Components.Constructor("@mozilla.org/xmlextras/xmlhttprequest;1", "nsIXMLHttpRequest");


this.EXPORTED_SYMBOLS = ["greasyscripts"];


// the domain data cache
this.cache = {};


function setText(window, text) {
	var broadcaster = window.document.getElementById("greasyscripts_broadcaster");
	broadcaster.setAttribute("acceltext", text);
}

function removeText(window) {
	var broadcaster = window.document.getElementById("greasyscripts_broadcaster");
	broadcaster.removeAttribute("acceltext");
}

function updateCount(window, count) {
	// set text according to "count" (remove if "undefined")
	if (typeof count === "undefined")
		removeText(window);
	else
		setText(window, count);

	// if in progressListener mode highlight toolbarbutton if count > 0 (unhighlight otherwise)
	if (preferences.mode == 1) {
		if (count)
			integrationProviders[preferences.provider].highlight(window.document);
		else
			integrationProviders[preferences.provider].unhighlight(window.document);
	}
}


function getDomain(uri) {
	var domain;

	try {
		var eTLDService = Cc["@mozilla.org/network/effective-tld-service;1"].getService(Ci.nsIEffectiveTLDService);
		domain = eTLDService.getBaseDomain(uri);
	}
	catch (e) {
		if (e.result == Cr.NS_ERROR_HOST_IS_IP_ADDRESS) // IP adresses (e.g http://192.168.178.1)
			domain = uri.host;
		else if (uri.spec.indexOf("about:") === 0) // special pages (e.g. about:addons)
			domain = uri.spec;
		else
			console.log("Error parsing URI: " + uri.spec + "\n" + e.message);
	}

	return domain;
}

function updateData(window, domain, data) {
	if (!data)
		return;

	// update cache if this was a new request
	if (preferences.cacheEnabled) {
		if (domain) {
			cache[domain] = {};
			cache[domain].data = data;
			cache[domain].timestamp = Date.now();
		}
	}

	var count = data.count;
	updateCount(window, count);
}

function updateLocation(window, uri) {
	var domain = getDomain(uri);

	// ignore - about:blank (since Firefox *always* loads it when opening a page in a new tab)
	//        - invalid URIs which return an undefined domain
	if ((domain == "about:blank") || (typeof domain === "undefined")) {
		updateCount(window, null);
		return;
	}

	// if the domain is cached use the cached entry
	if (preferences.cacheEnabled) {
		var cached = cache[domain];
		if (cached && (Date.now() - cached.timestamp < preferences.cacheMaxAge)) {
			updateData(window, null, cached.data);
			return;
		}
	}

	// otherwise make a new request
	var request = new XMLHttpRequest();
	request.open("get", "https://greasyfork.org/en/scripts/by-site/" + domain + ".json?meta=1", true);
	request.responseType = "json";
	request.onload = function() {updateData(window, domain, this.response);};
	request.onerror = function(event) {console.log(event);};
	request.send();
}


function event_popupshowing(event) {
	var window = event.target.ownerGlobal;
	var uri = window.gBrowser.currentURI;
	updateLocation(window, uri);
}

function event_popuphiding(event) {
	var window = event.target.ownerGlobal;
	removeText(window);
}


this.progressListener = {
	QueryInterface: XPCOMUtils.generateQI(["nsIWebProgressListener", "nsISupportsWeakReference"]),

    onLocationChange: function(aWebProgress, aRequest, aLocation, aFlags) {
		switch (aFlags) {
			case Ci.nsIWebProgressListener.LOCATION_CHANGE_SAME_DOCUMENT:
				return;
			case Ci.nsIWebProgressListener.LOCATION_CHANGE_ERROR_PAGE:
			default:
				var window = Services.wm.getMostRecentWindow("navigator:browser");
				updateLocation(window, aLocation);
		}
    },

    onStateChange: function() {},
    onProgressChange: function() {},
    onStatusChange: function() {},
    onSecurityChange: function() {}
};


this.greasyscripts = {

	openScriptsLink(window) {
		var domain = getDomain(window.gBrowser.currentURI);
		window.gBrowser.selectedTab = window.gBrowser.addTab("https://greasyfork.org/en/scripts/by-site/" + domain);
	},

	loadIntoWindow(window) {
		if (!window)
			return;
		var document = window.document;

		const NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

		// create a broadcaster that can be used to update attribute of multiple menuitems at once
		window.greasyscripts = {openScriptsLink: greasyscripts.openScriptsLink};

		var broadcaster = document.createElementNS(NS, "broadcaster");
		broadcaster.id = "greasyscripts_broadcaster";
		broadcaster.setAttribute("label", "Scripts from Greasy Fork");
		broadcaster.setAttribute("oncommand", "greasyscripts.openScriptsLink(window);");

		var broadcasterset = document.getElementById("mainBroadcasterSet");
		broadcasterset.appendChild(broadcaster);

		// create a menuitem which observes the broadcaster
		var menuitem = document.createElementNS(NS, "menuitem");
		menuitem.classList.add("greasyscripts_menuitem");
		menuitem.setAttribute("observes", "greasyscripts_broadcaster");

		// append the menuitem in all locations the current integration provider offers
		integrationProviders[preferences.provider].addMenuitems(document, menuitem);
	
		// add listeners
		switch (preferences.mode) {
			case 1: // progress listener to detect location changes; update constantly
				window.gBrowser.addProgressListener(progressListener);
				break;
			case 2: // event listener for menupopups; update only when the popup is opened
				var menuitems = integrationProviders[preferences.provider].getMenuitems(document);
				for (var i = 0; i < menuitems.length; i++) {
					menuitems[i].parentNode.addEventListener("popupshowing", event_popupshowing, false);
					menuitems[i].parentNode.addEventListener("popuphiding", event_popuphiding, false);
				}
				break;
		}
	},

	unloadFromWindow(window) {
		if (!window)
			return;
		var document = window.document;

		// remove listeners (we can remove regardless of adding them or not; in the worst case it silently fails)
		window.gBrowser.removeProgressListener(progressListener);

		var menuitems = integrationProviders[preferences.provider].getMenuitems(document);
		for (var i = 0; i < menuitems.length; i++) {
			menuitems[i].parentNode.removeEventListener("popupshowing", event_popupshowing, false);
			menuitems[i].parentNode.removeEventListener("popuphiding", event_popuphiding, false);
		}

		// remove all menuitems that were inserted
		integrationProviders[preferences.provider].removeMenuitems(document);

		// remove the broadcaster
		var broadcaster = document.getElementById("greasyscripts_broadcaster");
		broadcaster.parentNode.removeChild(broadcaster);

		delete window.greasyscripts;
	},

	init() {
		// register style sheets
		var sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
		var ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
		var uri = ios.newURI("chrome://greasyscripts/skin/greasyscripts.css", null, null);
		sss.loadAndRegisterSheet(uri, sss.AUTHOR_SHEET);

		// import add-on modules
		Cu.import("chrome://greasyscripts/content/preferences.jsm");
		Cu.import("chrome://greasyscripts/content/integrationProviders.jsm");
	},

	unload() {
		// unload add-on modules
		Cu.unload("chrome://greasyscripts/content/integrationProviders.jsm");
		Cu.unload("chrome://greasyscripts/content/preferences.jsm");

		//unregister style sheets
		var sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
		var ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
		var uri = ios.newURI("chrome://greasyscripts/skin/greasyscripts.css", null, null);
		sss.unregisterSheet(uri, sss.AUTHOR_SHEET);
	}
};