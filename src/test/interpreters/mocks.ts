import { IPythonInterpreterProvider, PythonPathSuggestion } from "../../client/interpreter/index";
import { IRegistry, Hive, Architecture } from "../../client/common/registry";

export class MockProvider implements IPythonInterpreterProvider {
    constructor(private suggestions: PythonPathSuggestion[]) {
    }
    getPythonInterpreters(): Promise<PythonPathSuggestion[]> {
        return Promise.resolve(this.suggestions);
    }
}

export class MockRegistry implements IRegistry {
    constructor(private keys: { key: string, hive: Hive, arch?: Architecture, values: string[] }[],
        private values: { key: string, hive: Hive, arch?: Architecture, value: string, name?: string }[]) {
    }
    getKeys(key: string, hive: Hive, arch?: Architecture): Promise<string[]> {
        const items = this.keys.find(item => {
            if (item.arch) {
                return item.key === key && item.hive === hive && item.arch === arch;
            }
            return item.key === key && item.hive === hive;
        });

        return items ? Promise.resolve(items.values) : Promise.resolve([]);
    }
    getValue(key: string, hive: Hive, arch?: Architecture, name?: string): Promise<string | void> {
        const items = this.values.find(item => {
            if (item.key !== key || item.hive !== hive) {
                return false;
            }
            if (item.arch && item.arch !== arch) {
                return false;
            }
            if (name && item.name !== name) {
                return false;
            }
            return true;
        });

        return items ? Promise.resolve(items.value) : Promise.resolve();
    }
}