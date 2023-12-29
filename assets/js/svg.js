(() => {
    const body = document.body;
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    // Check if user preference is set, if not check value of body class for light or dark else it means that colorscheme = auto
    if (localStorage.getItem("colorscheme")) {
        setSVGColor(localStorage.getItem("colorscheme") === "light" ? "dark" : "light")
    } else if (body.classList.contains('colorscheme-light') || body.classList.contains('colorscheme-dark')) {
        setSVGColor(body.classList.contains("colorscheme-dark") ?  "light" : "dark")
    } else {
        setSVGColor(darkModeMediaQuery.matches ?  "light" : "dark")
    }

    darkModeToggle.addEventListener('click', () => {
        const newColor = body.classList.contains("colorscheme-dark") ? "light" : "dark"
        setSVGColor(newColor)
    });

    darkModeMediaQuery.addListener((event) => {
        setSVGColor(event.matches ? "dark" : "light");
    });


    function setSVGColor(color) {
        const strokes = document.querySelectorAll(".jfet-stroke")
        const fills = document.querySelectorAll(".jfet-fill")

        const DARK = "#212121"
        const LIGHT = "#fafafa"

        if(color === "light") {
            strokes.forEach(s => {
                s.setAttribute("stroke", LIGHT)
            })
            fills.forEach(s => {
                s.setAttribute("fill", LIGHT)
            })
        } else {
            strokes.forEach(s => {
                s.setAttribute("stroke", DARK)
            })
            fills.forEach(s => {
                s.setAttribute("fill", DARK)
            })
        }
    }
})();

