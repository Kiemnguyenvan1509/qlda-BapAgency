import express from 'express';
import cors from 'cors';
import { attachActorContext } from './middlewares/authMiddleware';
import apiRoutes from './routes/apiRoutes';

export const expressApp = express();

expressApp.set('trust proxy', true);
expressApp.use(cors());
expressApp.use(express.json({ limit: '10mb' }));
expressApp.use(attachActorContext);

expressApp.use('/api', apiRoutes);
