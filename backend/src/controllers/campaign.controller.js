import Campaign from '../models/campaign.model.js';
import Customer from '../models/customer.model.js';
import campaignDeliveryService from '../services/campaign-delivery.service.js';
import CommunicationLog from '../models/communication-log.model.js';
import mongoose from 'mongoose';

// Helper to reliably resolve a valid ObjectId for createdBy / updatedBy
const getUserId = (req) => {
  if (req?.user?._id && mongoose.Types.ObjectId.isValid(req.user._id)) {
    return req.user._id;
  }
  if (req?.user?.id && mongoose.Types.ObjectId.isValid(req.user.id)) {
    return req.user.id;
  }
  if (req?.body?.createdBy && mongoose.Types.ObjectId.isValid(req.body.createdBy)) {
    return req.body.createdBy;
  }
  return '645a1d7c16f68e412f82f231';
};

// Helper function to validate segment rules
const validateSegmentRules = (rules) => {
  if (!rules || typeof rules !== 'object') {
    throw new Error('Invalid segment rules: rules must be an object');
  }
  
  if (!rules.operator || !['AND', 'OR'].includes(rules.operator)) {
    throw new Error('Invalid segment rules: operator must be AND or OR');
  }
  
  if (!Array.isArray(rules.conditions) || rules.conditions.length === 0) {
    throw new Error('Invalid segment rules: conditions must be a non-empty array');
  }
  
  // Recursively validate nested conditions
  rules.conditions.forEach(condition => {
    if (condition.operator && condition.conditions) {
      validateSegmentRules(condition);
    } else {
      if (!condition.type) {
        throw new Error('Invalid condition: type is required');
      }
      if (!condition.operator) {
        throw new Error('Invalid condition: operator is required');
      }
      if (condition.value === undefined || condition.value === null) {
        throw new Error('Invalid condition: value is required');
      }
    }
  });
};

// Create a new campaign
export const createCampaign = async (req, res) => {
  console.log('Campaign creation request received:', req.body);
  
  try {
    // Create a new campaign, attributing to authenticated user or valid fallback
    const campaignData = {
      ...req.body,
      createdBy: getUserId(req)
    };
    
    // Set defaults if missing
    if (!campaignData.metrics) {
      campaignData.metrics = {
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        unsubscribed: 0
      };
    }
    
    // Process segmentRules if provided
    if (campaignData.segmentRules) {
      // Validate the segment rules structure recursively
      validateSegmentRules(campaignData.segmentRules);
      console.log('Campaign with segment rules:', campaignData.segmentRules);
    }
    
    console.log('Creating campaign with data:', campaignData);
    
    const campaign = new Campaign(campaignData);
    const savedCampaign = await campaign.save();
    
    console.log('Campaign saved successfully:', savedCampaign);
    
    // Trigger the campaign delivery process
    try {
      // This is async but we don't wait for it to complete
      campaignDeliveryService.triggerCampaignDelivery(savedCampaign);
      console.log('Campaign delivery triggered for', savedCampaign._id);
    } catch (deliveryError) {
      console.error('Error triggering campaign delivery:', deliveryError);
      // We don't fail the request if delivery triggering fails,
      // just log the error and continue
    }
    
    res.status(201).json(savedCampaign);
  } catch (error) {
    console.error('Campaign creation error:', error);
    
    // Send a more detailed error
    res.status(400).json({
      error: {
        message: error.message,
        details: error.stack,
        status: 400
      }
    });
  }
};

// Get all campaigns
export const getCampaigns = async (req, res) => {
  try {
    const campaigns = await Campaign.find()
      .populate('segments', 'name')
      .populate('createdBy', 'displayName email')
      .sort({ createdAt: -1 });
    res.json(campaigns);
  } catch (error) {
    res.status(500).json({
      error: {
        message: error.message,
        status: 500
      }
    });
  }
};

// Get campaign by ID
export const getCampaignById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        error: {
          message: 'Campaign not found',
          status: 404
        }
      });
    }

    const campaign = await Campaign.findById(req.params.id)
      .populate('segments', 'name')
      .populate('createdBy', 'displayName email')
      .populate('updatedBy', 'displayName email');
    
    if (!campaign) {
      return res.status(404).json({
        error: {
          message: 'Campaign not found',
          status: 404
        }
      });
    }
    
    res.json(campaign);
  } catch (error) {
    res.status(500).json({
      error: {
        message: error.message,
        status: 500
      }
    });
  }
};

