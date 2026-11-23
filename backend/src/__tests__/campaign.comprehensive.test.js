import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import Campaign from '../models/campaign.model.js';
import Customer from '../models/customer.model.js';
import CommunicationLog from '../models/communication-log.model.js';
import campaignDeliveryService from '../services/campaign-delivery.service.js';
import {
  createCampaign,
  getCampaigns,
  getCampaignById,
  updateCampaign,
  deleteCampaign,
  updateCampaignStatus,
  getCampaignMetrics,
  previewAudienceSize,
  getCampaignCommunicationLogs,
  getCommunicationLogStats,
} from '../controllers/campaign.controller.js';
import { handleDeliveryReceipt } from '../controllers/delivery-receipt.controller.js';
import { generateSegmentRules, generateMessageSuggestions } from '../controllers/ai.controller.js';

describe('Comprehensive Campaign & Audit Test Suite', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Campaign Creation and Schema Validation', () => {
    it('successfully validates and creates a campaign with segment rules', async () => {
      const validCampaign = new Campaign({
        name: 'Summer Sale 2026',
        description: 'Special 20% discount on summer collection',
        type: 'email',
        status: 'draft',
        content: {
          subject: 'Summer Deals Just For You',
          body: 'Hi {{name}}, enjoy 20% off!',
        },
        segmentRules: {
          operator: 'AND',
          conditions: [
            { type: 'spend', operator: '>', value: '5000' },
            { type: 'visits', operator: '>=', value: '3' },
          ],
        },
        createdBy: new mongoose.Types.ObjectId('645a1d7c16f68e412f82f231'),
      });

      const validationError = validCampaign.validateSync();
      expect(validationError).toBeUndefined();
      expect(validCampaign.name).toBe('Summer Sale 2026');
      expect(validCampaign.type).toBe('email');
      expect(validCampaign.segmentRules.operator).toBe('AND');
      expect(validCampaign.segmentRules.conditions).toHaveLength(2);
    });

    it('rejects campaign creation without required name or invalid segment rules', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const req = {
        body: {
          type: 'email',
          content: { subject: 'Test', body: 'Test' },
          segmentRules: {
            operator: 'INVALID_OP',
            conditions: [],
          },
        },
      };

      let statusCode = 200;
      let jsonResult = null;
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          jsonResult = data;
          return this;
        },
      };

      try {
        await createCampaign(req, res);
        expect(statusCode).toBe(400);
        expect(jsonResult.error).toBeDefined();
      } finally {
        errorSpy.mockRestore();
      }
    });

    it('creates campaign and attributes createdBy to authenticated user', async () => {
      const mockSaved = {
        _id: '645a1d7c16f68e412f82f231',
        name: 'Loyalty Rewards Campaign',
        type: 'email',
        createdBy: '645a1d7c16f68e412f82f231',
        metrics: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 },
      };

      jest.spyOn(Campaign.prototype, 'save').mockResolvedValue(mockSaved);
      jest.spyOn(campaignDeliveryService, 'triggerCampaignDelivery').mockReturnValue(Promise.resolve());

      const req = {
        user: { _id: '645a1d7c16f68e412f82f231' },
        body: {
          name: 'Loyalty Rewards Campaign',
          type: 'email',
          content: { subject: 'Loyalty Rewards', body: 'Exclusive offers inside' },
        },
      };

      let statusCode = 200;
      let jsonResult = null;
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          jsonResult = data;
          return this;
        },
      };

      await createCampaign(req, res);
      expect(statusCode).toBe(201);
      expect(jsonResult.name).toBe('Loyalty Rewards Campaign');
    });
  });

  describe('2. Campaign Queries, ID Validation & History', () => {
    it('returns campaigns list for getCampaigns', async () => {
      const mockCampaigns = [
        { _id: 'camp-1', name: 'Campaign One', status: 'active', metrics: { sent: 100, delivered: 90 } },
        { _id: 'camp-2', name: 'Campaign Two', status: 'draft', metrics: { sent: 0, delivered: 0 } },
      ];

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockCampaigns),
      };
      jest.spyOn(Campaign, 'find').mockReturnValue(mockQuery);

      const req = {};
      let jsonResult = null;
      const res = {
        json(data) {
          jsonResult = data;
          return this;
        },
      };

      await getCampaigns(req, res);
      expect(Array.isArray(jsonResult)).toBe(true);
      expect(jsonResult).toHaveLength(2);
      expect(jsonResult[0].name).toBe('Campaign One');
    });

    it('returns 404 for invalid ObjectId in getCampaignById', async () => {
      const req = { params: { id: 'invalid-non-hex-id' } };
      let statusCode = 200;
      let jsonResult = null;
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          jsonResult = data;
          return this;
        },
      };

      await getCampaignById(req, res);
      expect(statusCode).toBe(404);
      expect(jsonResult.error.message).toBe('Campaign not found');
    });

    it('updates campaign fields cleanly and returns updated campaign', async () => {
      const validId = '645a1d7c16f68e412f82f231';
      const mockCampaign = {
        _id: validId,
        name: 'Original Name',
        status: 'draft',
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(Campaign, 'findById').mockResolvedValue(mockCampaign);

      const req = {
        params: { id: validId },
        user: { _id: validId },
        body: { name: 'Updated Campaign Name', status: 'active' },
      };

      let jsonResult = null;
      const res = {
        json(data) {
          jsonResult = data;
          return this;
        },
      };

      await updateCampaign(req, res);
      expect(mockCampaign.name).toBe('Updated Campaign Name');
      expect(mockCampaign.status).toBe('active');
      expect(mockCampaign.save).toHaveBeenCalled();
    });

    it('deletes campaign and returns success message', async () => {
      const validId = '645a1d7c16f68e412f82f231';
      const mockCampaign = { _id: validId };

      jest.spyOn(Campaign, 'findById').mockResolvedValue(mockCampaign);
      jest.spyOn(Campaign, 'deleteOne').mockResolvedValue({ deletedCount: 1 });

      const req = { params: { id: validId } };
      let jsonResult = null;
      const res = {
        json(data) {
          jsonResult = data;
          return this;
        },
      };

      await deleteCampaign(req, res);
      expect(jsonResult.message).toContain('deleted successfully');
    });
  });

  describe('3. Audience Preview Functionality', () => {
    it('previews audience size accurately using Customer data when available', async () => {
      jest.spyOn(Customer, 'countDocuments').mockResolvedValue(100);
      jest.spyOn(Customer, 'findBySegmentRules').mockResolvedValue(new Array(35).fill({}));

      const req = {
        body: {
          segmentRules: {
            operator: 'AND',
            conditions: [{ type: 'spend', operator: '>', value: '5000' }],
          },
        },
      };

      let jsonResult = null;
      const res = {
        json(data) {
          jsonResult = data;
          return this;
        },
      };

      await previewAudienceSize(req, res);
      expect(jsonResult.totalAudience).toBe(100);
      expect(jsonResult.audienceSize).toBe(35);
      expect(jsonResult.percentage).toBe('35.0');
    });

    it('rejects audience preview with empty segment rules', async () => {
      const req = { body: { segmentRules: { operator: 'AND', conditions: [] } } };
      let statusCode = 200;
      let jsonResult = null;
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          jsonResult = data;
          return this;
        },
      };

      await previewAudienceSize(req, res);
      expect(statusCode).toBe(400);
    });
  });

  describe('4. Communication Logs and Delivery Stats', () => {
    it('retrieves paginated communication logs and populates Customer details', async () => {
      const campaignId = '645a1d7c16f68e412f82f231';
      const mockLogs = [
        {
          _id: 'log-1',
          campaignId,
          userId: { firstName: 'Aarav', lastName: 'Patel', email: 'aarav@example.com', phone: '+919876543210' },
          status: 'delivered',
          metadata: { vendorMessageId: 'msg-123' },
        },
      ];

      jest.spyOn(CommunicationLog, 'countDocuments').mockResolvedValue(1);
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue(mockLogs),
      };
      jest.spyOn(CommunicationLog, 'find').mockReturnValue(mockQuery);

      const req = {
        params: { id: campaignId },
        query: { page: '1', limit: '10' },
      };

      let jsonResult = null;
      const res = {
        json(data) {
          jsonResult = data;
          return this;
        },
      };

      await getCampaignCommunicationLogs(req, res);
      expect(jsonResult.total).toBe(1);
      expect(jsonResult.logs).toHaveLength(1);
      expect(jsonResult.logs[0].userId.firstName).toBe('Aarav');
      expect(jsonResult.logs[0].userId.email).toBe('aarav@example.com');
    });

    it('aggregates communication log statistics using new mongoose.Types.ObjectId without error', async () => {
      const campaignId = '645a1d7c16f68e412f82f231';
      const mockCampaign = { _id: campaignId, name: 'Flash Sale' };

      jest.spyOn(Campaign, 'findById').mockResolvedValue(mockCampaign);
      jest.spyOn(CommunicationLog, 'aggregate').mockResolvedValue([
        { _id: 'delivered', count: 45 },
        { _id: 'failed', count: 5 },
        { _id: 'sent', count: 10 },
      ]);

      const req = { params: { id: campaignId } };
      let jsonResult = null;
      const res = {
        json(data) {
          jsonResult = data;
          return this;
        },
      };

      await getCommunicationLogStats(req, res);
      expect(jsonResult.campaignId).toBe(campaignId);
      expect(jsonResult.stats.delivered).toBe(45);
      expect(jsonResult.stats.failed).toBe(5);
      expect(jsonResult.stats.sent).toBe(10);
      expect(jsonResult.stats.total).toBe(60);
    });

    it('queues and handles delivery receipt updates to log and campaign metrics', async () => {
      jest.spyOn(CommunicationLog, 'find').mockResolvedValue([]);
      const receiptData = {
        messageId: 'msg_test_999',
        status: 'delivered',
        timestamp: new Date().toISOString(),
      };

      let statusCode = 200;
      let jsonResult = null;
      const req = { body: receiptData };
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          jsonResult = data;
          return this;
        },
      };

      await handleDeliveryReceipt(req, res);
      expect(statusCode).toBe(200);
      expect(jsonResult.success).toBe(true);
      await new Promise((r) => setTimeout(r, 50));
    });
  });

  describe('5. AI Assistant Fallbacks', () => {
    it('generates fallback segment rules gracefully when OpenAI is not configured', async () => {
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      try {
        const req = {
          body: { prompt: 'Customers who spent over 5000 and visited more than 10 times in Mumbai' },
        };

        let jsonResult = null;
        const res = {
          json(data) {
            jsonResult = data;
            return this;
          },
        };

        await generateSegmentRules(req, res);
        expect(jsonResult).toBeDefined();
        expect(jsonResult.operator).toBe('AND');
        expect(Array.isArray(jsonResult.conditions)).toBe(true);
        expect(jsonResult.conditions.some((c) => c.type === 'spend' && c.value === '5000')).toBe(true);
        expect(jsonResult.conditions.some((c) => c.type === 'visits' && c.value === '10')).toBe(true);
        expect(jsonResult.conditions.some((c) => c.type === 'location' && c.value.toLowerCase() === 'mumbai')).toBe(true);
      } finally {
        if (originalKey) process.env.OPENAI_API_KEY = originalKey;
      }
    });

    it('generates fallback message suggestions gracefully when OpenAI is not configured', async () => {
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      try {
        const req = {
          body: {
            objective: 'Announce 20% off summer collection',
            audience: 'VIP Customers',
          },
        };

        let jsonResult = null;
        const res = {
          json(data) {
            jsonResult = data;
            return this;
          },
        };

        await generateMessageSuggestions(req, res);
        expect(Array.isArray(jsonResult)).toBe(true);
        expect(jsonResult).toHaveLength(3);
        expect(jsonResult[0].tone).toBe('professional');
        expect(jsonResult[1].tone).toBe('friendly');
        expect(jsonResult[2].tone).toBe('persuasive');
      } finally {
        if (originalKey) process.env.OPENAI_API_KEY = originalKey;
      }
    });
  });
});
