require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const authRoutes = require('./routes/auth');
const courseRoutes = require('./routes/courses');
const paymentRoutes = require('./routes/payments');
const progressRoutes = require('./routes/progress');
const contactRoutes = require('./routes/contact');
const newsletterRoutes = require('./routes/newsletter');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── SECURITY ─────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false })); // CSP disabled so CDN scripts work
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [process.env.FRONTEND_URL, 'https://danielmuendo.com'].filter(Boolean)
    : true,
  credentials: true,
}));

// ─── STRIPE WEBHOOK (needs raw body — must come BEFORE json parser) ───
app.use('/api/payments/webhook/stripe', express.raw({ type: 'application/json' }));

// ─── BODY PARSING ─────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

// ─── RATE LIMITING ────────────────────────────────────────
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
}));
app.use('/api/auth/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many attempts, please try again later.' }
}));

// ─── API ROUTES ───────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/admin', adminRoutes);

// ─── HEALTH CHECK ─────────────────────────────────────────
app.get('/health', (req, res) => res.json({
  success: true,
  message: 'Daniel Muendo API is running',
  version: '1.0.0',
  environment: process.env.NODE_ENV,
  timestamp: new Date().toISOString(),
}));

// ─── SERVE FRONTEND ───────────────────────────────────────
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));
app.get('*', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));

// ─── GLOBAL ERROR HANDLER ─────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Server:    http://localhost:${PORT}`);
  console.log(`🌐 Frontend:  http://localhost:${PORT}`);
  console.log(`📡 API:       http://localhost:${PORT}/api`);
  console.log(`❤️  Health:    http://localhost:${PORT}/health\n`);
});

module.exports = app;