// Update campaign
export const updateCampaign = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        error: {
          message: 'Campaign not found',
          status: 404
        }
      });
    }

    const campaign = await Campaign.findById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({
        error: {
          message: 'Campaign not found',
          status: 404
        }
      });
    }
    
    // Update campaign fields
    Object.keys(req.body).forEach(key => {
      campaign[key] = req.body[key];
    });
    
    campaign.updatedBy = getUserId(req);
    await campaign.save();
    
    res.json(campaign);
  } catch (error) {
    res.status(400).json({
      error: {
        message: error.message,
        status: 400
      }
    });
  }
};

// Delete campaign
export const deleteCampaign = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        error: {
          message: 'Campaign not found',
          status: 404
        }
      });
    }

    const campaign = await Campaign.findById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({
        error: {
          message: 'Campaign not found',
          status: 404
        }
      });
    }
    
    await Campaign.deleteOne({ _id: campaign._id });
    res.json({ message: 'Campaign deleted successfully' });
  } catch (error) {
    res.status(500).json({
      error: {
        message: error.message,
        status: 500
      }
    });
  }
};

// Update campaign status
export const updateCampaignStatus = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        error: {
          message: 'Campaign not found',
          status: 404
        }
      });
    }

    const { status } = req.body;
    const campaign = await Campaign.findById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({
        error: {
          message: 'Campaign not found',
          status: 404
        }
      });
    }
    
    campaign.status = status;
    campaign.updatedBy = getUserId(req);
    await campaign.save();
    
    res.json(campaign);
  } catch (error) {
    res.status(400).json({
      error: {
        message: error.message,
        status: 400
      }
    });
  }
};

// Get campaign metrics
export const getCampaignMetrics = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        error: {
          message: 'Campaign not found',
          status: 404
        }
      });
    }

    const campaign = await Campaign.findById(req.params.id)
      .select('metrics name status');
    
    if (!campaign) {
      return res.status(404).json({
        error: {
          message: 'Campaign not found',
          status: 404
        }
      });
    }
    
    res.json({
      name: campaign.name,
      status: campaign.status,
      metrics: campaign.metrics
    });
  } catch (error) {
    res.status(500).json({
      error: {
        message: error.message,
        status: 500
      }
    });
  }
};

// Preview audience size based on segment rules
export const previewAudienceSize = async (req, res) => {
  try {
    const { segmentRules } = req.body;
    
    if (!segmentRules || !segmentRules.conditions || segmentRules.conditions.length === 0) {
      return res.status(400).json({
        error: {
          message: 'Invalid segment rules provided',
          status: 400
        }
      });
    }
    
    // Check if actual customers exist in database
    const totalCustomers = await Customer.countDocuments();
    if (totalCustomers > 0) {
      const matchingCustomers = await Customer.findBySegmentRules(segmentRules);
      const audienceSize = matchingCustomers.length;
      return res.json({
        totalAudience: totalCustomers,
        audienceSize,
        percentage: ((audienceSize / totalCustomers) * 100).toFixed(1)
      });
    }

    // Total audience size fallback base
    const baseSize = 10000;
    
    // Calculate a realistic audience size based on the specific rules
    const audienceSize = calculateAudienceSize(segmentRules, baseSize);
    
    res.json({
      totalAudience: baseSize,
      audienceSize,
      percentage: ((audienceSize / baseSize) * 100).toFixed(1)
    });
    
  } catch (error) {
    res.status(500).json({
      error: {
        message: error.message,
        status: 500
      }
    });
  }
};

// Helper function to calculate audience size recursively for nested rules
const calculateAudienceSize = (rule, totalAudience) => {
  if (!rule || !rule.conditions || rule.conditions.length === 0) {
    return totalAudience;
  }
  
  // Handle based on operator logic
  if (rule.operator === 'AND') {
    // With AND, we need to apply each condition in sequence, reducing the audience
    let currentAudience = totalAudience;
    
    rule.conditions.forEach(condition => {
      if (condition.operator && condition.conditions) {
        // Nested rule group
        currentAudience = calculateAudienceSize(condition, currentAudience);
      } else {
        // Simple condition
        currentAudience = applyConditionFactor(condition, currentAudience);
      }
    });
    
    return currentAudience;
  } else {
    // With OR, we calculate the union of all conditions
    // For the demo, we'll use a simplified approach:
    // - Calculate each condition separately
    // - Take the largest audience size and add a portion of the others
    
    const audienceSizes = rule.conditions.map(condition => {
      if (condition.operator && condition.conditions) {
        // Nested rule group
        return calculateAudienceSize(condition, totalAudience * 0.7); // Assume nested groups affect a portion
      } else {
        // Simple condition
        return applyConditionFactor(condition, totalAudience);
      }
    });
    
    if (audienceSizes.length === 0) return totalAudience * 0.5;
    
    // Sort in descending order
    audienceSizes.sort((a, b) => b - a);
    
    // Start with the largest audience
    let result = audienceSizes[0];
    
    // Add a portion of the others (avoiding double counting)
    for (let i = 1; i < audienceSizes.length; i++) {
      // For each additional condition, add a diminishing portion
      result += audienceSizes[i] * (0.3 / i);
    }
    
    // Cap at the total audience
    return Math.min(result, totalAudience);
  }
};

