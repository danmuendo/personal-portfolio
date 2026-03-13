const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { subscribe, unsubscribe } = require('../controllers/newsletterController');

router.post('/subscribe',
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  subscribe
);

router.post('/unsubscribe',
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  unsubscribe
);

module.exports = router;
