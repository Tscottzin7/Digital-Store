require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files
const publicPath = __dirname;
app.use(express.static(publicPath));

// Email transporter configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Mock product database
const products = {
  'ebook-001': {
    id: 'ebook-001',
    name: 'E-book: Guia Completo de Desenvolvimento Web',
    description: 'Aprenda tudo sobre desenvolvimento web moderno com React, Node.js e muito mais',
    price: 49.90,
    image: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=500&h=500&fit=crop',
    downloadUrl: 'https://drive.google.com/file/d/1YhehThSTnmKNBxW-NZ-pgfKvrbbBMFpN/view?usp=sharing'
  }
};

// Store orders in memory (in production, use a database)
const orders = new Map();

// Routes

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Get product details
app.get('/api/product/:id', (req, res) => {
  const product = products[req.params.id];
  if (!product) {
    return res.status(404).json({ error: 'Produto não encontrado' });
  }
  res.json(product);
});

// Create payment intent
app.post('/api/payment/create', (req, res) => {
  const { email, productId, paymentMethod } = req.body;

  if (!email || !productId || !paymentMethod) {
    return res.status(400).json({ error: 'Dados incompletos' });
  }

  const product = products[productId];
  if (!product) {
    return res.status(404).json({ error: 'Produto não encontrado' });
  }

  // Generate order ID
  const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Store order
  orders.set(orderId, {
    id: orderId,
    email,
    productId,
    paymentMethod,
    amount: product.price,
    status: 'pending',
    createdAt: new Date()
  });

  // Generate payment details based on method
  let paymentDetails = {};

  if (paymentMethod === 'pix') {
    paymentDetails = {
      method: 'pix',
      qrCode: generatePixQRCode(product.price, orderId),
      pixKey: process.env.PIX_KEY,
      amount: product.price
    };
  } else if (paymentMethod === 'card') {
    paymentDetails = {
      method: 'card',
      orderId: orderId,
      amount: product.price,
      currency: 'BRL',
      description: product.name
    };
  }

  res.json({
    success: true,
    orderId,
    paymentDetails,
    product: {
      name: product.name,
      price: product.price
    }
  });
});

// Confirm payment
app.post('/api/payment/confirm', (req, res) => {
  const { orderId } = req.body;

  const order = orders.get(orderId);
  if (!order) {
    return res.status(404).json({ error: 'Pedido não encontrado' });
  }

  // Update order status
  order.status = 'completed';
  order.completedAt = new Date();

  // Send product via email
  const product = products[order.productId];
  sendProductEmail(order.email, product, orderId);

  res.json({
    success: true,
    message: 'Pagamento confirmado! Verifique seu email.',
    orderId
  });
});

// Send product via email
async function sendProductEmail(email, product, orderId) {
  try {
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: `Seu produto foi entregue: ${product.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0066ff;">Obrigado pela sua compra!</h2>
          <p>Seu pedido <strong>${orderId}</strong> foi confirmado e processado com sucesso.</p>
          
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>${product.name}</h3>
            <p>${product.description}</p>
            <p style="font-size: 18px; color: #0066ff; font-weight: bold;">R$ ${product.price.toFixed(2)}</p>
          </div>

          <p>Seu produto está disponível para download no link abaixo:</p>
          <a href="${product.downloadUrl}" target="_blank" style="display: inline-block; background: #0066ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
            Baixar Produto
          </a>

          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            Se você não realizou esta compra, ignore este email.
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`Email enviado para ${email}`);
  } catch (error) {
    console.error('Erro ao enviar email:', error);
  }
}

// Generate PIX QR Code (mock)
function generatePixQRCode(amount, orderId) {
  // In production, use a library like qrcode to generate real QR codes
  // This is a mock implementation
  return `PIX-${amount}-${orderId}`;
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Catch-all for SPA - serve index.html for any route not matched
app.use((req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
