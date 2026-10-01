import { isConnected } from '../db.js';
import { memoryStore } from './memory.js';
import { arcStore } from './arc.js';

export const store = isConnected ? arcStore : memoryStore;
export const mode = isConnected ? 'postgres' : 'demo';
