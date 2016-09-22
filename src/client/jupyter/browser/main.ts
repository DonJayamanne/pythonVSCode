/// <reference path="typings/index.d.ts" />

const transformime = require('transformime');
const MarkdownTransform = require('transformime-marked');
const transform = transformime.createTransform([MarkdownTransform]) as Function;
const ResultsContainerId = 'resultsContainer';

function displayData(data: any, whiteBg: boolean): Promise<HTMLElement> {
    const container = document.getElementById(ResultsContainerId);
    if (typeof data['text/html'] === 'string') {
        data['text/html'] = data['text/html'].replace(/<\/scripts>/g, '</script>');
    }
    return transform(data).then(result => {
        // If dealing with images add them inside a div with white background
        if (whiteBg === true || Object.keys(data).some(key => key.startsWith('image/'))) {
            const div = document.createElement('div');
            div.style.backgroundColor = 'white';
            div.style.display = 'inline-block';
            div.appendChild(result.el);
            return container.appendChild(div);
        }
        else {
            return container.appendChild(result.el);
        }
    });
}

(window as any).initializeResults = (rootDirName: string, port: number, whiteBg: boolean) => {
    const results = (window as any).JUPYTER_DATA as any[];
    (window as any).__dirname = rootDirName;
    try {
        const color = decodeURIComponent(window.location.search.substring(window.location.search.indexOf('?color=') + 7, window.location.search.indexOf('&fontFamily=')));
        if (color.length > 0) {
            window.document.body.style.color = color;
        }
        const fontFamily = decodeURIComponent(window.location.search.substring(window.location.search.indexOf('&fontFamily=') + 12));
        if (fontFamily.length > 0) {
            window.document.body.style.fontFamily = fontFamily;
        }
    }
    catch (ex) {
    }

    document.getElementById('clearResults').addEventListener('click', () => {
        document.getElementById(ResultsContainerId).innerHTML = '';
    });

    try {
        if (typeof port === 'number' && port > 0) {
            var socket = (window as any).io.connect('http://localhost:' + port);
            socket.on('results', (results: any[]) => {
                const promises = results.map(data => displayData(data, whiteBg));
                Promise.all<HTMLElement>(promises).then(elements => {
                    // Bring the first item into view
                    if (elements.length > 0) {
                        try {
                            elements[0].scrollIntoView(true);
                        }
                        catch (ex) {
                        }
                    }
                });
            });
            socket.on('clientExists', (data: any) => {
                socket.emit('clientExists', { id: data.id });
            });
            const displayStyleEle = document.getElementById('displayStyle') as HTMLSelectElement;
            displayStyleEle.addEventListener('change', () => {
                socket.emit('appendResults', { append: displayStyleEle.value });
            });
        }
    }
    catch (ex) {
        document.getElementById('displayStyle').style.display = 'none';

        const errorDiv = document.createElement('div');
        errorDiv.innerHTML = 'Initializing live updates for results failed with the following error:\n' + ex.message;
        errorDiv.style.color = 'red';
        document.body.appendChild(errorDiv);
    }

    const promises = results.map(data => displayData(data, whiteBg));
    Promise.all<HTMLElement>(promises).then(elements => {
        // Bring the first item into view
        if (elements.length > 0) {
            try {
                elements[0].scrollIntoView(true);
            }
            catch (ex) { }
        }
    });
};
