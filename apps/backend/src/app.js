const express = require('express');
const cors = require('cors');
const authRoutes = require('./modules/auth/auth.routes');
const onboardingRoutes = require('./modules/onboarding/onboarding.routes');
const ordersRoutes = require('./modules/orders/orders.routes');
const outletOrdersRoutes = require('./modules/orders/outlet-orders.routes');
const outletMenuRoutes = require('./modules/menu/menu.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/onboarding', onboardingRoutes);
app.use('/api/v1/catalog', require('./modules/catalog/catalog.routes'));
app.use('/api/v1/orders', ordersRoutes);
app.use('/api/v1/outlet/orders', outletOrdersRoutes);
app.use('/api/v1/outlet/menu', outletMenuRoutes);

app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Campus Food API is running'
    });
});

// Global error handler
app.use((err, req, res, next) => {
    const statusCode = err.statusCode || err.status || 500;

    res.status(statusCode).json({
        success: false,
        message: err.message || 'Internal server error'
    });
});

module.exports = app;