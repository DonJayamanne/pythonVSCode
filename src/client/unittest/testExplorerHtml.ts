import {TestFile, TestSuite, TestFunction} from './contracts';

export function generateErrorView(message: string, error: String | Error): string {
    let errorDetails = '';
    if (error && typeof error === 'object') {
        let ex = error as Error;
        errorDetails = `${ex.message}\n${ex.stack}`;
    }
    if (typeof error === 'string') {
        errorDetails = error + '';
    }
    return `
            <style>
            .message, .details {
                color:red;
            }
            .message {
                font-weight:bold;
            }
            </style>
            <body>
                <div class="message">${message}</div><br/>
                <div class="details">${errorDetails}</details>
            </body>`;

}

export function generateTestExplorerHtmlView(tests: TestFile[]): string {
    let htmlForAllTestFiles = tests.reduce((html, testFile) => html + generateHtmlForTestFileSuite(testFile), '');
    return `
    ${TREE_STYLE}
    <body>
        <div>
            <ol class="ts-tree " id="">
                ${htmlForAllTestFiles}
            </ol>
        </div>
    </body>`;
}

function generateHtmlForTestFileSuite(testFileSuite: TestSuite | TestFile): string {
    let functionHtml = testFileSuite.functions.reduce((html, fn) => html + generateHtmlForTestFunction(fn), '');
    let childTestHtml = testFileSuite.suites.reduce((html, fn) => html + generateHtmlForTestFileSuite(fn), '');

    return `
            <li>
                <label for="${encodeURIComponent(testFileSuite.rawName)}" 
                        title="${testFileSuite.message}">${testFileSuite.name}
                </label>
                <input type="checkbox" id="${encodeURIComponent(testFileSuite.rawName)}">
                <ol>
                    ${functionHtml}
                    ${childTestHtml}
                </ol>
            </li>
            `;
}

function generateHtmlForTestFunction(testFunction: TestFunction): string {
    // <li class="ts-file "><a class="added-async-link another-class" id="file3" title="this is a file link" href="#mainlink">File Main 3</a></li>

    return `
            <li class="ts-file ">
                <a class="added-async-link another-class" 
                    id="${encodeURIComponent(testFunction.rawName)}" 
                    title="${testFunction.message}" href="#mainlink">
                    ${testFunction.name}
                </a>
            </li>
            `;
}
const TREE_STYLE = `
    <style>
        ol.ts-tree {
            padding: 0 0 0 1.5em;
        }
        
        ol.ts-tree body,
        ol.ts-tree form,
        ol.ts-tree ul,
        ol.ts-tree li,
        ol.ts-tree p,
        ol.ts-tree h1,
        ol.ts-tree h2,
        ol.ts-tree h3,
        ol.ts-tree h4,
        ol.ts-tree h5 {
            margin: 0;
            padding: 0;
        }
        
        ol.ts-tree img {
            border: none;
        }
        
        ol.ts-tree p {
            margin: 0 0 1em 0;
        }
        
        ol.ts-tree li {
            position: relative;
            margin-left: -1.5em;
            list-style: none;
            list-style-type: none;
        }
        
        ol.ts-tree li.ts-file a {
            background: url(../img/icons/icon-document.svg) 0 0.25em no-repeat;
            padding-left: 2em;
            text-decoration: none;
            display: block;
            background-size: 1.5em;
        }
        
        ol.ts-tree li.ts-file a[href*='.pdf'] {
            background: url(../img/icons/icon-document.svg) 0 0 no-repeat;
        }
        
        ol.ts-tree li.ts-file a[href*='.html'] {
            background: url(../img/icons/icon-document.svg) 0 0 no-repeat;
        }
        
        ol.ts-tree li.ts-file a[href$='.css'] {
            background: url(../img/icons/icon-document.svg) 0 0 no-repeat;
        }
        
        ol.ts-tree li.ts-file a[href$='.js'] {
            background: url(../img/icons/icon-document.svg) 0 0 no-repeat;
        }
        
        ol.ts-tree li input {
            position: absolute;
            left: 0;
            margin-left: 0;
            opacity: 0;
            z-index: 2;
            cursor: pointer;
            height: 1em;
            width: 1em;
            top: 0;
        }
        
        ol.ts-tree li input + ol > li {
            display: none;
            margin-left: -14px !important;
            padding-left: 1px;
        }
        
        ol.ts-tree li label {
            background: url(../img/icons/icon-folder.svg) 0 0.25em no-repeat;
            cursor: pointer;
            display: block;
            padding-left: 2em;
            background-size: 1.5em;
        }
        
        ol.ts-tree li input:checked + ol > li {
            display: block;
            margin: 0 0 0.125em;
            /* 2px */
        }
        
        ol.ts-tree li input:checked + ol > li:last-child {
            margin: 0 0 0.063em;
            /* 1px */
        }
        
        ol.ts-tree.ts-tree-no-icon li.ts-file a {
            background: none;
            padding-left: 0;
        }
        
        ol.ts-tree.ts-tree-no-icon li label {
            background: none;
            padding-left: 0;
        }
    </style>
`;