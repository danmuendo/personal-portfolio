const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { submitContact } = require('../controllers/contactController');

router.post('/', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('subject').trim().notEmpty().withMessage('Subject is required'),
  body('message').trim().isLength({ min: 10 }).withMessage('Message must be at least 10 characters'),
], submitContact);

module.exports = router;