// Apply a single condition to calculate audience factor
const applyConditionFactor = (condition, audienceSize) => {
  let factor = 1.0;
  
  // Apply different factors based on condition type and operator
  switch(condition.type) {
    case 'spend':
      // Higher spend reduces audience more
      if (condition.operator === '>' || condition.operator === '>=') {
        // Spending more than X reduces audience size
        const spendValue = parseFloat(condition.value) || 0;
        factor = Math.max(0.05, 1 - (spendValue / 50000)); // Higher spend = smaller audience
      } else if (condition.operator === '<' || condition.operator === '<=') {
        // Spending less than X keeps more audience
        const spendValue = parseFloat(condition.value) || 0;
        factor = Math.min(0.95, spendValue / 20000); 
      }
      break;
      
    case 'visits':
      // More visits = smaller audience
      if (condition.operator === '>' || condition.operator === '>=') {
        const visitValue = parseInt(condition.value) || 0;
        factor = Math.max(0.1, 1 - (visitValue / 20)); 
      } else if (condition.operator === '<' || condition.operator === '<=') {
        const visitValue = parseInt(condition.value) || 0;
        factor = Math.min(0.9, visitValue / 10);
      }
      break;
      
    case 'inactive':
      // Longer inactivity = larger audience (typically)
      const inactiveDays = parseInt(condition.value) || 0;
      factor = Math.min(0.9, inactiveDays / 100);
      break;
      
    case 'purchases':
      // More purchases = smaller audience
      if (condition.operator === '>' || condition.operator === '>=') {
        const purchaseValue = parseInt(condition.value) || 0;
        factor = Math.max(0.1, 1 - (purchaseValue / 10)); 
      } else if (condition.operator === '<' || condition.operator === '<=') {
        const purchaseValue = parseInt(condition.value) || 0;
        factor = Math.min(0.9, purchaseValue / 5);
      }
      break;
      
    case 'location':
      // Location typically filters to a modest portion of audience
      factor = 0.3; // Assuming location targets about 30% of audience
      break;
      
    default:
      factor = 0.5; // Default reduction
  }
  
  return Math.round(audienceSize * factor);
};

// Get communication logs for a campaign
export const getCampaignCommunicationLogs = async (req, res) => {
  try {
    const { id: campaignId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(campaignId)) {
      return res.status(404).json({
        error: {
          message: 'Campaign not found',
          status: 404
        }
      });
    }

    const { page = 1, limit = 50, status } = req.query;
    
    // Convert page and limit to numbers
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    
    // Build query
    const query = { campaignId };
    if (status) {
      query.status = status;
    }
    
    // Count total logs matching the query
    const total = await CommunicationLog.countDocuments(query);
    
    // Get paginated logs
    const logs = await CommunicationLog.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate('userId', 'firstName lastName email phone');
    
    res.json({
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      logs
    });
  } catch (error) {
    res.status(500).json({
      error: {
        message: error.message,
        status: 500
      }
    });
  }
};

// Get communication log stats for a campaign
export const getCommunicationLogStats = async (req, res) => {
  try {
    const { id: campaignId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(campaignId)) {
      return res.status(404).json({
        error: {
          message: 'Campaign not found',
          status: 404
        }
      });
    }
    
    // Check if campaign exists
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({
        error: {
          message: 'Campaign not found',
          status: 404
        }
      });
    }
    
    // Aggregate stats by status
    const statusStats = await CommunicationLog.aggregate([
      { $match: { campaignId: new mongoose.Types.ObjectId(campaignId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    // Convert to a more usable format
    const stats = {
      total: 0,
      queued: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
      opened: 0,
      clicked: 0
    };
    
    statusStats.forEach(stat => {
      stats[stat._id] = stat.count;
      stats.total += stat.count;
    });
    
    res.json({
      campaignId,
      stats
    });
  } catch (error) {
    res.status(500).json({
      error: {
        message: error.message,
        status: 500
      }
    });
  }
};

export default {
  createCampaign,
  getCampaigns,
  getCampaignById,
  updateCampaign,
  deleteCampaign,
  updateCampaignStatus,
  getCampaignMetrics,
  previewAudienceSize,
  getCampaignCommunicationLogs,
  getCommunicationLogStats
}; 