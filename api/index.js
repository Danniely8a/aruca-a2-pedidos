import { app } from '../server/src/app.js';

// Vercel invoca la función con (req, res) de Node. Express es una función
// (req, res) => ..., así que basta exportarla tal cual.
export default app;
