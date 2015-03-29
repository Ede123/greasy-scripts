"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import("resource://gre/modules/Services.jsm");


this.EXPORTED_SYMBOLS = ["preferences"];


this.PREF_BRANCH = "extensions.greasyscripts.";


this.PREFS = {
	CACHE_ENABLED: {name: "cache.enabled", default: true},
	CACHE_MAX_AGE: {name: "cache.max_age", default: 24*60*60*1000 /* 24 hours */}
};


var branch = Services.prefs.getBranch(PREF_BRANCH);
var defaultBranch = Services.prefs.getDefaultBranch(PREF_BRANCH);


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

this.preferences = {
	get cacheEnabled() {
		return branch.getBoolPref(PREFS.CACHE_ENABLED.name);
	},

	set cacheEnabled(value) {
		branch.setBoolPref(PREFS.CACHE_ENABLED.name, value);
	},

	get cacheMaxAge() {
		return branch.getIntPref(PREFS.CACHE_MAX_AGE.name);
	},

	set cacheMaxAge(value) {
		branch.setIntPref(PREFS.CACHE_MAX_AGE.name, value);
	}
};