const liveReloadEvents = new EventSource('/__live-reload');
liveReloadEvents.addEventListener('reload', () => window.location.reload());
