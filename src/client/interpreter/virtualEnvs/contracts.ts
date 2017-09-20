export interface IVirtualEnvironment {
    detect(pythonPath: string): Promise<boolean>;
    readonly name: string;
}
