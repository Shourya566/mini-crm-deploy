import CommunicationLog from '../models/communication-log.model.js';
import Campaign from '../models/campaign.model.js';

// Queue for batching delivery receipts
let receiptQueue = [];
let processingActive = false;
const BATCH_SIZE = 10; // Process in batches of 10
const PROCESSING_INTERVAL = 5000; // Process every 5 seconds

/**
 * Handle a single delivery receipt from the vendor API
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const handleDeliveryReceipt = async (req, res) => {
  try {
    const receiptData = req.body;
    console.log('[Delivery Receipt] Received receipt:', receiptData);
    
    // Add to queue for batch processing
    receiptQueue.push(receiptData);
    
    // Start processing if not active
    if (!processingActive) {
      startProcessingQueue();
    }
    
    // Send response if this was called from an actual API request
    if (res) {
      res.status(200).json({ success: true, message: 'Receipt queued for processing' });
    }
  } catch (error) {
    console.error('[Delivery Receipt] Error handling receipt:', error);
    if (res) {
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Error processing delivery receipt' 
      });
    }
  }
};

/**
 * Start the queue processing loop
 */
const startProcessingQueue = () => {
  if (processingActive) return;
  
  processingActive = true;
  console.log('[Delivery Receipt] Starting queue processing');
  
  // Schedule the first processing
  const timer = setTimeout(processReceiptBatch, 0);
  if (timer.unref) timer.unref();
};

/**
 * Process a batch of delivery receipts
 */
const processReceiptBatch = async () => {
  try {
    // If the queue is empty, stop processing
    if (receiptQueue.length === 0) {
      console.log('[Delivery Receipt] Queue empty, stopping processing');
      processingActive = false;
      return;
    }
    
    // Take a batch from the queue
    const batch = receiptQueue.splice(0, BATCH_SIZE);
    console.log(`[Delivery Receipt] Processing batch of ${batch.length} receipts`);
    
    // Group by messageId for efficient processing
    const messageIdMap = {};
    batch.forEach(receipt => {
      messageIdMap[receipt.messageId] = receipt;
    });
    
    // Find all related communication logs
    const logs = await CommunicationLog.find({
      'metadata.vendorMessageId': { $in: Object.keys(messageIdMap) }
    });
    
    if (logs.length === 0) {
      console.log('[Delivery Receipt] No matching communication logs found');
    } else {
      console.log(`[Delivery Receipt] Found ${logs.length} matching communication logs`);
      
      // Track campaigns that need a metrics update
      const campaignUpdates = {};
      
      // Process each log
      for (const log of logs) {
        const messageId = log.metadata.vendorMessageId;
        const receipt = messageIdMap[messageId];
        
        if (receipt) {
          // Update the log
          log.status = receipt.status === 'delivered' ? 'delivered' : 'failed';
          
          if (receipt.failureReason) {
            log.metadata.failureReason = receipt.failureReason;
          }
          
          if (receipt.status === 'delivered') {
            log.metadata.deliveryTimestamp = new Date(receipt.timestamp);
          }
          
          await log.save();
          console.log(`[Delivery Receipt] Updated log ${log._id} for message ${messageId}`);
          
          // Track for campaign metrics update
          if (!campaignUpdates[log.campaignId]) {
            campaignUpdates[log.campaignId] = {
              delivered: 0,
              bounced: 0
            };
          }
          
          if (receipt.status === 'delivered') {
            campaignUpdates[log.campaignId].delivered++;
          } else {
            campaignUpdates[log.campaignId].bounced++;
          }
        }
      }
      
      // Update campaign metrics
      for (const campaignId in campaignUpdates) {
        const updates = campaignUpdates[campaignId];
        const campaign = await Campaign.findById(campaignId);
        
        if (campaign) {
          if (updates.delivered > 0) {
            campaign.metrics.delivered += updates.delivered;
          }
          
          if (updates.bounced > 0) {
            campaign.metrics.bounced += updates.bounced;
          }
          
          await campaign.save();
          console.log(`[Delivery Receipt] Updated campaign ${campaignId} metrics`);
        }
      }
    }
    
    // Schedule the next batch if there are more receipts
    if (receiptQueue.length > 0) {
      const nextTimer = setTimeout(processReceiptBatch, PROCESSING_INTERVAL);
      if (nextTimer.unref) nextTimer.unref();
    } else {
      processingActive = false;
      console.log('[Delivery Receipt] Queue empty, processing complete');
    }
  } catch (error) {
    console.error('[Delivery Receipt] Error processing batch:', error);
    
    // Keep processing even if there's an error
    if (receiptQueue.length > 0) {
      const retryTimer = setTimeout(processReceiptBatch, PROCESSING_INTERVAL);
      if (retryTimer.unref) retryTimer.unref();
    } else {
      processingActive = false;
    }
  }
};

/**
 * Manually force processing of the receipt queue (for testing)
 */
export const forceProcessQueue = async (req, res) => {
  try {
    const queueSize = receiptQueue.length;
    
    if (queueSize === 0) {
      return res.status(200).json({ 
        success: true, 
        message: 'Queue is already empty' 
      });
    }
    
    if (!processingActive) {
      startProcessingQueue();
    }
    
    res.status(200).json({ 
      success: true, 
      message: `Forced processing of ${queueSize} queued receipts` 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Error forcing queue processing' 
    });
  }
};

export default {
  handleDeliveryReceipt,
  forceProcessQueue
}; 