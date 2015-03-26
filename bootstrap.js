const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import("resource://gre/modules/Services.jsm");
const XMLHttpRequest = Components.Constructor("@mozilla.org/xmlextras/xmlhttprequest;1", "nsIXMLHttpRequest");

var greasyscripts = (function() {

	var broadcaster;
	var menuitems = [];

	var getDomain = function(uri) {
		var eTLDService = Cc["@mozilla.org/network/effective-tld-service;1"].getService(Components.interfaces.nsIEffectiveTLDService);

		try {
			url = eTLDService.getBaseDomain(uri);
		}
		catch (e) {
			// console.log(e);
			url = uri.host;
		}

		return url;
	};
	
	var updateData = function(window, data) {
		broadcaster.setAttribute("acceltext", data.count);
	};
	
	var updateLocation = function(window, uri) {
		if (uri.spec == "about:blank") {
			broadcaster.removeAttribute("acceltext");
			return;
		}
		
		var url = getDomain(window.gBrowser.currentURI);
		
		var request = new XMLHttpRequest();
		request.open("get", "https://greasyfork.org/en/scripts/by-site/" + url + ".json?meta=1", true);
		request.responseType = "json";
		request.onload = function() {updateData(window, this.response);};
		request.onerror = function(event) {console.log(event);};
		request.send();
	};

	var message_pageshow = function(message) {
		var browser = message.target; // the <browser> that received the "pageshow" message from frame content

		// only update location if the browser is the primary browser for content (which is the selected browser)
		if (browser.getAttribute("type") == "content-primary")
			updateLocation(browser.ownerGlobal, browser.currentURI);
	};

	var message_TabSelect = function(message) {
		var browser = message.target; // the <browser> that received the "pageshow" message from frame content
		updateLocation(browser.ownerGlobal, browser.currentURI);
	};

	var event_TabSelect = function(event) {
		var tab = event.target; // the <tab> that dispatched the "TabSelect" event
		tab.linkedBrowser.messageManager.sendAsyncMessage("greasyscripts:TabSelect");
	};

	var windowListener = {
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


	/** Public Methods **/
	return {
		openScriptsLink: function(window) {
			var url = getDomain(window.gBrowser.currentURI);
			window.gBrowser.selectedTab = window.gBrowser.addTab("https://greasyfork.org/en/scripts/by-site/" + url);
		},

		loadIntoWindow: function(window) {
			if (!window)
				return;
			var document = window.document;

			const NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

			// create a broadcaster that can be used to update attribute of multiple menuitems at once
			window.greasyscripts = {openScriptsLink: greasyscripts.openScriptsLink};

			broadcaster = document.createElementNS(NS, "broadcaster");
			broadcaster.id = "greasyscripts_broadcaster";
			broadcaster.setAttribute("label", "Scripts from Greasy Fork");
			broadcaster.setAttribute("oncommand", "greasyscripts.openScriptsLink(window);");

			var broadcasterset = document.getElementById("mainBroadcasterSet");
			broadcasterset.appendChild(broadcaster);

			// create two menuitems which observe the broadcaster and append them to the GM tools menu / button
			var GM_menu = document.getElementById("gm_general_menu");
			var GM_icon = document.getElementById("greasemonkey-tbb");

			var menuitem = document.createElementNS(NS, "menuitem");
			menuitem.setAttribute("observes", "greasyscripts_broadcaster");

			menuitems[0] = menuitem.cloneNode(true);
			menuitems[1] = menuitem.cloneNode(true);

			var menupopup1 = GM_menu.firstChild;
			var menupopup2 = GM_icon.firstChild;
			menupopup1.insertBefore(menuitems[0], menupopup1.childNodes[3]);
			menupopup2.insertBefore(menuitems[1], menupopup2.childNodes[3]);

			// add listeners to detect location changes
			window.gBrowser.tabContainer.addEventListener("TabSelect", event_TabSelect, false);

			window.messageManager.loadFrameScript("chrome://greasyscripts/content/framescript.js", true);
			window.messageManager.addMessageListener("greasyscripts:pageshow", message_pageshow);
			window.messageManager.addMessageListener("greasyscripts:TabSelect", message_TabSelect);
		},

		unloadFromWindow: function(window) {
			if (!window)
				return;

			// remove the listeners
			window.gBrowser.tabContainer.removeEventListener("TabSelect", event_TabSelect);

			window.messageManager.removeDelayedFrameScript("chrome://greasyscripts/content/framescript.js");
			window.messageManager.removeMessageListener("greasyscripts:pageshow", message_pageshow);
			window.messageManager.removeMessageListener("greasyscripts:TabSelect", message_TabSelect);

			// remove all menuitems that were inserted
			var menuitem;
			while (menuitem = menuitems.pop()) {
				menuitem.parentNode.removeChild(menuitem);
			}

			// remove the broadcaster
			broadcaster.parentNode.removeChild(broadcaster);
		},

		getWindowListener: function() {
			return windowListener;
		}
	};

}());




/** Bootstrap Entry Points **/

function startup(data, reason) {
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
}

function install(data, reason) {}

function uninstall(data, reason) {}