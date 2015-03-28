"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
const console = (Components.utils.import("resource://gre/modules/devtools/Console.jsm", {})).console;
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
	var eTLDService = Cc["@mozilla.org/network/effective-tld-service;1"].getService(Ci.nsIEffectiveTLDService);

	var url;
	try {
		url = eTLDService.getBaseDomain(uri);
	}
	catch (e) {
		// console.log(e);
		url = uri.host;
	}

	return url;
}

function updateData(window, data) {
	setText(window, data.count)
}

function updateLocation(window, uri) {
	if (uri.spec == "about:blank") {
		removeText(window);
		return;
	}
	
	var url = getDomain(window.gBrowser.currentURI);
	
	var request = new XMLHttpRequest();
	request.open("get", "https://greasyfork.org/en/scripts/by-site/" + url + ".json?meta=1", true);
	request.responseType = "json";
	request.onload = function() {updateData(window, this.response);};
	request.onerror = function(event) {console.log(event);};
	request.send();
}


function message_pagehide(message) {
	var browser = message.target; // the <browser> that received the "pagehide" message from frame content

	// only remove text if the browser is the primary browser for content (which is the selected browser)
	if (browser.getAttribute("type") == "content-primary")
		removeText(browser.ownerGlobal);
}

function message_pageshow(message) {
	var browser = message.target; // the <browser> that received the "pageshow" message from frame content

	// only update location if the browser is the primary browser for content (which is the selected browser)
	if (browser.getAttribute("type") == "content-primary")
		updateLocation(browser.ownerGlobal, browser.currentURI);
}

function message_TabSelect(message) {
	var browser = message.target; // the <browser> that received the "pageshow" message from frame content

	updateLocation(browser.ownerGlobal, browser.currentURI);
}

function event_TabSelect(event) {
	var tab = event.target; // the <tab> that dispatched the "TabSelect" event

	// remove count when switching tabs
	removeText(tab.ownerGlobal);

	tab.linkedBrowser.messageManager.sendAsyncMessage("greasyscripts:TabSelect");
}


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

		// add listeners to detect location changes
		window.gBrowser.tabContainer.addEventListener("TabSelect", event_TabSelect, false);

		window.messageManager.loadFrameScript("chrome://greasyscripts/content/framescript.js", true);
		window.messageManager.addMessageListener("greasyscripts:pagehide", message_pagehide);
		window.messageManager.addMessageListener("greasyscripts:pageshow", message_pageshow);
		window.messageManager.addMessageListener("greasyscripts:TabSelect", message_TabSelect);
	},

	unloadFromWindow(window) {
		if (!window)
			return;
		var document = window.document;

		// remove the listeners
		window.gBrowser.tabContainer.removeEventListener("TabSelect", event_TabSelect);

		window.messageManager.removeDelayedFrameScript("chrome://greasyscripts/content/framescript.js");
		window.messageManager.removeMessageListener("greasyscripts:pagehide", message_pagehide);
		window.messageManager.removeMessageListener("greasyscripts:pageshow", message_pageshow);
		window.messageManager.removeMessageListener("greasyscripts:TabSelect", message_TabSelect);

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