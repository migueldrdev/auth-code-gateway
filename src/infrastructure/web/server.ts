import express, { Application, Request, Response } from 'express';

export const createServer = (): Application => {
    const app = express();
    app.use(express.json());

    app.get('/', (req: Request, res: Response) => {
        res.status(200).json({ status: 'OK', message: 'Gateway Server Active 🚀' });
    });

    return app;
};