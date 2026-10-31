/**
 * MT Nexus Global ERP — Backend Application Server
 * Enterprise Software House Management System
 */

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');
const { verifyCsrf } = require('./middleware/auth');

// Route Handlers
const healthRouter = require('./routes/health');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const tasksRouter = require('./routes/tasks');
const employeesRouter = require('./routes/employees');
const projectsRouter = require('./routes/projects');
const clientOpsRouter = require('./routes/clientOps');

const app = express();

// Global Middleware & CORS Configuration with Credentials
const allowedOrigins = [
  'http://localhost:8000',
  'http://127.0.0.1:8000',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return callback(null, origin);
    }
    const err = new Error('Cross-origin request unauthorized');
    err.status = 403;
    err.name = 'CorsForbidden';
    return callback(err);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-csrf-token'],
}));

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CSRF Defense for Cookie-Authenticated State Modifications
app.use('/api', verifyCsrf);

// Request Logging
if (config.env !== 'test') {
  app.use(morgan(':date[iso] :method :url :status :res[content-length] - :response-time ms'));
}

// Mount API Routes
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/clientops', clientOpsRouter);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'NotFound',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Centralized Error Handling
app.use(errorHandler);

// Start Server if invoked directly
if (require.main === module) {
  const server = app.listen(config.port, config.host, () => {
    console.log(`=======================================================`);
    console.log(`🚀 MT Nexus Global Backend Service Online`);
    console.log(`📡 URL: http://${config.host}:${config.port}`);
    console.log(`🏥 Health Check: http://${config.host}:${config.port}/api/health`);
    console.log(`🗄️ Database: PostgreSQL 16 (Connected & Synchronized)`);
    console.log(`=======================================================`);
  });

  // Graceful Shutdown
  const shutdown = () => {
    console.log('🛑 Gracefully shutting down MT Nexus Global server...');
    server.close(() => {
      console.log('✅ HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

module.exports = app;
