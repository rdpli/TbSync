"use strict";

Components.utils.import("chrome://tbsync/content/tbsync.jsm");

var tbSyncMessenger = {

    syncSteps: 0,
    statusLastUpdated: 0,
    
    onload: function () {
        let observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
        observerService.addObserver(tbSyncMessenger.syncstateObserver, "tbsync.changedSyncstate", false);

        tbSync.init("messenger");
        tbSyncMessenger.syncTimer.start();
        
        if (document.getElementById("calendar-synchronize-button")) {
            document.getElementById("calendar-synchronize-button").addEventListener("command", tbSyncMessenger.ligthningSyncRequest, false);
        }
    },

    ligthningSyncRequest: function() {
        if (tbSync.enabled) tbSync.syncAccount('sync'); else tbSyncMessenger.popupNotEnabled();
    },
    
    openAccountManager: function () {
        // check, if a window is already open and just put it in focus
        if (tbSync.prefWindowObj === null) tbSync.prefWindowObj = window.open("chrome://tbsync/content/accountManager.xul", "TbSyncAccountManagerWindow", "chrome,centerscreen,toolbar,resizable");
        tbSync.prefWindowObj.focus();
    },

    popupNotEnabled: function () {
        alert(tbSync.getLocalizedMessage("error.init"));
    },


    /* * *
    * Observer to catch changing syncstate and to update the status bar.
    */
    syncstateObserver: {
        observe: function (aSubject, aTopic, aData) {
            //update status bar
            let status = document.getElementById("tbsync.status");
            if (status) {

                let label = "TbSync: ";
                
                //check if any account is syncing, if not switch to idle
                let accounts = tbSync.db.getAccounts();
                let idle = true;
                for (let i=0; i<accounts.IDs.length && idle; i++) {
                    let state = tbSync.getSyncData(accounts.IDs[i], "state");
                    idle = (state == "accountdone" || state == "");
                }

                if (idle) {
                    label += tbSync.getLocalizedMessage("syncstate.idle");   
                    status.label = label;      
                    tbSyncMessenger.syncSteps = 0;                    
                } else if ((Date.now() - tbSyncMessenger.statusLastUpdated) > 400) {
                    //only update if status was unchanged for 1s (otherwise progressbar "jumps")
                    
                    let syncLabelLength = 8;
                    if (tbSyncMessenger.syncSteps > syncLabelLength) tbSyncMessenger.syncSteps = 0;                    
                    for (let i = 0; !(i > syncLabelLength); i++) {
                        if (i == tbSyncMessenger.syncSteps) label +=  ":";
                        else label +=  ".";
                    }                    
                    tbSyncMessenger.syncSteps++;
                    tbSyncMessenger.statusLastUpdated = Date.now();
                    status.label = label;
                }

                //TODO check if error and print in status, so that the user can check account manager for detailed error info
            }
        }
    },



    syncTimer: {
        timer: Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer),

        start: function () {
            this.timer.cancel();
            this.timer.initWithCallback(this.event, 60000, 3); //run timer every 60s
        },

        event: {
            notify: function (timer) {
                if (tbSync.enabled) {
                    //get all accounts and check, which one needs sync (accounts array is without order, extract keys (ids) and loop over them)
                    let accounts = tbSync.db.getAccounts();
                    for (let i=0; i<accounts.IDs.length; i++) {
                        let syncInterval = accounts.data[accounts.IDs[i]].autosync * 60 * 1000;
                        let lastsynctime = accounts.data[accounts.IDs[i]].lastsynctime;
                        
                        if (accounts.data[accounts.IDs[i]].state == "connected" && (syncInterval > 0) && ((Date.now() - lastsynctime) > syncInterval) ) {
                        tbSync.syncAccount("sync",accounts.IDs[i]);
                        }
                    }
                }
            }
        }
    }
};

window.addEventListener("load", tbSyncMessenger.onload, false);
window.addEventListener("unload", tbSync.unload, false);
