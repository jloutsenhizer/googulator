({
    appDir: "public_html",
    baseUrl: "js",
    dir: "public_html_optimized",
    removeCombined: true,
    modules: [
        {
            name: "main"
        }
    ],
    optimize: "uglify2",
    generateSourceMaps: false,
    preserveLicenseComments: false,
    uglify2:{
        warnings:true,
        mangle:false,
        output:{
            beautify:false
        },
        compress:{
            sequences: true,
            properties: true,
            dead_code: true,
            drop_debugger: true,
            conditionals: true,
            comparisons: true,
            evaluate: true,
            booleans: true,
            loops: true,
            unused: true,
            hoist_funs: true,
            if_return: true,
            join_vars: true,
            cascade: true,
            side_effects: true,
            warnings: true,
            global_defs: {},
            hoist_vars: false,
            unsafe: false
        }
    },
    optimizeCss: "standard"
})