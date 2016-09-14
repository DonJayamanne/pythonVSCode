/// <reference path="typings/types.d.ts" />

(function () {
    function addScripts(done: Function) {
        let scripts = document.querySelectorAll('div.script');
        const scriptCount = scripts.length;
        let scriptsLoaded = 0;
        for (let counter = 0; counter < scripts.length; counter++) {
            addScriptFile(scripts[counter].innerHTML.trim(), () => {
                scriptsLoaded += 1;
                if (scriptsLoaded >= scriptCount) {
                    done();
                }
            });
        }
    }
    function evalScripts() {
        let scripts = document.querySelectorAll('div.evalScript');
        const scriptCount = scripts.length;
        let scriptsLoaded = 0;
        for (let counter = 0; counter < scripts.length; counter++) {
            eval(scripts[counter].innerHTML);
        }
    }
    function addScriptFile(scriptFilePath: string, onload: (ev: Event) => any) {
        let script = document.createElement('script');
        script.setAttribute('src', scriptFilePath.replace('/\\/g', '/'));
        document.body.appendChild(script);
        script.onload = onload;
    }

    addScripts(() => {
        evalScripts();
    });
})();
