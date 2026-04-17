require('dotenv').config();
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const morgan     = require('morgan');
const connectDB  = require('./config/db');

const authRoutes     = require('./routes/auth');
const bloodRoutes    = require('./routes/blood');
const requestRoutes  = require('./routes/requests');
const alertRoutes    = require('./routes/alerts');
const adminRoutes    = require('./routes/admin');
const donationRoutes = require('./routes/donations');
const paymentRoutes  = require('./routes/payments');
const featureRoutes  = require('./routes/features');
const { startAutoApproveJob } = require('./utils/autoApprove');

connectDB();

const app        = express();
const httpServer = http.createServer(app);

// CORS — allow Live Server + production
const ALLOWED = [
  'http://localhost:5500', 'http://localhost:5501',
  'http://127.0.0.1:5500','http://127.0.0.1:5501',
  'http://localhost:3000', process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || origin === "null") {
      return callback(null, true);
    }
    callback(null, true);
  },
  credentials: true
}));


// Socket.io (same port as Express)
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET','POST'] },
  pingTimeout: 60000, pingInterval: 25000,
});
app.set('io', io);
startAutoApproveJob(io);

io.on('connection', socket => {
  socket.on('join:search', ({ group, district }) =>
    socket.join('search:' + group + ':' + (district || 'all')));
  socket.on('join:bank',  ({ bankId }) => socket.join('bank:'  + bankId));
  socket.on('join:admin', ()           => socket.join('admin'));
  socket.on('leave:search', ({ group, district }) =>
    socket.leave('search:' + group + ':' + (district || 'all')));
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// Health
app.get('/',    (_, r) => r.json({ status:'ok', app:'BloodLink TN API v4.0', port: process.env.PORT||8000 }));
app.get('/api', (_, r) => r.json({ success:true, message:'🩸 BloodLink TN API v4.0', port: process.env.PORT||8000 }));

// Routes
app.use('/api/auth',      authRoutes);
app.use('/api/blood',     bloodRoutes);
app.use('/api/requests',  requestRoutes);
app.use('/api/alerts',    alertRoutes);
app.use('/api/admin',     adminRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/payments',  paymentRoutes);
app.use('/api/features',  featureRoutes);

// 404
app.use((req, res) => res.status(404).json({ success:false, msg:'Not found: '+req.method+' '+req.originalUrl }));

// Error handler
app.use((err, req, res, _next) => {
  console.error('Error:', err.message);
  if (err.name === 'ValidationError')
    return res.status(400).json({ success:false, msg:Object.values(err.errors).map(e=>e.message).join(', ') });
  if (err.code === 11000)
    return res.status(400).json({ success:false, msg:Object.keys(err.keyValue)[0]+' already exists.' });
  if (err.name === 'CastError')
    return res.status(400).json({ success:false, msg:'Invalid ID format.' });
  res.status(err.statusCode||500).json({ success:false, msg:err.message||'Server error.' });
});

const PORT = parseInt(process.env.PORT)||8000;
httpServer.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   🩸  BloodLink TN  —  Server v4.0       ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('🚀  API:    http://localhost:'+PORT+'/api');
  console.log('⚡  Socket: ws://localhost:'+PORT);
  console.log('🍃  DB:     ac-hbm6pbg replica set');
  console.log('📱  SMS:    '+(process.env.MSG91_AUTH_KEY!=='your_msg91_auth_key_here'?'MSG91 ✅':'Simulation'));
  console.log('💳  Pay:    '+(process.env.RAZORPAY_KEY_ID!=='rzp_test_your_key_id_here'?'Razorpay ✅':'Simulation'));
  console.log('');
});

module.exports = { app, io };
