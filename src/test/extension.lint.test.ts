//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from "assert";

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";
import * as baseLinter from "../client/linters/baseLinter";
import * as pyLint from "../client/linters/pylint";
import * as pep8 from "../client/linters/pep8Linter";
import * as path from "path";
import * as settings from "../client/common/configSettings";
import * as fs from "fs-extra";
import {initialize} from "./initialize";
import {execPythonFile} from "../client/common/utils";

let pythonSettings = settings.PythonSettings.getInstance();
let ch = vscode.window.createOutputChannel("Lint");
let pythoFilesPath = path.join(__dirname, "..", "..", "src", "test", "pythonFiles", "linting");

suite("Linting", () => {
    let pylintFileToLintLines: string[] = [];
    let pyLintFileToLint = path.join(pythoFilesPath, "pylintSample.py");
    setup(done => {
        initialize().then(() => {
            pythonSettings.linting.enabled = true;
            pythonSettings.linting.pylintEnabled = true;
            if (pylintFileToLintLines.length === 0) {
                pylintFileToLintLines = fs.readFileSync(pyLintFileToLint).toString("utf-8").split(/\r?\n/g);
            }
        }).then(done, error => { assert.ok(false, error); done(); });
    });

    test("Enable Pylint", () => {
        pythonSettings.linting.pylintEnabled = true;
        let linter = new pyLint.Linter(ch, __dirname);
        assert.equal(pythonSettings.linting.pylintEnabled, linter.isEnabled());
    });
    test("Enable Pep8", () => {
        pythonSettings.linting.pep8Enabled = true;
        let linter = new pep8.Linter(ch, __dirname);
        assert.equal(pythonSettings.linting.pep8Enabled, linter.isEnabled());
    });
    test("Disable Pylint", () => {
        pythonSettings.linting.pylintEnabled = false;
        let linter = new pyLint.Linter(ch, __dirname);
        assert.equal(pythonSettings.linting.pylintEnabled, linter.isEnabled());
    });
    test("Disable Pep8", () => {
        pythonSettings.linting.pep8Enabled = false;
        let linter = new pep8.Linter(ch, __dirname);
        assert.equal(pythonSettings.linting.pep8Enabled, linter.isEnabled());
    });
    test("PyLint", done => {
        let messagesToBeReturned: baseLinter.ILintMessage[] = [
            { line: 17, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: "I0011", message: "Locally disabling unused-argument (W0613)", possibleWord: "", provider: "", type: "" },
            { line: 24, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: "I0011", message: "Locally disabling no-member (E1101)", possibleWord: "", provider: "", type: "" },
            { line: 30, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: "I0011", message: "Locally disabling no-member (E1101)", possibleWord: "", provider: "", type: "" },
            { line: 34, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: "I0012", message: "Locally enabling no-member (E1101)", possibleWord: "", provider: "", type: "" },
            { line: 40, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: "I0011", message: "Locally disabling no-member (E1101)", possibleWord: "", provider: "", type: "" },
            { line: 44, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: "I0012", message: "Locally enabling no-member (E1101)", possibleWord: "", provider: "", type: "" },
            { line: 55, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: "I0011", message: "Locally disabling no-member (E1101)", possibleWord: "", provider: "", type: "" },
            { line: 59, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: "I0012", message: "Locally enabling no-member (E1101)", possibleWord: "", provider: "", type: "" },
            { line: 62, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: "I0011", message: "Locally disabling undefined-variable (E0602)", possibleWord: "", provider: "", type: "" },
            { line: 70, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: "I0011", message: "Locally disabling no-member (E1101)", possibleWord: "", provider: "", type: "" },
            { line: 84, column: 0, severity: baseLinter.LintMessageSeverity.Information, code: "I0011", message: "Locally disabling no-member (E1101)", possibleWord: "", provider: "", type: "" },
            { line: 87, column: 0, severity: baseLinter.LintMessageSeverity.Hint, code: "C0304", message: "Final newline missing", possibleWord: "", provider: "", type: "" },
            { line: 1, column: 0, severity: baseLinter.LintMessageSeverity.Hint, code: "C0103", message: "Invalid module name \"pylintSample\"", possibleWord: "", provider: "", type: "" },
            { line: 11, column: 20, severity: baseLinter.LintMessageSeverity.Warning, code: "W0613", message: "Unused argument 'arg'", possibleWord: "", provider: "", type: "" },
            { line: 26, column: 14, severity: baseLinter.LintMessageSeverity.Error, code: "E1101", message: "Instance of 'Foo' has no 'blop' member", possibleWord: "", provider: "", type: "" },
            { line: 36, column: 14, severity: baseLinter.LintMessageSeverity.Error, code: "E1101", message: "Instance of 'Foo' has no 'blip' member", possibleWord: "", provider: "", type: "" },
            { line: 46, column: 18, severity: baseLinter.LintMessageSeverity.Error, code: "E1101", message: "Instance of 'Foo' has no 'blip' member", possibleWord: "", provider: "", type: "" },
            { line: 61, column: 18, severity: baseLinter.LintMessageSeverity.Error, code: "E1101", message: "Instance of 'Foo' has no 'blip' member", possibleWord: "", provider: "", type: "" },
            { line: 72, column: 18, severity: baseLinter.LintMessageSeverity.Error, code: "E1101", message: "Instance of 'Foo' has no 'blip' member", possibleWord: "", provider: "", type: "" },
            { line: 75, column: 18, severity: baseLinter.LintMessageSeverity.Error, code: "E1101", message: "Instance of 'Foo' has no 'blip' member", possibleWord: "", provider: "", type: "" },
            { line: 77, column: 14, severity: baseLinter.LintMessageSeverity.Error, code: "E1101", message: "Instance of 'Foo' has no 'blip' member", possibleWord: "", provider: "", type: "" },
            { line: 83, column: 14, severity: baseLinter.LintMessageSeverity.Error, code: "E1101", message: "Instance of 'Foo' has no 'blip' member", possibleWord: "", provider: "", type: "" }
        ];
        let linter = new pyLint.Linter(ch, __dirname);
        return linter.runLinter(pyLintFileToLint, pylintFileToLintLines).then(messages => {
            assert.equal(messagesToBeReturned.length, messages.length, "Incorrect number of errors");
            messagesToBeReturned.forEach(msg => {
                let similarMessages = messages.filter(m => m.code === msg.code && m.column === msg.column &&
                    m.line === msg.line && m.message === msg.message && m.severity === msg.severity);
                assert.equal(1, similarMessages.length, "Error not found, " + JSON.stringify(msg));
            });
        }).then(done, done);
    });
    test("PyLint with config in root", done => {
        let messagesToBeReturned: baseLinter.ILintMessage[] = [
            { line: 26, column: 14, severity: baseLinter.LintMessageSeverity.Error, code: "E1101", message: "Instance of 'Foo' has no 'blop' member", possibleWord: "", provider: "", type: "" },
            { line: 36, column: 14, severity: baseLinter.LintMessageSeverity.Error, code: "E1101", message: "Instance of 'Foo' has no 'blip' member", possibleWord: "", provider: "", type: "" },
            { line: 46, column: 18, severity: baseLinter.LintMessageSeverity.Error, code: "E1101", message: "Instance of 'Foo' has no 'blip' member", possibleWord: "", provider: "", type: "" },
            { line: 61, column: 18, severity: baseLinter.LintMessageSeverity.Error, code: "E1101", message: "Instance of 'Foo' has no 'blip' member", possibleWord: "", provider: "", type: "" },
            { line: 72, column: 18, severity: baseLinter.LintMessageSeverity.Error, code: "E1101", message: "Instance of 'Foo' has no 'blip' member", possibleWord: "", provider: "", type: "" },
            { line: 75, column: 18, severity: baseLinter.LintMessageSeverity.Error, code: "E1101", message: "Instance of 'Foo' has no 'blip' member", possibleWord: "", provider: "", type: "" },
            { line: 77, column: 14, severity: baseLinter.LintMessageSeverity.Error, code: "E1101", message: "Instance of 'Foo' has no 'blip' member", possibleWord: "", provider: "", type: "" },
            { line: 83, column: 14, severity: baseLinter.LintMessageSeverity.Error, code: "E1101", message: "Instance of 'Foo' has no 'blip' member", possibleWord: "", provider: "", type: "" }
        ];
        let rootDirContainingConfig = path.join(__dirname, "..", "..", "src", "test", "pythonFiles", "linting", "pylintcfg");
        let linter = new pyLint.Linter(ch, rootDirContainingConfig);
        return linter.runLinter(pyLintFileToLint, pylintFileToLintLines).then(messages => {
            assert.equal(messagesToBeReturned.length, messages.length, "Incorrect number of errors");
            messagesToBeReturned.forEach(msg => {
                let similarMessages = messages.filter(m => m.code === msg.code && m.column === msg.column &&
                    m.line === msg.line && m.message === msg.message && m.severity === msg.severity);
                assert.equal(1, similarMessages.length, "Error not found, " + JSON.stringify(msg));
            });
        }).then(done, done);
    });
});