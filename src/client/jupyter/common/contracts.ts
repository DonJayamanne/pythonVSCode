
export interface JupyterSettings {
    appendResults: boolean;
    pythonPath: string;
    languages: JupyterLanguageSetting[];
}

export interface JupyterLanguageSetting {
    languageId: string;
    defaultKernel?: string;
    startupCode?: string[];
}