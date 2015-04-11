"use strict";


this.EXPORTED_SYMBOLS = ["integrationProviders"];


var IntegrationProvider = function(menuitemID) {
	this.menuitemID = menuitemID;
	this.menupopupParents = [];
	this.menuitemInsertBefore = [];
	this.toolbarbuttonID = "";
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
};

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

IntegrationProvider.prototype.highlight = function(document) {
	if (this.toolbarbuttonID) {
		var toolbarbutton = document.getElementById(this.toolbarbuttonID);
		toolbarbutton.classList.add("greasyscripts_highlighted");
	}
};

IntegrationProvider.prototype.unhighlight = function(document) {
	if (this.toolbarbuttonID) {
		var toolbarbutton = document.getElementById(this.toolbarbuttonID);
		toolbarbutton.classList.remove("greasyscripts_highlighted");
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
greasemonkey.toolbarbuttonID = "greasemonkey-tbb";

// Scriptish (https://addons.mozilla.org/addon/scriptish/)
var scriptish = new IntegrationProvider("greasyscripts_menuitem");
scriptish.menupopupParents = ["scriptish_general_menu" /* the Scriptish menu in tools menu */,
                              "scriptish-button" /* the Scriptish toolbarbutton */];
scriptish.menuitemInsertBefore = ["scriptish-tools-show-us", "scriptish-tb-new-us"];
scriptish.toolbarbuttonID = "scriptish-button";



this.integrationProviders = {
	"native": native,
	"greasemonkey": greasemonkey,
	"scriptish": scriptish
};