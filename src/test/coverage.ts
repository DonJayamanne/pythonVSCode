
// tslint:disable:no-require-imports no-var-requires no-any no-console
const azure = require('azure-storage');
const jsonStream: JSONStream = require('JSONStream');
import * as es from 'event-stream';
import * as fs from 'fs-extra';
import * as path from 'path';

const coverageFile = path.join(__dirname, '../../coverage/coverage-summary.json');

type JSONStream = {
    parse(args: string[] | string): NodeJS.WritableStream & NodeJS.ReadableStream;
};

type Coverage = {
    total: number,
    covered: number,
    skipped: number,
    pct: number
};
type CoverageSummary = {
    lines: Coverage,
    statements: Coverage,
    functions: Coverage,
    branches: Coverage
};

function printPreviousCoverageSummary(summary: CoverageSummary) {
    const header = `${'='.repeat(25)} Previous Coverage Summary ${'='.repeat(25)}`;
    console.log(header);
    console.log(`Statements   : ${summary.statements.pct}% ( ${summary.statements.covered}/${summary.statements.total} )`);
    console.log(`Branches     : ${summary.branches.pct}% ( ${summary.branches.covered}/${summary.branches.total} )`);
    console.log(`Functions    : ${summary.functions.pct}% ( ${summary.functions.covered}/${summary.functions.total} )`);
    console.log(`Lines        : ${summary.lines.pct}% ( ${summary.lines.covered}/${summary.lines.total} )`);
    console.log('='.repeat(header.length));
}
async function getPreviousCoverage(): Promise<CoverageSummary> {
    const fileService = azure.createFileService();
    return new Promise<CoverageSummary>((resolve, reject) => {
        fileService.getFileToText('python', '', 'coverage.json', (error: Error, json: string) => {
            if (error) {
                return reject(error);
            }
            resolve(JSON.parse(json) as any as CoverageSummary);
        });
    });
}

async function getCurrentCoverage(): Promise<CoverageSummary | undefined> {
    const exists = fs.pathExists(coverageFile);
    if (!exists) {
        return;
    }

    return new Promise<CoverageSummary>((resolve, reject) => {
        const stream = fs.createReadStream(coverageFile);
        stream
            .on('error', reject)
            .pipe(jsonStream.parse('total'))
            .pipe(es.mapSync(data => {
                const propertiestoKeep: (keyof CoverageSummary)[] = ['branches', 'functions', 'lines', 'statements'];
                Object.keys(data).forEach(key => {
                    if (propertiestoKeep.indexOf(key as any) === -1) {
                        delete data[key];
                    }
                });
                resolve(data);
            }));
    });
}

async function compareCoverageReports(): Promise<void> {
    const previousSummary = await getPreviousCoverage();
    const currentSummary = await getCurrentCoverage();
    if (!previousSummary) {
        throw new Error('Previous Coverage information not found!');
    }
    if (!currentSummary) {
        throw new Error('Previous Coverage information not found!');
    }

    const errors: string[] = [];
    Object.keys(previousSummary).forEach(item => {
        const currentInfo = currentSummary[item] as Coverage;
        const previousInfo = previousSummary[item] as Coverage;
        if (currentInfo.pct < previousInfo.pct) {
            errors.push(`Coverage for '${item} is less than the previous value.`);
        }
    });

    if (errors.length > 0) {
        errors.forEach(message => console.error(message));
        printPreviousCoverageSummary(previousSummary);
        throw new Error('Failed');
    } else {
        fs.writeFileSync('coverage.json', JSON.stringify(currentSummary));
    }
}

compareCoverageReports()
    .catch((error: Error) => {
        console.error(error.message);
        process.exit(1);
    });
