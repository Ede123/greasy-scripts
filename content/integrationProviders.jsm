"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
const console = (Cu.import("resource://gre/modules/devtools/Console.jsm", {})).console;

this.EXPORTED_SYMBOLS = ["integrationProviders"];



var IntegrationProvider = function(menuitemID) {
	this.menuitemID = menuitemID;
	this.menupopupParents = [];
	this.menuitemInsertBefore = [];
};

IntegrationProvider.prototype.beforeItem = function(menupopup, spec) {
	var beforeItem;
	switch (typeof spec) {
      case "number":
        beforeItem = menupopup.childNodes[spec];
        break;
      case "string":
        beforeItem = menupopup.getElementsByAttribute("id", spec)[0];
        break;
    }
	return beforeItem;
}

IntegrationProvider.prototype.addMenuitems = function(document, menuitemMaster) {
	for (var i = 0; i < this.menupopupParents.length; i++) {
		var menupopupParent = document.getElementById(this.menupopupParents[i]);

		var menupopup = menupopupParent.firstChild;
		var menuitem = menuitemMaster.cloneNode(true);
		var beforeItem = this.beforeItem(menupopup, this.menuitemInsertBefore[i]);

		menupopup.insertBefore(menuitem, beforeItem);
	}
};

IntegrationProvider.prototype.getMenuitems = function(document) {
	return document.getElementsByClassName(this.menuitemID);
};

IntegrationProvider.prototype.removeMenuitems = function(document) {
	var menuitems = this.getMenuitems(document);

	for (var i = menuitems.length-1; i >= 0; i--) {
		menuitems[i].parentNode.removeChild(menuitems[i]);
	}
};



// the "native" service provider, that is Firefox without any specific add-on installed
var native = new IntegrationProvider("greasyscripts_menuitem");
native.menupopupParents = ["tools-menu" /* the tools menu */];
native.menuitemInsertBefore = ["prefSep"];

// Greasemonkey (https://addons.mozilla.org/addon/greasemonkey/)
var greasemonkey = new IntegrationProvider("greasyscripts_menuitem");
greasemonkey.menupopupParents = ["gm_general_menu" /* the GM menu in tools menu */, 
                                 "greasemonkey-tbb" /* the GM toolbarbutton */];
greasemonkey.menuitemInsertBefore = [3, 3];



this.integrationProviders = {
	"native": native,
	"greasemonkey": greasemonkey
};