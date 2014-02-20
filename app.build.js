({
    appDir: "public_html",
    baseUrl: "js",
    dir: "public_html_optimized",
    optimize: "closure",
    modules: [
        {
            name: "main"
        }
    ],
    closure:{
        loggingLevel: "WARNING",
        CompilationLevel: "SIMPLE_OPTIMIZATIONS",
        CompilerOptions:{
            languageIn: Packages.com.google.javascript.jscomp.CompilerOptions.LanguageMode.ECMASCRIPT5
        }
    },
    removeCombined: true
})