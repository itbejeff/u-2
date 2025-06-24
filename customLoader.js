    document.getElementById('loaderVideo').playbackRate = 0.6;
    function hideCustomLoader() {
    const loader = document.getElementById('myCustomLoader');
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => { if (loader) loader.remove(); }, 600);
    }
    }

    // Automatically hide after a timeout (e.g., 3.5 seconds)
    setTimeout(hideCustomLoader, 3500);