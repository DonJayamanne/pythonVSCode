// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const fs = require('fs');

function updateChangeLog(){
    const filePath = './tmp/extension/CHANGELOG.md';
    const contents = fs.readFileSync(filePath).toString();
    const re = /^## \d\d\d\d\./igm;

    const startIndexFound = re.exec(contents);
    if (!startIndexFound){
        console.error('Start index not found');
        return;
    }
    const startIndex = startIndexFound.index;
    const found = re.exec(contents);

    // End at next release or the thanks section.
    const thanksIndex = contents.indexOf('### Thanks');
    if (found){
        console.info(`End index found ${found.index}`);
    } else {
        console.warn('End index not found');
    }
    const endIndex = Math.min(found ? found.index : contents.length, thanksIndex);
    console.info(`Start & end index: ${startIndex} ${endIndex}`);

    // Strip the line with the date.
    const contentsOfNewFile = contents.substring(startIndex, endIndex).split(/\r?\n/);
    contentsOfNewFile.shift();

    fs.writeFileSync(filePath, contentsOfNewFile.join('\n'));
}

updateChangeLog();