(() => {
    document.addEventListener("DOMContentLoaded", function () {
        const pre = [...document.querySelectorAll("pre")].find(p => p.innerText.includes(`[["a", 1], ["b", 2], ["c", {}]]`))
        pre.style['text-align'] = "center"
        pre.parentNode.style.display = "flex"
        pre.parentNode.style['justify-content'] = "center"
    });
})();

