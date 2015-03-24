const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import("resource://gre/modules/Services.jsm");

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
			broadcaster = document.createElementNS(NS, "broadcaster");
			broadcaster.id = "greasyscripts_broadcaster";
			broadcaster.setAttribute("label", "Scripts from Greasy Fork");

			var broadcasterset = document.getElementById("mainBroadcasterSet");
			broadcasterset.appendChild(broadcaster);

			// create two menuitems which observe the broadcaster and append them to the GM tools menu / button
			var GM_menu = document.getElementById("gm_general_menu");
			var GM_icon = document.getElementById("greasemonkey-tbb");

			var menuitem = document.createElementNS(NS, "menuitem");
			menuitem.setAttribute("observes", "greasyscripts_broadcaster");

			menuitems[0] = menuitem.cloneNode(true);
			menuitems[1] = menuitem.cloneNode(true);
			menuitems[0].addEventListener("command", function() {greasyscripts.openScriptsLink(window);}, false);
			menuitems[1].addEventListener("command", function() {greasyscripts.openScriptsLink(window);}, false);

			var menupopup1 = GM_menu.firstChild;
			var menupopup2 = GM_icon.firstChild;
			menupopup1.insertBefore(menuitems[0], menupopup1.childNodes[3]);
			menupopup2.insertBefore(menuitems[1], menupopup2.childNodes[3]);
		},

		unloadFromWindow: function(window) {
			if (!window)
				return;

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