var db = null;
var synced = false;

var releaseId = "PROD1X01";

// DATABASE CONFIGURATION
var DB_NAME = "StickyNotesTest";
var DB_VERSION = "1.0";
var DB_DESCRIPTION = "Sticky Notes in HTML5 Local storage";
var DB_SIZE = 200000;

function getConnection() {
	try {
	    if (window.openDatabase) {
	        db = openDatabase(DB_NAME, DB_VERSION, DB_DESCRIPTION, DB_SIZE);
	        if (!db)
	            alert("Failed to open the database on disk. This is probably because the version was bad or there is not enough space left in this domain's quota");
	    } else {
	        alert("Couldn't open the database. It seems your browser doesn't have this feature enabled");
	    }
	} catch(err) {
	    db = null;
	    alert("Couldn't open the database.  Please try with a WebKit nightly with this feature enabled");
	}
}

// Establish Connection to database.
//window.addEventListener('load', getConnection);
getConnection();

var captured = null;
var highestZ = 0;
var highestId = 0;

function rescueDBChanges() {
	var RescuedNotes = [];
	console.log("rescuing...");
        var db2 = openDatabase("NoteTest11", "1.0", "Sticky Notes in HTML5 Local storage", 200000);
	if(db2 == null)
	console.log('Error');

	db2.transaction(function(tx) {
        tx.executeSql("SELECT id, note, timestamp, left, top, zindex, background FROM WebKitStickyNotes", [], function(tx, result) {
	        //console.log(result.rows.length);
		for (var i = 0; i < result.rows.length; ++i) {
		        var row = result.rows.item(i);
			RescuedNotes.push(row);
			console.log(row);
                 }
 		 console.log(RescuedNotes);
            }, function(tx, error) {
    	        alert('Failed to retrieve not9es from database - ' + error.message);
		return;
	    });
    	});
}

//if(localStorage.getItem("RescueNoteTest1##1")) {
//	rescueDBChanges();
//}

function newRelease() {
    db.transaction(function(tx) {
       	tx.executeSql("ALTER TABLE WebKitStickyNotes ADD COLUMN deleted BOOL", [], function(result) {
		// Added required column to table.
        }, function(tx, error) {
		console.log('Error while adding column to db');		
       	});
   });
}

if(!localStorage.getItem(releaseId)) {
	newRelease();
	localStorage.setItem(releaseId, true);
}


function Note() {
    var self = this;

    // Create a Note 
    var note = document.createElement('div');
    note.className = 'note';
    note.addEventListener('click', function() { return self.onNoteClick() }, false);
    //note.addEventListener('mouseover', function() { return self.onNoteHover() }, false);
    $(note).resizable();
    this.note = note;
 
    // Create Close button for note
    var close = document.createElement('div');
    close.className = 'closebutton';
    close.addEventListener('click', function(e) { return self.close(e) }, false);
    note.appendChild(close);
 
    var move = document.createElement('div');
    move.className = 'move';
    move.addEventListener('mousedown', function(e) { return self.onMouseDown(e) }, false);
    note.appendChild(move);

    var edit = document.createElement('div');
    edit.className = 'edit';
    edit.setAttribute('contenteditable', true);
    edit.addEventListener('keyup', function() { return self.onKeyUp() }, false);
    note.appendChild(edit);
    this.editField = edit;
 
    var ts = document.createElement('div');
    ts.className = 'timestamp';
    note.appendChild(ts);
    this.lastModified = ts;
 
    document.body.appendChild(note);
    return this;
}
 
