(() => {
    const body = document.body;
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');



    addEventListener('message', event => {
        // attendo che si sia caricato utterances
        if (event.origin !== 'https://utteranc.es') {
            return;
        }

        setTimeout(() => {
            if (localStorage.getItem("colorscheme")) {
                setUttColor(localStorage.getItem("colorscheme") === "light" ? "dark" : "light")
            } else if (body.classList.contains('colorscheme-light') || body.classList.contains('colorscheme-dark')) {
                setUttColor(body.classList.contains("colorscheme-dark") ? "light" : "dark")
            } else {
                setUttColor(darkModeMediaQuery.matches ? "light" : "dark")
            }
        }, 0)
        
    });

    darkModeToggle.addEventListener('click', () => {
        const newColor = body.classList.contains("colorscheme-dark") ? "light" : "dark"
        setUttColor(newColor)
    });

    darkModeMediaQuery.addListener((event) => {
        setUttColor(event.matches ? "dark" : "light");
    });


    function setUttColor(color) {

        const [utt] = [...document.querySelectorAll("iframe.utterances-frame")]

        const message = {
            type: 'set-theme',
            theme: `github-${color}`,
        };

        utt.contentWindow.postMessage(message, 'https://utteranc.es');
    }
})();

