"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import("resource://gre/modules/Services.jsm");


this.EXPORTED_SYMBOLS = ["preferences"];


const TIME_FROM_UNIT = {
	"milliseconds":           1,
	"seconds":             1000,
	"minutes":          60*1000,
	"hours":         60*60*1000,
	"days":       24*60*60*1000,
	"weeks":    7*24*60*60*1000,
	"months":  30*24*60*60*1000,
	"years":  365*24*60*60*1000
}

// the list of add-on preferences with names and default values
const PREFS = {
	MODE: {name: "mode", default: 1},
	CACHE_ENABLED: {name: "cache.enabled", default: true},
	CACHE_MAX_AGE_NUM: {name: "cache.max_age.number", default: 1},
	CACHE_MAX_AGE_UNIT: {name: "cache.max_age.unit", default: "days"}
};


const PREF_BRANCH = "extensions.greasyscripts.";
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
	get mode() {
		return branch.getIntPref(PREFS.MODE.name);
	},

	get cacheEnabled() {
		return branch.getBoolPref(PREFS.CACHE_ENABLED.name);
	},

	get cacheMaxAge() {
		var unit = branch.getCharPref(PREFS.CACHE_MAX_AGE_UNIT.name)
		return branch.getIntPref(PREFS.CACHE_MAX_AGE_NUM.name) * TIME_FROM_UNIT[unit];
	}
};