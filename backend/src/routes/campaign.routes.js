import express from 'express';
import { createCampaign, getCampaigns, getCampaignById, updateCampaign, deleteCampaign, updateCampaignStatus, getCampaignMetrics, previewAudienceSize, getCampaignCommunicationLogs, getCommunicationLogStats } from '../controllers/campaign.controller.js';
import { isAuthenticated } from '../middleware/auth.middleware.js';

const router = express.Router();

// Routes that don't require authentication
router.post('/', createCampaign); // Campaign creation without auth for testing
router.post('/audience-preview', previewAudienceSize);

// These routes work without authentication for now
router.get('/', getCampaigns);
router.get('/history', getCampaigns);
router.get('/:id', getCampaignById);

// Routes that require authentication
router.use(isAuthenticated);
router.put('/:id', updateCampaign);
router.delete('/:id', deleteCampaign);
router.patch('/:id/status', updateCampaignStatus);
router.get('/:id/metrics', getCampaignMetrics);

// Communication log routes
router.get('/:id/communication-logs', getCampaignCommunicationLogs);
router.get('/:id/log-stats', getCommunicationLogStats);

export default router; 