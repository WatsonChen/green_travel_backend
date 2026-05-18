require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const itineraryRoutes = require('./routes/itineraries');
const announcementRoutes = require('./routes/announcements');
const memberRoutes = require('./routes/members');
const orderRoutes = require('./routes/orders');
const registrationRoutes = require('./routes/registrations');
const paymentRoutes = require('./routes/payments');

const app = express();

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// 藍新 notify 使用 urlencoded，其餘用 JSON
app.use((req, res, next) => {
  if (req.path === '/api/payments/notify') return next();
  express.json()(req, res, next);
});

app.use('/api/auth', authRoutes);
app.use('/api/itineraries', itineraryRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/payments', paymentRoutes);

app.get('/health', (_, res) => res.json({ status: 'ok' }));

const port = process.env.PORT || 4000;
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Backend API listening at http://localhost:${port}`);
  });
}

module.exports = app;
