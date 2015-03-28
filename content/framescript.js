//  forward "pageshow" event to chrome content
addEventListener("pageshow", function () {sendAsyncMessage("greasyscripts:pageshow");}, false);

//  forward "pagehide" event to chrome content
addEventListener("pagehide", function (e) {sendAsyncMessage("greasyscripts:pagehide");}, true);

//  forward "TabSelect" event to chrome content if tab has finished loading (otherwise this will be catched by "pageshow" event anyway)
addMessageListener("greasyscripts:TabSelect", function() {
	if (content.document.readyState == "complete")
		sendAsyncMessage("greasyscripts:TabSelect");
});