Note.prototype = {
    get id()
    {
        if (!("_id" in this))
            this._id = 0;
        return this._id;
    },
 
    set id(x)
    {
        this._id = x;
    },
 
    get text()
    {
        return this.editField.innerHTML;
    },
 
    set text(x)
    {
        this.editField.innerHTML = x;
    },
 
    get timestamp()
    {
        if (!("_timestamp" in this))
            this._timestamp = 0;
        return this._timestamp;
    },
 
    set timestamp(x)
    {
        if (this._timestamp == x)
            return;
 
        this._timestamp = x;
        var date = new Date();
        date.setTime(parseFloat(x));
        this.lastModified.textContent = modifiedString(date);
    },
 
    get left()
    {
        return this.note.style.left;
    },
 
    set left(x)
    {
        this.note.style.left = x;
    },
 
    get top()
    {
        return this.note.style.top;
    },
 
    set top(x)
    {
        this.note.style.top = x;
    },
 
    get zIndex()
    {
        return this.note.style.zIndex;
    },
 
    set zIndex(x)
    {
        this.note.style.zIndex = x;
    },
 
    close: function(event)
    {
  	try {
		mixpanel.track('Delete Note');    
    	}
    	catch(err) {
    		console.log('mixpanel not loaded');
    	}

        this.cancelPendingSave();
        var note = this;
        db.transaction(function(tx) {
            tx.executeSql("UPDATE WebKitStickyNotes SET deleted = 1 WHERE id = ?", [note.id]);
        });
        
        var duration = event.shiftKey ? 2 : .25;
        this.note.style.webkitTransition = '-webkit-transform ' + duration + 's ease-in, opacity ' + duration + 's ease-in';
        this.note.offsetTop; // Force style recalc
        this.note.style.webkitTransformOrigin = "0 0";
        this.note.style.webkitTransform = 'skew(30deg, 0deg) scale(0)';
        this.note.style.opacity = '0';
 
        var self = this;
        setTimeout(function() { document.body.removeChild(self.note) }, duration * 1000);
    },
 
    saveSoon: function()
    {
        this.cancelPendingSave();
        var self = this;
        this._saveTimer = setTimeout(function() { self.save() }, 200);
    },
 
    cancelPendingSave: function()
    {
        if (!("_saveTimer" in this))
            return;
        clearTimeout(this._saveTimer);
        delete this._saveTimer;
    },
 
    save: function()
    {
        this.cancelPendingSave();

	// we are saving a new note...we should sync data with the server
	synced = false;

        if ("dirty" in this) {
            this.timestamp = new Date().getTime();
            delete this.dirty;
        }
 
        var note = this;
        db.transaction(function (tx)
        {
            tx.executeSql("UPDATE WebKitStickyNotes SET note = ?, timestamp = ?, left = ?, top = ?, zindex = ?, background = ?, width = ?, height = ? WHERE id = ?", [note.text, note.timestamp, note.left, note.top, note.zIndex, note.note.style.background, note.note.style.width, note.note.style.height, note.id]);
        });
    },
 
    saveAsNew: function()
    {
        this.timestamp = new Date().getTime();
        
        var note = this;
        db.transaction(function (tx) 
        {
            //console.log(note.note.style);
            tx.executeSql("INSERT INTO WebKitStickyNotes (id, note, timestamp, left, top, zindex, background, width, height) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [note.id, note.text, note.timestamp, note.left, note.top, note.zIndex, note.note.style.background, note.note.style.width, note.note.style.height]);
        }); 
    },
 
    onMouseDown: function(e)
    {
        captured = this;
	this._cur_pos = getSelection().focusOffset;

	// @TODO : better way to do it.
	this.editField.blur();   // Remove focus from the text area while moving around
	
	//e.preventDefault(); // I guess i bypassed the onNoteClick() ?

        this.startX = e.clientX - this.note.offsetLeft;
        this.startY = e.clientY - this.note.offsetTop;
        this.zIndex = ++highestZ;
 
        var self = this;
        if (!("mouseMoveHandler" in this)) {
            this.mouseMoveHandler = function(e) { return self.onMouseMove(e) }
            this.mouseUpHandler = function(e) { return self.onMouseUp(e) }
        }
 
        document.addEventListener('mousemove', this.mouseMoveHandler, true);
        document.addEventListener('mouseup', this.mouseUpHandler, true);
 
        return false;
    },
	
 
    onMouseMove: function(e)
    {
        if (this != captured)
            return true;
 
        this.left = e.clientX - this.startX + 'px';
        this.top = e.clientY - this.startY + 'px';
        return false;
    },
 
    onMouseUp: function(e)
    {
        document.removeEventListener('mousemove', this.mouseMoveHandler, true);
        document.removeEventListener('mouseup', this.mouseUpHandler, true);
	e.preventDefault(); // I guess i bypassed the onNoteClick() ?

        this.save();
        return false;
    },

    onNoteClick: function(e)
    {
	this.zIndex = ++highestZ;
	// @TODO : where should i write the strip function. 
	this.save();
	this.editField.focus();
	if(this._cur_pos) {
//		alert("Setting to " + this._cur_pos);
		selection = window.getSelection();
		selection.collapse(selection.anchorNode, this._cur_pos);
		this._cur_pos = undefined;
	}
    },

    onKeyUp: function()
    {
        this.dirty = true;
        this.saveSoon();
    },

}
 
function loaded() {
    db.transaction(function(tx) {
        tx.executeSql("SELECT COUNT(*) FROM WebkitStickyNotes", [], function(result) {
            loadNotes();
        }, function(tx, error) {
            tx.executeSql("CREATE TABLE WebKitStickyNotes (id REAL UNIQUE, note TEXT, timestamp REAL, left TEXT, top TEXT, zindex REAL, background TEXT, width REAL, height REAL)", [], function(result) { 
                loadNotes(); 
            });
        });
    });
}
 
function loadNotes() {
    try {
	mixpanel.track('loadNotes');    
    }
    catch(err) {
    	console.log('mixpanel not loaded');
    }


    db.transaction(function(tx) {
        tx.executeSql("SELECT id, note, timestamp, left, top, zindex, background, width, height, deleted FROM WebKitStickyNotes", [], function(tx, result) {
	        //console.log(result.rows.length);
		for (var i = 0; i < result.rows.length; ++i) {
		        var row = result.rows.item(i);

			// don't display deleted/completed notes.
			try {
				if(row['deleted'] == '1')
				continue;
			}
			catch (err){
				console.log(err);
			}

		        var note = new Note();
		        note.id = row['id'];
		        note.text = row['note'];
		        note.timestamp = row['timestamp'];
		        note.left = row['left'];
		        note.top = row['top'];
		        note.zIndex = row['zindex'];
		        note.note.style.background = row['background'];
	   		note.note.style.width = row['width'];
			// @TODO: Try to solve it at CSS level ?
			note.note.style.minHeight = row['height'];
		     
		        if (row['id'] > highestId)
		            highestId = row['id'];
		        if (row['zindex'] > highestZ)
		            highestZ = row['zindex'];
                 }
 
	        if (!result.rows.length)
        	   newNote();

        }, function(tx, error) {
            alert('Failed to retrieve notes from database - ' + error.message);
	    return;
       });
    });
}
 
function modifiedString(date)
{
    return 'Last Modified: ' + date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + ' ' + date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds();
}

function randomColor() {
   var Colors = ['#e85858','#90e858','#5899e8','#e058e8','#9cb8e4','#b7e49c'];
   var len = Colors.length;
  // alert(len);
   return Colors[(Math.round(Math.random() * 500))%len];
}

function newNote() {
    try {
         mixpanel.track('new Note');
    }
    catch(err) {
         console.log('mixpanel not loaded');
    }

    var note = new Note();
    note.id = ++highestId;
    note.timestamp = new Date().getTime();
    note.left = Math.round(Math.random() * 400) + 'px';
    note.top = Math.round(Math.random() * 500) + 'px';
    note.note.style.background = randomColor();
   // alert(randomColor());
    note.zIndex = ++highestZ;
    note.saveAsNew();
    // Focus the newly created note using cursor.
    note.editField.focus();;
}


function logData(content) {
    //console.log(content);
}

if (db != null) {
    addEventListener('load', loaded, false);
}

$(document).ready(function () {
    $('#newNoteButton').click(function () {
        newNote();
    });
});
