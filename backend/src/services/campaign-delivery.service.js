import Campaign from '../models/campaign.model.js';
import Customer from '../models/customer.model.js';
import CommunicationLog from '../models/communication-log.model.js';
import vendorApi from './vendor-api.service.js';

// Configuration
const getCallbackUrl = () => {
  if (process.env.DELIVERY_CALLBACK_URL) {
    return process.env.DELIVERY_CALLBACK_URL;
  }
  const backendBase = process.env.BACKEND_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001');
  return backendBase ? `${backendBase.replace(/\/+$/, '')}/api/delivery-receipts` : '/api/delivery-receipts';
};

const CONFIG = {
  callbackUrl: getCallbackUrl(),
  batchSize: 25, // Process customers in batches of 25
  processingInterval: 100, // Small delay between batches (ms)
};

/**
 * Generate a personalized message for a customer
 * 
 * @param {Object} campaign - Campaign data
 * @param {Object} customer - Customer data
 * @returns {string} - Personalized message
 */
const generatePersonalizedMessage = (campaign, customer) => {
  // Get the campaign content
  let content = campaign.content.body || '';
  
  // Basic personalization with customer name
  content = content.replace(/{{\s*name\s*}}/gi, customer.firstName);
  content = content.replace(/{{\s*firstName\s*}}/gi, customer.firstName);
  content = content.replace(/{{\s*lastName\s*}}/gi, customer.lastName);
  
  // If no personalization was done and no specific content, create a sample message
  if (!content || content.trim() === '') {
    content = `Hi ${customer.firstName}, here's 10% off on your next order!`;
  }
  
  return content;
};

/**
 * Process a batch of customers for campaign delivery
 * 
 * @param {Object} campaign - Campaign data
 * @param {Array} customers - Array of customer objects
 * @returns {Promise<Object>} - Processing results
 */
const processBatch = async (campaign, customers) => {
  const results = {
    queued: 0,
    skipped: 0,
    errors: 0,
  };
  
  const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  
  // Create communication logs for all customers in batch
  const communicationLogs = [];
  
  for (const customer of customers) {
    try {
      // Skip customers based on preferences
      const preferredChannel = campaign.type.toLowerCase();
      if (!customer.preferences.marketingConsent || 
          (preferredChannel === 'email' && !customer.preferences.channels.email) || 
          (preferredChannel === 'sms' && !customer.preferences.channels.sms) || 
          (preferredChannel === 'push' && !customer.preferences.channels.push)) {
        results.skipped++;
        continue;
      }
      
      // Generate personalized content
      const personalizedContent = generatePersonalizedMessage(campaign, customer);
      
      // Create a communication log entry
      const logEntry = new CommunicationLog({
        campaignId: campaign._id,
        userId: customer._id,
        type: campaign.type,
        content: {
          subject: campaign.content.subject || `New offer from ${campaign.name}`,
          body: personalizedContent,
          template: campaign.content.template
        },
        status: 'queued',
        metadata: {
          vendor: 'dummy-vendor',
        },
        batchId
      });
      
      // Send the message via vendor API
      const recipient = campaign.type.toLowerCase() === 'email' 
        ? customer.email 
        : customer.phone;
        
      const response = await vendorApi.sendMessage({
        to: recipient,
        content: personalizedContent,
        type: campaign.type.toLowerCase(),
        callbackUrl: CONFIG.callbackUrl
      });
      
      // Update the log with vendor response
      logEntry.status = 'sent';
      logEntry.metadata.vendorMessageId = response.messageId;
      logEntry.metadata.sentTimestamp = new Date(response.timestamp);
      
      // Save the log
      await logEntry.save();
      
      results.queued++;
    } catch (error) {
      console.error(`[Campaign Delivery] Error processing customer ${customer._id}:`, error);
      results.errors++;
    }
  }
  
  return results;
};

/**
 * Deliver a campaign to all targeted customers
 * 
 * @param {string} campaignId - Campaign ID
 * @returns {Promise<Object>} - Delivery results
 */
export const deliverCampaign = async (campaignId) => {
  console.log(`[Campaign Delivery] Starting delivery for campaign ${campaignId}`);
  
  try {
    // Get the campaign
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }
    
    // Update campaign status to active
    campaign.status = 'active';
    await campaign.save();
    
    // Find all customers matching the segment rules
    const customers = await Customer.findBySegmentRules(campaign.segmentRules);
    const totalCustomers = customers.length;
    
    console.log(`[Campaign Delivery] Found ${totalCustomers} matching customers for campaign ${campaignId}`);
    
    // Save the audience size to the campaign
    campaign.audienceSize = totalCustomers;
    campaign.metrics.sent = totalCustomers;
    await campaign.save();
    
    // Process customers in batches
    let processed = 0;
    let results = {
      queued: 0,
      skipped: 0,
      errors: 0,
    };
    
    // Process in batches to avoid overwhelming the system
    for (let i = 0; i < totalCustomers; i += CONFIG.batchSize) {
      const batch = customers.slice(i, i + CONFIG.batchSize);
      const batchResults = await processBatch(campaign, batch);
      
      // Aggregate results
      results.queued += batchResults.queued;
      results.skipped += batchResults.skipped;
      results.errors += batchResults.errors;
      
      processed += batch.length;
      console.log(`[Campaign Delivery] Processed ${processed}/${totalCustomers} customers`);
      
      // Small delay between batches
      if (i + CONFIG.batchSize < totalCustomers) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.processingInterval));
      }
    }
    
    // Update campaign metrics
    campaign.metrics.sent = results.queued;
    await campaign.save();
    
    console.log(`[Campaign Delivery] Campaign ${campaignId} delivery complete:`, results);
    
    return {
      campaignId: campaign._id,
      name: campaign.name,
      audienceSize: totalCustomers,
      delivered: results.queued,
      skipped: results.skipped,
      errors: results.errors,
    };
  } catch (error) {
    console.error(`[Campaign Delivery] Error delivering campaign ${campaignId}:`, error);
    throw error;
  }
};

/**
 * Trigger campaign delivery when a new segment is saved
 * 
 * @param {Object} campaign - Campaign object
 * @returns {Promise<Object>} - Delivery results
 */
export const triggerCampaignDelivery = async (campaign) => {
  try {
    return await deliverCampaign(campaign._id);
  } catch (error) {
    console.error('[Campaign Delivery] Error triggering campaign delivery:', error);
    throw error;
  }
};

export default {
  deliverCampaign,
  triggerCampaignDelivery,
}; 