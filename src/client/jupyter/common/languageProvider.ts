import { Range, Position, TextDocument, workspace } from 'vscode';
import { JupyterLanguageSetting } from './contracts';
import { EOL } from 'os';

/**
 * Language providers 
 * 
 * @export
 * @interface LanguageProvider
 */
export interface LanguageProvider {
    /**
     * Returns a Regular Expression used to determine whether a line is a Cell delimiter or not
     * 
     * @type {RegExp}
     * @memberOf LanguageProvider
     */
    cellIdentifier: RegExp;

    /**
     * Returns the selected code
     * If not implemented, then the currently active line or selected code is taken.
     * Can be implemented to ensure valid blocks of code are selected.
     * E.g if user selects only the If statement, code can be impelemented to ensure all code within the if statement (block) is returned
     * @param {string} selectedCode The selected code as identified by this extension.
     * @param {Range} [currentCell] Range of the currently active cell
     * @returns {Promise<string>} The code selected. If nothing is to be done, return the parameter value.
     * 
     * @memberOf LanguageProvider
     */
    getSelectedCode(selectedCode: string, currentCell?: Range): Promise<string>;

    /**
     * Gets the first line (position) of executable code within a range 
     * 
     * @param {TextDocument} document
     * @param {number} startLine
     * @param {number} endLine
     * @returns {Promise<Position>}
     * 
     * @memberOf LanguageProvider
     */
    getFirstLineOfExecutableCode(document: TextDocument, range: Range): Promise<Position>;
}

export class LanguageProviders {
    private static providers: Map<string, LanguageProvider> = new Map<string, LanguageProvider>();
    public static registerLanguageProvider(language: string, provider: LanguageProvider) {
        if (typeof language !== 'string' || language.length === 0) {
            throw new Error(`Argument 'language' is invalid`);
        }
        if (typeof provider !== 'object' || language === null) {
            throw new Error(`Argument 'provider' is invalid`);
        }
        LanguageProviders.providers.set(language, provider);
    }
    public static cellIdentifier(language: string): RegExp {
        return LanguageProviders.providers.has(language) ?
            LanguageProviders.providers.get(language).cellIdentifier : null;
    }
    public static getSelectedCode(language: string, selectedCode: string, currentCell?: Range): Promise<string> {
        return LanguageProviders.providers.has(language) ?
            LanguageProviders.providers.get(language).getSelectedCode(selectedCode, currentCell) :
            Promise.resolve(selectedCode);
    }
    public static getFirstLineOfExecutableCode(language: string, defaultRange: Range, document: TextDocument, range: Range): Promise<Position> | Promise<Range> {
        return LanguageProviders.providers.has(language) ?
            LanguageProviders.providers.get(language).getFirstLineOfExecutableCode(document, range) :
            Promise.resolve(defaultRange);
    }
    private static getLanguageSetting(language: string): JupyterLanguageSetting {
        let jupyterConfig = workspace.getConfiguration('jupyter');
        let langSettings = jupyterConfig.get('languages') as JupyterLanguageSetting[];
        let lowerLang = language.toLowerCase();
        return langSettings.find(setting => setting.languageId.toLowerCase() === lowerLang);
    }

    public static getDefaultKernel(language: string): string {
        let langSetting = LanguageProviders.getLanguageSetting(language);
        return langSetting ? langSetting.defaultKernel : null;
    }
    public static getStartupCode(language: string): string {
        let langSetting = LanguageProviders.getLanguageSetting(language);
        if (!langSetting || langSetting.startupCode.length === 0) {
            return null;
        }
        return langSetting.startupCode.join(EOL);
    }
} 