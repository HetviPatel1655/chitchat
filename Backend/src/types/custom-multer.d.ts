// Custom type definition for Multer file
// This avoids relying on @types/multer which is failing on Render

export interface MulterFile {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    destination: string;
    filename: string;
    path: string;
    buffer: Buffer;
    stream: any; // Added for compatibility with Express.Multer.File
}

// Global declaration to fix "Module not found" error
declare module "multer" {
    import { RequestHandler } from "express";

    interface Multer {
        single(fieldname: string): RequestHandler;
        array(fieldname: string, maxCount?: number): RequestHandler;
        fields(fields: any[]): RequestHandler;
        none(): RequestHandler;
        any(): RequestHandler;
    }

    interface Options {
        dest?: string;
        storage?: any;
        fileFilter?: any;
        limits?: any;
        preservePath?: boolean;
    }

    interface DiskStorageOptions {
        destination?: string | ((req: any, file: any, cb: (error: Error | null, destination: string) => void) => void);
        filename?: string | ((req: any, file: any, cb: (error: Error | null, filename: string) => void) => void);
    }

    function multer(options?: Options): Multer;

    namespace multer {
        function diskStorage(options: DiskStorageOptions): any;
        function memoryStorage(): any;
        interface File extends MulterFile { } // Export File interface matching ours
    }

    export = multer;
}
