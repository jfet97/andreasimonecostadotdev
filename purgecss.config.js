module.exports = {
    content: [
        "./src/**/*.vue",
        "./src/**/*.js",
        "./src/**/*.jsx",
        "./src/**/*.html",
        "./src/**/*.pug",
        "./src/**/*.md",
    ],
    defaultExtractor: content => content.match(/[A-Za-z0-9-_:/]+/g) || []
};