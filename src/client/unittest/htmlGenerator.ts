import {TestFile, TestSuite, TestFunction, TestStatus} from './contracts';

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

export function generateTestExplorerHtmlView(tests: TestFile[], currentStatus: TestStatus): string {
    let htmlForAllTestFiles = tests.reduce((html, testFile) => html + generateHtmlForTestFileSuite(testFile), '');
    return `
        <div>
            <ol class="ts-tree " id="">
                ${htmlForAllTestFiles}
            </ol>
        </div>
        `;
}

export function generateDiscoveringHtmlView(): string {
    return `
        <style>${DISCOVER_STYLES}<style>
        <div class ="container">
            <div>Discovering Unit Tests</div>
            <div class="spinner">
                <div class="rect1"></div>
                <div class="rect2"></div>
                <div class="rect3"></div>
                <div class="rect4"></div>
                <div class="rect5"></div>
            </div>
        </div>
        `;
}

export function generateHtmlForMenu(currentStatus: TestStatus): string {
    const runTestsMenu = `<a href="${encodeURI('command:python.runAllUnitTests')}">Run all UnitTests</a>`;
    return `
            <div>
                <span class="dropdown">
                    <span>&nbsp;[Unit Test Options]</span>
                    <div class="dropdown-content">
                        ${currentStatus !== TestStatus.Error ? runTestsMenu : ''}
                        <a href="${encodeURI('command:python.discoverUnitTests')}">Re-discover UnitTests</a>
                    </div>                
                </span>                    
            </div>
            `;
}

function generateHtmlForTestFileSuite(testFileSuite: TestSuite | TestFile): string {
    let functionHtml = testFileSuite.functions.reduce((html, fn) => html + generateHtmlForTestFunction(fn), '');
    let childTestHtml = testFileSuite.suites.reduce((html, fn) => html + generateHtmlForTestFileSuite(fn), '');

    // The property isInstance only exists on the TestSuite class and not TestFile
    let testType = (testFileSuite as any).isInstance ? 'suite' : 'file';

    return `
            <li>
                <label for="${encodeURIComponent(testFileSuite.rawName)}" 
                        title="${testFileSuite.message ? testFileSuite.message : ''}" 
                        class="parentNode">
                        ${testFileSuite.name}
                        <span class="dropdown">
                            <span>&nbsp;[Test]</span>
                            <div class="dropdown-content">
                                <a href="${encodeURI('command:python.runUnitTest?' + JSON.stringify([testType, testFileSuite.rawName]))}">Run this test</a>
                            </div>                
                        </span>                    
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
                <label class="added-async-link another-class" 
                    id="${encodeURIComponent(testFunction.rawName)}" 
                    title="${testFunction.message ? testFunction.message : ''}">
                    ${testFunction.name}
                    <span class="dropdown">
                        <span>&nbsp;[Test]</span>
                        <div class="dropdown-content">
                            <a href="${encodeURI('command:python.runUnitTest?' + JSON.stringify(['function', testFunction.rawName]))}">Run this test</a>
                        </div>                
                    </span>                    
                </label>
            </li>
            `;
}

export const DISCOVER_STYLES = `
    .container {
        margin: 100px auto;
        height: 40px;
        text-align: center;
        font-size:1.5em;
    }
    .spinner {
        margin: 0px auto;
        width: 50px;
        height: 40px;
        text-align: center;
        font-size: 10px;
    }

    .spinner > div {
        background-color: #333;
        height: 100%;
        width: 6px;
        display: inline-block;
        
        -webkit-animation: sk-stretchdelay 1.2s infinite ease-in-out;
        animation: sk-stretchdelay 1.2s infinite ease-in-out;
    }

    .spinner .rect2 {
        -webkit-animation-delay: -1.1s;
        animation-delay: -1.1s;
    }

    .spinner .rect3 {
        -webkit-animation-delay: -1.0s;
        animation-delay: -1.0s;
    }

    .spinner .rect4 {
        -webkit-animation-delay: -0.9s;
        animation-delay: -0.9s;
    }

    .spinner .rect5 {
        -webkit-animation-delay: -0.8s;
        animation-delay: -0.8s;
    }

    @-webkit-keyframes sk-stretchdelay {
        0%, 40%, 100% { -webkit-transform: scaleY(0.4) }  
        20% { -webkit-transform: scaleY(1.0) }
    }

    @keyframes sk-stretchdelay {
        0%, 40%, 100% { 
            transform: scaleY(0.4);
            -webkit-transform: scaleY(0.4);
        }  20% { 
            transform: scaleY(1.0);
            -webkit-transform: scaleY(1.0);
        }
    }
`;


