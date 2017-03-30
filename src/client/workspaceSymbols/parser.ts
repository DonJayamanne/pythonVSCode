import * as vscode from 'vscode';
import { Tag } from './contracts';
import * as path from 'path';
import { PythonSettings } from '../common/configSettings';
import { fsExistsAsync } from '../common/utils';

const LineByLineReader = require("line-by-line");
const NamedRegexp = require('named-js-regexp');
const fuzzy = require('fuzzy');

const pythonSettings = PythonSettings.getInstance();
const IsFileRegEx = /\tkind:file\tline:\d+$/g;
const LINE_REGEX = '(?<name>\\w+)\\t(?<file>.*)\\t\\/\\^(?<code>.*)\\$\\/;"\\tkind:(?<type>\\w+)\\tline:(?<line>\\d+)$';

export interface IRegexGroup {
    name: string;
    file: string;
    code: string;
    type: string;
    line: number;
}

export function matchNamedRegEx(data, regex): IRegexGroup {
    let compiledRegexp = NamedRegexp(regex, 'g');
    let rawMatch = compiledRegexp.exec(data);
    if (rawMatch !== null) {
        return <IRegexGroup>rawMatch.groups();
    }

    return null;
}

const CTagKinMapping = new Map<string, vscode.SymbolKind>();
CTagKinMapping.set('_array', vscode.SymbolKind.Array);
CTagKinMapping.set('_boolean', vscode.SymbolKind.Boolean);
CTagKinMapping.set('_class', vscode.SymbolKind.Class);
CTagKinMapping.set('_classes', vscode.SymbolKind.Class);
CTagKinMapping.set('_constant', vscode.SymbolKind.Constant);
CTagKinMapping.set('_constants', vscode.SymbolKind.Constant);
CTagKinMapping.set('_constructor', vscode.SymbolKind.Constructor);
CTagKinMapping.set('_enum', vscode.SymbolKind.Enum);
CTagKinMapping.set('_enums', vscode.SymbolKind.Enum);
CTagKinMapping.set('_enumeration', vscode.SymbolKind.Enum);
CTagKinMapping.set('_enumerations', vscode.SymbolKind.Enum);
CTagKinMapping.set('_field', vscode.SymbolKind.Field);
CTagKinMapping.set('_fields', vscode.SymbolKind.Field);
CTagKinMapping.set('_file', vscode.SymbolKind.File);
CTagKinMapping.set('_files', vscode.SymbolKind.File);
CTagKinMapping.set('_function', vscode.SymbolKind.Function);
CTagKinMapping.set('_functions', vscode.SymbolKind.Function);
CTagKinMapping.set('_member', vscode.SymbolKind.Function);
CTagKinMapping.set('_interface', vscode.SymbolKind.Interface);
CTagKinMapping.set('_interfaces', vscode.SymbolKind.Interface);
CTagKinMapping.set('_key', vscode.SymbolKind.Key);
CTagKinMapping.set('_keys', vscode.SymbolKind.Key);
CTagKinMapping.set('_method', vscode.SymbolKind.Method);
CTagKinMapping.set('_methods', vscode.SymbolKind.Method);
CTagKinMapping.set('_module', vscode.SymbolKind.Module);
CTagKinMapping.set('_modules', vscode.SymbolKind.Module);
CTagKinMapping.set('_namespace', vscode.SymbolKind.Namespace);
CTagKinMapping.set('_namespaces', vscode.SymbolKind.Namespace);
CTagKinMapping.set('_number', vscode.SymbolKind.Number);
CTagKinMapping.set('_numbers', vscode.SymbolKind.Number);
CTagKinMapping.set('_null', vscode.SymbolKind.Null);
CTagKinMapping.set('_object', vscode.SymbolKind.Object);
CTagKinMapping.set('_package', vscode.SymbolKind.Package);
CTagKinMapping.set('_packages', vscode.SymbolKind.Package);
CTagKinMapping.set('_property', vscode.SymbolKind.Property);
CTagKinMapping.set('_properties', vscode.SymbolKind.Property);
CTagKinMapping.set('_objects', vscode.SymbolKind.Object);
CTagKinMapping.set('_string', vscode.SymbolKind.String);
CTagKinMapping.set('_variable', vscode.SymbolKind.Variable);
CTagKinMapping.set('_variables', vscode.SymbolKind.Variable);
CTagKinMapping.set('_projects', vscode.SymbolKind.Package);
CTagKinMapping.set('_defines', vscode.SymbolKind.Module);
CTagKinMapping.set('_labels', vscode.SymbolKind.Interface);
CTagKinMapping.set('_macros', vscode.SymbolKind.Function);
CTagKinMapping.set('_types (structs and records)', vscode.SymbolKind.Class);
CTagKinMapping.set('_subroutine', vscode.SymbolKind.Method);
CTagKinMapping.set('_subroutines', vscode.SymbolKind.Method);
CTagKinMapping.set('_types', vscode.SymbolKind.Class);
CTagKinMapping.set('_programs', vscode.SymbolKind.Class);
CTagKinMapping.set('_Object\'s method', vscode.SymbolKind.Method);
CTagKinMapping.set('_Module or functor', vscode.SymbolKind.Module);
CTagKinMapping.set('_Global variable', vscode.SymbolKind.Variable);
CTagKinMapping.set('_Type name', vscode.SymbolKind.Class);
CTagKinMapping.set('_A function', vscode.SymbolKind.Function);
CTagKinMapping.set('_A constructor', vscode.SymbolKind.Constructor);
CTagKinMapping.set('_An exception', vscode.SymbolKind.Class);
CTagKinMapping.set('_A \'structure\' field', vscode.SymbolKind.Field);
CTagKinMapping.set('_procedure', vscode.SymbolKind.Function);
CTagKinMapping.set('_procedures', vscode.SymbolKind.Function);
CTagKinMapping.set('_constant definitions', vscode.SymbolKind.Constant);
CTagKinMapping.set('_javascript functions', vscode.SymbolKind.Function);
CTagKinMapping.set('_singleton methods', vscode.SymbolKind.Method);

