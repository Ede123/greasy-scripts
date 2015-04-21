/* globals Components, Services, XPCOMUtils */
/* globals utils, preferences, PreferencesObserver, integrationProviders */
/* globals stringBundle:true, cache:true, dataURI:true */
"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

const console = (Cu.import("resource://gre/modules/devtools/Console.jsm", {})).console;


this.EXPORTED_SYMBOLS = ["greasyscripts"];


// string bundle for translations
this.stringBundle = {};

// the domain data cache
this.cache = {};
// dataURI for dynamic styles (needed to remove the style sheet later on)
this.dataURI = "";


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
		setText(window, count + " " + stringBundle.GetStringFromName("available"));

	// if in progressListener mode highlight toolbarbutton if count > 0 (unhighlight otherwise)
	if (preferences.highlight && preferences.mode == 1) {
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
		updateCount(window, undefined);
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
	var url = "https://greasyfork.org/en/scripts/by-site/" + domain + ".json?meta=1";
	utils.httpRequest(url, "json", function() {updateData(window, domain, this.response);} );
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


function addBroadcaster(window) {
	// expose the openScriptsLink() method in the window for usage by UI elements
	window.greasyscripts = {openScriptsLink: greasyscripts.openScriptsLink};

	// create the broadcaster
	const NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
	var broadcaster = window.document.createElementNS(NS, "broadcaster");
	broadcaster.id = "greasyscripts_broadcaster";
	broadcaster.setAttribute("label", stringBundle.GetStringFromName("scripts_from") + " Greasy Fork");
	broadcaster.setAttribute("oncommand", "greasyscripts.openScriptsLink(window);");

	// add the broadcaster
	var broadcasterset = window.document.getElementById("mainBroadcasterSet");
	broadcasterset.appendChild(broadcaster);
}

function removeBroadcaster(window) {
	// remove the broadcaster
	var broadcaster = window.document.getElementById("greasyscripts_broadcaster");
	broadcaster.parentNode.removeChild(broadcaster);

	// remove the exposed greasyscripts object from the window
	delete window.greasyscripts;
}


function addMenuitems(window, provider) {
	// create a menuitem which observes the broadcaster
	const NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
	var menuitem = window.document.createElementNS(NS, "menuitem");
	menuitem.classList.add("greasyscripts_menuitem");
	menuitem.setAttribute("observes", "greasyscripts_broadcaster");

	// append the menuitem in all locations the current integration provider offers
	integrationProviders[provider ? provider : preferences.provider].addMenuitems(window.document, menuitem);
}

function removeMenuitems(window, provider) {
	// remove all menuitems that were inserted for the current provider
	integrationProviders[provider ? provider : preferences.provider].removeMenuitems(window.document);
	// unhighlight the toolbarbutton
	integrationProviders[provider ? provider : preferences.provider].unhighlight(window.document);
}


function addListeners(window) {
	switch (preferences.mode) {
		case 1: // progress listener to detect location changes; update scripts count constantly
			window.gBrowser.addProgressListener(progressListener);
			break;
		case 2: // event listener for menupopups; update scripts count only when the popup is opened
			var menuitems = integrationProviders[preferences.provider].getMenuitems(window.document);
			for (var i = 0; i < menuitems.length; i++) {
				menuitems[i].parentNode.addEventListener("popupshowing", event_popupshowing, false);
				menuitems[i].parentNode.addEventListener("popuphiding", event_popuphiding, false);
			}
			break;
		case 3: // none; never update scripts count
			break;
	}
}

function removeListeners(window) {
	// remove listeners regardless of whether they were added or not; in the worst case the call fails silently
	window.gBrowser.removeProgressListener(progressListener);

	var menuitems = integrationProviders[preferences.provider].getMenuitems(window.document);
	for (var i = 0; i < menuitems.length; i++) {
		menuitems[i].parentNode.removeEventListener("popupshowing", event_popupshowing, false);
		menuitems[i].parentNode.removeEventListener("popuphiding", event_popuphiding, false);
	}
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


this.preferencesObserver = {};
this.preferencesObserverCallback = function(preferenceName) {
	switch (preferenceName) {
		case preferences.prefs.PROVIDER.name:
			// don't do anything on startup
			if (preferences.previousProvider === "") {
				preferences.previousProvider = preferences.provider;
				return;
			}

			// remove the menuitems of the previous provider / add the menuitems of the new provider
			utils.forWindows(function(window) {
				if (preferences.previousProvider)
					removeMenuitems(window, preferences.previousProvider);
				addMenuitems(window);
			});
			preferences.previousProvider = preferences.provider;
			break;

		case preferences.prefs.HIGHLIGHT.name:
			// make sure all buttons in all windows are unhighlighted if highlighting was disabled
			if (!preferences.highlight) {
				utils.forWindows(function(window) {
					integrationProviders[preferences.provider].unhighlight(window.document);
				});
			}
			break;

		case preferences.prefs.HIGHLIGHT_COLOR.name:
			updateDynamicCSS();
			break;

		case preferences.prefs.MODE.name:
			utils.forWindows(function(window) {
				// re-register the listeners according to mode
				removeListeners(window);
				addListeners(window);
				// unhighlight the button for unsupported modes (all except mode 1)
				if (preferences.mode != 1)
					integrationProviders[preferences.provider].unhighlight(window.document);
			});
			break;

		case preferences.prefs.CACHE_ENABLED.name:
			// delete the domain cache
			cache = {};
			break;
	}
};


function removeDynamicCSS() {
	if(dataURI) {
		var sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
		var ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
		var uri = ios.newURI(dataURI, null, null);
		sss.unregisterSheet(uri, sss.AGENT_SHEET);
		dataURI = "";
	}
}

function addDynamicCSS() {
	var callback = 	function(css) {
		// get the RGB color values from preferences
		var rgb = preferences.highlightColor;
		var rgbString = rgb[0] + "," + rgb[1] + "," + rgb[2];
		var backgroundImage = "-moz-linear-gradient(center top , rgba(" + rgbString + ",0.1), rgba(" + rgbString + ",1))";
		
		// build the CSS data: URI
		css = css.replace(/%background-image%/, backgroundImage);
		css = "data:text/css;charset=utf-8," + encodeURIComponent(css);
		dataURI = css; // store dataURI to be able to remove the style sheet later;

		// add the style sheet
		var sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
		var ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
		var uri = ios.newURI(css, null, null);
		sss.loadAndRegisterSheet(uri, sss.AGENT_SHEET);
	};

	// read the CSS file and apply dynamic changes asynchronously
	utils.httpRequest("chrome://greasyscripts/skin/dynamic.css", "text", function() {callback(this.response);} );
}

function updateDynamicCSS() {
	removeDynamicCSS();
	addDynamicCSS();
}



this.greasyscripts = {

	openScriptsLink: function(window) {
		var domain = getDomain(window.gBrowser.currentURI);
		window.gBrowser.selectedTab = window.gBrowser.addTab("https://greasyfork.org/scripts/by-site/" + domain);
	},

	loadIntoWindow: function(window) {
		if (!window)
			return;

		// create a broadcaster that can be used to update attributes of multiple menuitems at once
		addBroadcaster(window);

		// add menuitems to the window which observe the broadcaster
		preferences.previousProvider = preferences.provider;
		addMenuitems(window);

		// add listeners to detect location changes / opening of menus / etc.
		addListeners(window);
	},

	unloadFromWindow: function(window) {
		if (!window)
			return;

		// remove listeners
		removeListeners(window);

		// remove all menuitems
		removeMenuitems(window);

		// remove the broadcaster
		removeBroadcaster(window);
	},

	init: function() {
		// string bundle for translations
		stringBundle = Services.strings.createBundle("chrome://greasyscripts/locale/greasyscripts.properties");

		// import add-on modules
		Cu.import("chrome://greasyscripts/content/utils.jsm");
		Cu.import("chrome://greasyscripts/content/preferences.jsm");
		Cu.import("chrome://greasyscripts/content/integrationProviders.jsm");

		// register preferences observer
		preferencesObserver = new PreferencesObserver(preferencesObserverCallback);
		preferencesObserver.register();

		// register style sheets
		utils.registerStyleSheet("chrome://greasyscripts/skin/greasyscripts.css", utils.AGENT_SHEET); // static styles
		addDynamicCSS(); // dynamic styles
	},

	unload: function() {
		// unregister style sheets
		utils.unregisterStyleSheet("chrome://greasyscripts/skin/greasyscripts.css", utils.AGENT_SHEET); // static styles
		removeDynamicCSS(); // dynamic styles

		// unregister preferences observer
		preferencesObserver.unregister();

		// unload add-on modules
		Cu.unload("chrome://greasyscripts/content/integrationProviders.jsm");
		Cu.unload("chrome://greasyscripts/content/preferences.jsm");
		Cu.unload("chrome://greasyscripts/content/utils.jsm");
	}
};