const PYTHON_IMAGE_URL = `url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAABmJLR0QAAAAAAAD5Q7t/AAAACXBIWXMAAA7EAAAOxAGVKw4bAAAAB3RJTUUH4AgFAg4GqVpWBAAAAy9JREFUWMPt10toHlUUB/DfzPc1SVMroQlVY/AZpFJqRbGVasFlfGG7UBR3RRca8YEbqahQl7ooboSCbkQQ1BJclUoUX4GgTZWCUtFaRFAk1mg172+ui5k0k/km+QYT0EX/uztz5pz/Ped/z7nDefzHiKoa7nx+YsH+EtyIrbgINfyOb/EFvsf86IGutSOQBe/EQ3gU/VngPBL8jHfxEn6CVkTiisHhMTyHjzGMUOLrUjyOg7igyuZaEsiwAXvwOR7BfkysYH8brqriuF6RQJzZbsX92NZihzWsW0sCMIM+HMoCBMxmgSqLuYimD7Oa19GDthzRm7HJ0tp34glp7fOYuHj9r3cODdx9emZqc10q0HFMQ8euT8ozkFP703gQHbmADc3Cq2VEl6AR4sZdfUe3z093H5KWKsGIVDs/To/sPkeiXggOD+BZtP/btBIlnfXJ9iC63KJWrsQUBqWlQ/Mp6MK+1QUHsxvqk/Ml/vdie/5B0WCLVOmrQhKib67fdKIjhKij8Kobt8L0yO5SAv24cDXBG6F2+pbNo2/3dv6yN4jK+sy1+UXxGHZb/kiFRohPRXwZR8lZhEgIQZQEUYMQ2uK5s/ddNnRycMtre5IQ71rGT7dUvI0yAssh4PAz2145MtA7fF09nt+IOBIiqcKJiCVXB9G9SYivqJqxIoHxLNiSLCQhHju4Y//wjp6xFxqh1rfIKmcWaDTNp1L8trB7mjXwHf4sftFZnzx2U8/x2/PBV4Gv84sigZM4Ucx9e212LhK61iD4OD5lsRsWCUzgdVnLTBGJJUH1ybkSDuOr/INzGhg90LXQDd9Cr8VWHNeixhmistORSC8e0yXvaha1FPAZXsRc3mi5YVSTHpe22WSdff1veviaN97BzoL5FF6WaifO+ZvDGP7IniU4o2QYtRyjWcfaiPdLCCyM5CRbz2RZm8AdOJ4PVobV1jWSzo31OCodZB9Ib1CVfFclkGS7Wwkf4gg+kpZgtpVTqnfCv/Ge9FLStozNoHSYDWRZ+GFNMpCr4at4StonyrLRj3swhCfxVxUCle9ymRgj6c/IDcp/TI7hFBqtxHce/xv8A/Mv5tF2XUuzAAAAJXRFWHRkYXRlOmNyZWF0ZQAyMDE2LTA4LTA1VDAyOjE0OjA2LTA0OjAw6aJOXQAAACV0RVh0ZGF0ZTptb2RpZnkAMjAxNi0wOC0wNVQwMjoxNDowNi0wNDowMJj/9uEAAAAASUVORK5CYII=')`;

export const TREE_STYLES = `
    <style>
        .dropdown {
            position: relative;
            display: inline-block;
        }

        .dropdown-content {
            display: none;
            position: absolute;
            background-color: #f9f9f9;
            min-width: 160px;
            box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
            z-index:999;
        }

        .dropdown-content a {
            color: black;
            padding: 12px 16px;
            text-decoration: none;
            display: block;
            white-space:nowrap;
        }

        .dropdown-content a:hover {background-color: #f1f1f1}

        .dropdown:hover .dropdown-content {
            display: block;
        }

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
            margin:5px 0px 5px 0px;
            margin-left: -1.5em;
            list-style: none;
            list-style-type: none;
        }
        ol.ts-tree li.ts-file a{
            display:inline-block;
        }        
        ol.ts-tree li.ts-file a, ol.ts-tree li.ts-file label {
            display: block;
            padding-left: 1.3em;
            background-position:0;            
            background-size: 1.2em;
            text-decoration: none;
            display: block;
        }
        
        ol.ts-tree li.ts-file a.class {
            background: url(../img/icons/classIcon.svg) 0 0 no-repeat;
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
            /* Lets disable the expanding/collapsing feature for now */
            /* display: none; */
            display: block;
            margin-left: -14px !important;
            padding-left: 1px;
        }
        
        ol.ts-tree li label {
            cursor: pointer;
            display: block;
            padding-left: 1.3em;
        }
        
        ol.ts-tree li label.parentNode {
            background: ${PYTHON_IMAGE_URL} 0 0.25em no-repeat;
            background-position:0;            
            background-size: 1.2em;
        }
        
        ol.ts-tree li input:checked + ol > li {
            /* Lets disable the expanding/collapsing feature for now */
            /* display: block; */
        }
        
        ol.ts-tree li input:checked + ol > li:last-child {
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
