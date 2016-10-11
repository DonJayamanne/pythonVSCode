
export class JmpModuleLoadError extends Error {
    readonly innerException: any;
    constructor(error: Error) {
        const errorMessage = `Version incompatibility in Jupyter (Python extension). View 'Help' for further details.`;
        super(errorMessage);
        this.innerException = error;
        this.message = errorMessage;
    }
}