const newValuesAndKeys = {};
CTagKinMapping.forEach((value, key) => {
    newValuesAndKeys[key.substring(1)] = value;
});
Object.keys(newValuesAndKeys).forEach(key => {
    CTagKinMapping.set(key, newValuesAndKeys[key]);
});

export function parseTags(query: string, token: vscode.CancellationToken, maxItems: number = 200): Promise<Tag[]> {
    const file = pythonSettings.workspaceSymbols.tagFilePath;
    return fsExistsAsync(file).then(exists => {
        if (!exists) {
            return null;
        }

        return new Promise<Tag[]>((resolve, reject) => {
            let lr = new LineByLineReader(file);
            let lineNumber = 0;
            let tags: Tag[] = [];

            lr.on("error", function (err) {
                reject(err);
            });

            lr.on("line", function (line) {
                lineNumber++;
                if (token.isCancellationRequested) {
                    lr.close();
                    return;
                }
                const tag = parseTagsLine(line, query);
                if (tag) {
                    tags.push(tag);
                }
                if (tags.length >= 100) {
                    lr.close();
                }
            });

            lr.on("end", function () {
                resolve(tags);
            });
        });
    });
}
function parseTagsLine(line: string, searchPattern: string): Tag {
    if (IsFileRegEx.test(line)) {
        return;
    }
    let match = matchNamedRegEx(line, LINE_REGEX);
    if (!match) {
        return;
    }
    if (!fuzzy.test(searchPattern, match.name)) {
        return;
    }
    let file = match.file;
    if (!path.isAbsolute(file)) {
        file = path.resolve(vscode.workspace.rootPath, '.vscode', file);
    }

    const symbolKind = CTagKinMapping.has(match.type) ? CTagKinMapping.get(match.type) : vscode.SymbolKind.Null;
    const tag: Tag = {
        fileName: file,
        code: match.code,
        position: new vscode.Position(Number(match.line) - 1, 0),
        symbolName: match.name,
        symbolKind: symbolKind
    };
    return tag;
}