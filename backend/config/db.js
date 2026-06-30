const mongoose = require('mongoose');

let connectionPromise = null;
let lastConnectionError = '';

function connectDatabase() {
  if (connectionPromise) {
    return connectionPromise;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    lastConnectionError = 'MONGODB_URI is not configured.';
    console.warn(`${lastConnectionError} Blog admin routes will not be available.`);
    return Promise.resolve(null);
  }

  connectionPromise = mongoose.connect(uri, {
    dbName: process.env.MONGODB_DB_NAME || 'fleximagepro_blog',
    serverSelectionTimeoutMS: 10000,
  }).then((connection) => {
    console.log('MongoDB connected for blog admin.');
    return connection;
  }).catch((error) => {
    connectionPromise = null;
    lastConnectionError = error.message;
    console.error('MongoDB connection failed:', error.message);
    throw error;
  });

  return connectionPromise;
}

async function ensureDatabaseReady() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const connection = await connectDatabase();
  if (!connection || mongoose.connection.readyState !== 1) {
    const error = new Error(lastConnectionError || 'Database is not connected.');
    error.status = 503;
    throw error;
  }

  return connection;
}

function getDatabaseStatus() {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return {
    configured: Boolean(process.env.MONGODB_URI),
    dbName: process.env.MONGODB_DB_NAME || 'fleximagepro_blog',
    readyState: mongoose.connection.readyState,
    state: states[mongoose.connection.readyState] || 'unknown',
    lastError: lastConnectionError,
  };
}

module.exports = {
  connectDatabase,
  ensureDatabaseReady,
  getDatabaseStatus,
};
