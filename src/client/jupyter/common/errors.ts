export class KernelRestartedError extends Error {
    constructor() {
        super('Kernel has been restarted');
        this.message = 'Kernel has been restarted';
    }
}
export class KernelShutdownError extends Error {
    constructor() {
        super('Kernel has been shutdown');
        this.message = 'Kernel has been shutdown';
    }
}