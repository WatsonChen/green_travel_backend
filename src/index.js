const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

const defaultTenant = 'green-travel';

const store = {
  [defaultTenant]: {
    agencies: {
      'green-travel': {
        id: 'green-travel',
        name: 'Green Travel Agency',
      },
    },
    members: [
      { id: '1', name: 'John Brown', email: 'john@example.com', phone: '123-456-7890', joinDate: '2023-01-15', status: 'active' },
    ],
    announcements: [
      { id: '1', title: '系統維護通知', content: '本系統將於本週六凌晨 2:00-4:00 進行系統維護。', priority: 'high', status: 'published', publishDate: '2024-01-15', author: '系統管理員', createdAt: '2024-01-10 10:30', updatedAt: '2024-01-10 10:30' },
    ],
    itineraries: [
      { id: '1', title: 'Kyoto Spring Tour', destination: 'Kyoto, Japan', startDate: '2024-04-01', endDate: '2024-04-07', price: 2500 },
      { id: '2', title: 'Swiss Alps Adventure', destination: 'Interlaken, Switzerland', startDate: '2024-06-15', endDate: '2024-06-22', price: 3200 },
    ],
    registrations: [
      { id: '1', itinerary: 'Kyoto Spring Tour', applicantName: 'Alice Smith', email: 'alice@example.com', submissionDate: '2024-01-20', status: 'pending' },
    ],
  },
};

const getTenant = (tenantId) => store[tenantId] || store[defaultTenant];

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (email === 'admin@greentravel.com' && password === 'password') {
    return res.json({ token: 'mock-token', tenantId: defaultTenant });
  }
  return res.status(401).json({ message: 'Invalid credentials' });
});

app.get('/api/members', (req, res) => {
  const tenantId = req.query.tenantId || defaultTenant;
  const tenant = getTenant(tenantId);
  res.json(tenant.members);
});

app.get('/api/announcements', (req, res) => {
  const tenantId = req.query.tenantId || defaultTenant;
  const tenant = getTenant(tenantId);
  res.json(tenant.announcements);
});

app.get('/api/itineraries', (req, res) => {
  const tenantId = req.query.tenantId || defaultTenant;
  const tenant = getTenant(tenantId);
  res.json(tenant.itineraries);
});

app.get('/api/registrations', (req, res) => {
  const tenantId = req.query.tenantId || defaultTenant;
  const tenant = getTenant(tenantId);
  res.json(tenant.registrations);
});

app.post('/api/registrations', (req, res) => {
  const tenantId = req.query.tenantId || defaultTenant;
  const tenant = getTenant(tenantId);
  const registration = { id: uuidv4(), ...req.body };
  tenant.registrations.push(registration);
  res.status(201).json(registration);
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Backend API listening at http://localhost:${port}`);
});
