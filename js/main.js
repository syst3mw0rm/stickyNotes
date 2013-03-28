function loadHandler() {
    document.getElementById("newNoteButton").disabled = !db;
    mixpanel.track('Page loaded');
}

window.addEventListener('load', loadHandler);
