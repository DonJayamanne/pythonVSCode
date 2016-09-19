/// <reference path="typings/index.d.ts" />

const transformime = require('transformime');
const MarkdownTransform = require('transformime-marked');
const transform = transformime.createTransform([MarkdownTransform]) as Function;

(window as any).initializeResults = () => {
    const data = (window as any).JUPYTER_DATA as any[];
    data.forEach(data => {
        if (typeof data['text/html'] === 'string') {
            data['text/html'] = data['text/html'].replace(/<\/scripts>/g, '</script>');
        }
        transform(data).then(result => {
            // If dealing with images add them inside a div with white background
            if (Object.keys(data).some(key => key.startsWith('image/'))) {
                const div = document.createElement('div');
                div.style.backgroundColor = 'white';
                div.style.display = 'inline-block';
                div.appendChild(result.el);
                document.body.appendChild(div);
            }
            else {
                document.body.appendChild(result.el);
            }
        });
    });
};
