import path from 'path';
import express from 'express';
import { expressApp } from './app';

const PORT = Number(process.env.PORT || 4000);

// Phục vụ file tĩnh Frontend nếu đã chạy npm run build
const distPath = path.resolve(process.cwd(), 'dist');
expressApp.use(express.static(distPath));

expressApp.listen(PORT, () => {
  console.log(`[Backend MVC Server] Running at http://localhost:${PORT}`);
  console.log(`[Backend MVC API]    Endpoint: http://localhost:${PORT}/api/health`);
});
