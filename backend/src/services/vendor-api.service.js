/**
 * Vendor API Service
 * 
 * This service simulates a third-party vendor API for sending messages.
 * In a real implementation, this would be replaced with actual API calls.
 */

import { handleDeliveryReceipt } from '../controllers/delivery-receipt.controller.js';

// Configuration
const VENDOR_CONFIG = {
  apiKey: 'dummy-api-key-12345',
  baseUrl: 'https://api.dummy-vendor.com/v1',
  successRate: 0.9, // 90% success, 10% failure
  deliveryTimeMin: 1000, // 1 second
  deliveryTimeMax: 5000, // 5 seconds
};

// Generate a random message ID
const generateMessageId = () => {
  return `msg_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
};

// Simulate a random delay
const randomDelay = (min, max) => {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
};

// Simulate message delivery
const simulateDelivery = async (messageId, callbackUrl) => {
  // Random delay to simulate network latency
  await randomDelay(VENDOR_CONFIG.deliveryTimeMin, VENDOR_CONFIG.deliveryTimeMax);
  
  // Determine if the message was delivered successfully (90% success rate)
  const isDelivered = Math.random() <= VENDOR_CONFIG.successRate;
  
  // Prepare the delivery receipt data
  const receiptData = {
    messageId,
    status: isDelivered ? 'delivered' : 'failed',
    timestamp: new Date().toISOString(),
    failureReason: isDelivered ? null : getRandomFailureReason(),
    deliveryAttempts: 1,
  };
  
  // Send the delivery receipt to the callback URL
  try {
    console.log(`[Vendor API] Sending delivery receipt for ${messageId} to ${callbackUrl}`);
    
    // For this simulated demo, deliver receipt directly to controller
    await handleDeliveryReceipt({ body: receiptData });
    
    console.log(`[Vendor API] Delivery receipt sent for ${messageId} - Status: ${isDelivered ? 'delivered' : 'failed'}`);
  } catch (error) {
    console.error(`[Vendor API] Error sending delivery receipt for ${messageId}:`, error);
  }
  
  return receiptData;
};

// Get a random failure reason
const getRandomFailureReason = () => {
  const reasons = [
    'Invalid recipient',
    'Network error',
    'Recipient opted out',
    'Message blocked by carrier',
    'Rate limit exceeded',
    'Invalid content',
    'Service unavailable',
  ];
  return reasons[Math.floor(Math.random() * reasons.length)];
};

/**
 * Send a message via the dummy vendor API
 * 
 * @param {Object} options
 * @param {string} options.to - Recipient identifier (email, phone, etc.)
 * @param {string} options.content - Message content
 * @param {string} options.type - Message type (email, sms, push)
 * @param {string} options.callbackUrl - URL for delivery receipts
 * @returns {Promise<Object>} - API response
 */
export const sendMessage = async ({ to, content, type, callbackUrl }) => {
  console.log(`[Vendor API] Sending ${type} message to ${to}`);
  
  try {
    // Simulate API call delay
    await randomDelay(300, 1000);
    
    // Generate a message ID
    const messageId = generateMessageId();
    
    // Simulate async delivery process
    simulateDelivery(messageId, callbackUrl);
    
    // Return the immediate response
    return {
      success: true,
      messageId,
      status: 'sent',
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[Vendor API] Error sending message:', error);
    throw error;
  }
};

export default {
  sendMessage,
}; 