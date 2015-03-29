"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

const console = (Cu.import("resource://gre/modules/devtools/Console.jsm", {})).console;
const XMLHttpRequest = Components.Constructor("@mozilla.org/xmlextras/xmlhttprequest;1", "nsIXMLHttpRequest");


this.EXPORTED_SYMBOLS = ["greasyscripts"];


function setText(window, text) {
	var broadcaster = window.document.getElementById("greasyscripts_broadcaster");
	broadcaster.setAttribute("acceltext", text);
}

function removeText(window) {
	var broadcaster = window.document.getElementById("greasyscripts_broadcaster");
	broadcaster.removeAttribute("acceltext");
}


function getDomain(uri) {
	var url;

	try {
		var eTLDService = Cc["@mozilla.org/network/effective-tld-service;1"].getService(Ci.nsIEffectiveTLDService);
		url = eTLDService.getBaseDomain(uri);
	}
	catch (e) {
		if (e.result == Cr.NS_ERROR_HOST_IS_IP_ADDRESS) // IP adresses (e.g http://192.168.178.1)
			url = uri.host;
		else if (uri.spec.indexOf("about:") === 0) // special pages (e.g. about:addons)
			url = uri.spec;
		else
			console.log("Error parsing URI: " + uri.spec + "\n" + e.message);
	}

	return url;
}

function updateData(window, data) {
	var count;
	
	if(data)
		count = data.count;

	if (typeof count === "undefined")
		removeText(window);
	else
		setText(window, count);
}

function updateLocation(window, uri) {
	var url = getDomain(uri);

	// ignore about:blank (since Firefox *always* loads it when opening a page in a new tab)
	// as well as invalid URIs which return an undefined URL
	if ((url == "about:blank") || (typeof url === "undefined")) {
		removeText(window);
		return;
	}

	var request = new XMLHttpRequest();
	request.open("get", "https://greasyfork.org/en/scripts/by-site/" + url + ".json?meta=1", true);
	request.responseType = "json";
	request.onload = function() {updateData(window, this.response);};
	request.onerror = function(event) {console.log(event);};
	request.send();
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
		var url = getDomain(window.gBrowser.currentURI);
		window.gBrowser.selectedTab = window.gBrowser.addTab("https://greasyfork.org/en/scripts/by-site/" + url);
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

		// create two menuitems which observe the broadcaster and append them to the GM tools menu / button
		var GM_menu = document.getElementById("gm_general_menu");
		var GM_icon = document.getElementById("greasemonkey-tbb");

		var menuitem = document.createElementNS(NS, "menuitem");
		menuitem.classList.add("greasyscripts_menuitem");
		menuitem.setAttribute("observes", "greasyscripts_broadcaster");

		var menuitems = [];
		menuitems[0] = menuitem.cloneNode(true);
		menuitems[1] = menuitem.cloneNode(true);

		var menupopup1 = GM_menu.firstChild;
		var menupopup2 = GM_icon.firstChild;
		menupopup1.insertBefore(menuitems[0], menupopup1.childNodes[3]);
		menupopup2.insertBefore(menuitems[1], menupopup2.childNodes[3]);

		// add a progress listener to detect location changes
		window.gBrowser.addProgressListener(progressListener);
	},

	unloadFromWindow(window) {
		if (!window)
			return;
		var document = window.document;

		// remove progress listener
		window.gBrowser.removeProgressListener(progressListener);

		// remove all menuitems that were inserted
		var menuitems = document.getElementsByClassName("greasyscripts_menuitem");
		for (var i = menuitems.length-1; i >= 0 ; i--) {
			menuitems[i].parentNode.removeChild(menuitems[i]);
		}

		// remove the broadcaster
		var broadcaster = document.getElementById("greasyscripts_broadcaster");
		broadcaster.parentNode.removeChild(broadcaster);

		delete window.greasyscripts;
	}
};