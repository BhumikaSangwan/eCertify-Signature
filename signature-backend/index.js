import cluster from 'cluster';
import os from 'os';
import { createServer } from 'http';
import argvMap from './app/libs/argvMap.js';
import './app/config/env.js';
import mongoose from './app/config/mongoose.js';
import { createSocketServer } from './app/config/socket.js';
import app, { sessionMiddleware } from './app/index.js';

const server = createServer(app);
const io = createSocketServer(server);
// io.engine.use(sessionMiddleware);
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

const numCPUs = os.cpus().length;
console.log("numCPUs : ", numCPUs);
const port = argvMap.get('port') ?? 3000;

server.listen(port, (err) => {
    if (!err) {
        console.info(`Server Started at port ${port}`);
        return;
    }
    console.error(err);
    process.exit();
});

// if (cluster.isPrimary) {
//   console.log(`🧠 Primary process ${process.pid} is running`);
//   console.log(`🔧 Spawning ${numCPUs} workers`);

//   for (let i = 0; i < numCPUs-1; i++) {
//     cluster.fork(); // Create worker processes
//   }

//   cluster.on('exit', (worker, code, signal) => {
//     console.warn(`❌ Worker ${worker.process.pid} died`);
//     console.log('🚀 Spawning a new worker...');
//     cluster.fork();
//   });

// } else {
//   // Worker process code
//   console.log(`👷 Worker ${process.pid} started`);

//   const server = createServer(app);
//   const io = createSocketServer(server);

//   // Bind session middleware to socket.io
//   io.use((socket, next) => {
//     sessionMiddleware(socket.request, {}, next);
//   });

//   const port = argvMap.get('port') ?? 3000;

//   server.listen(port, () => {
//     console.log(`Server running on port ${port} (PID: ${process.pid})`);
//   });
// }
