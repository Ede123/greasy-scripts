"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/AddonManager.jsm");


this.EXPORTED_SYMBOLS = ["preferences", "PreferencesObserver"];


// get the add-ons (default) preferences branch(es)
const PREF_BRANCH = "extensions.greasyscripts.";
var branch = Services.prefs.getBranch(PREF_BRANCH);
var defaultBranch = Services.prefs.getDefaultBranch(PREF_BRANCH);

// the list of add-on preferences with names and default values
const PREFS = {
	PROVIDER: {name: "provider", default: "native"},
	HIGHLIGHT: {name: "highlight", default: true},
	HIGHLIGHT_COLOR: {name: "highlight.color", default: "#3366FF"},
	MODE: {name: "mode", default: 1},
	CACHE_ENABLED: {name: "cache.enabled", default: true},
	CACHE_MAX_AGE_NUM: {name: "cache.max_age.number", default: 1},
	CACHE_MAX_AGE_UNIT: {name: "cache.max_age.unit", default: "days"}
};

// well known add-on IDs for valid integrationProviders
const ADDON_IDs = {
	"{e4a8a97b-f2ed-450b-b12d-ee082ba24781}": "greasemonkey",
    "scriptish@erikvold.com": "scriptish"
};

// conversion factors from <unit> to milliseconds
const TIME_FROM_UNIT = {
	"milliseconds":           1,
	"seconds":             1000,
	"minutes":          60*1000,
	"hours":         60*60*1000,
	"days":       24*60*60*1000,
	"weeks":    7*24*60*60*1000,
	"months":  30*24*60*60*1000,
	"years":  365*24*60*60*1000
};



// set default preferences
function setDefaultPrefs() {
	for (let [key, val] in new Iterator(PREFS)) {
		switch (typeof val.default) {
			case "boolean":
				defaultBranch.setBoolPref(val.name, val.default);
				break;
			case "number":
				defaultBranch.setIntPref(val.name, val.default);
				break;
			case "string":
				defaultBranch.setCharPref(val.name, val.default);
				break;
		}
	}
}
setDefaultPrefs();



// check for well known integrationProviders and set default provider accordingly
var providersAvailable = {};
AddonManager.getAddonsByIDs(Object.keys(ADDON_IDs), function(addons) {
	var provider = "";
	for (var i = 0; i < addons.length; i++) {
		var addon = addons[i];
		if (addon && addon.isActive && ADDON_IDs[addon.id]) {
			provider = ADDON_IDs[addon.id];
			providersAvailable[provider] = true;
		}
	}

	// set default preference (if no integrationProvider found set to "native")
	defaultBranch.setCharPref(PREFS.PROVIDER.name, provider ? provider : "native");

	// reset user preference if chosen integrationProvider is not available anymore
	if (!providersAvailable[preferences.provider])
		branch.clearUserPref(PREFS.PROVIDER.name);
});





// setters and getters for preferences which will be exposed by this module
this.preferences = {
	prefs: PREFS,

	previousProvider: "",

	get providersAvailable() {
		return providersAvailable;
	},

	get provider() {
		return branch.getCharPref(PREFS.PROVIDER.name);
	},

	get highlight() {
		return branch.getBoolPref(PREFS.HIGHLIGHT.name);
	},
	
	get highlightColor() {
		var hex = branch.getCharPref(PREFS.HIGHLIGHT_COLOR.name);
		var rgb = [];
		rgb[0] = parseInt(hex.substr(1,2), 16);
		rgb[1] = parseInt(hex.substr(3,2), 16);
		rgb[2] = parseInt(hex.substr(5,2), 16);
		return rgb;
	},

	get mode() {
		return branch.getIntPref(PREFS.MODE.name);
	},

	get cacheEnabled() {
		return branch.getBoolPref(PREFS.CACHE_ENABLED.name);
	},

	get cacheMaxAge() {
		var unit = branch.getCharPref(PREFS.CACHE_MAX_AGE_UNIT.name);
		return branch.getIntPref(PREFS.CACHE_MAX_AGE_NUM.name) * TIME_FROM_UNIT[unit];
	}
};



// preferences observer
function PreferencesObserver(callback) {
	this._callback = callback;
}

PreferencesObserver.prototype = {
	register: function() {
		branch.addObserver("", this, false);
	},

	unregister: function() {
		branch.removeObserver("", this);
	},

	observe: function(aSubject, aTopic, aData) {
		if (aTopic == "nsPref:changed") {
			this._callback(aData);
		}
	}
};