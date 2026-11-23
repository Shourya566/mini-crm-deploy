import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '../lib/api';
import {
  getSegments,
  createSegment,
  updateSegment,
  deleteSegment,
  getCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  getCampaignHistory,
  previewAudienceSize,
  getCampaignCommunicationLogs,
  getCommunicationLogStats,
} from '../lib/crmApi';

describe('Frontend CRM Functionality Audit Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Segments API Integration & Search Filtering', () => {
    it('calls getSegments and receives audience segments', async () => {
      const mockData = [
        { _id: '1', name: 'High Spending Customers', memberCount: 15, type: 'dynamic' },
        { _id: '2', name: 'Inactive Users', memberCount: 8, type: 'dynamic' },
      ];
      vi.spyOn(api, 'get').mockResolvedValue({ data: mockData });

      const result = await getSegments();
      expect(api.get).toHaveBeenCalledWith('/api/segments');
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('High Spending Customers');
    });

    it('filters segments correctly based on search query', () => {
      const segments = [
        { _id: '1', name: 'High Spending Customers' },
        { _id: '2', name: 'Inactive Customers' },
        { _id: '3', name: 'VIP Members' },
      ];

      const query = 'high';
      const filtered = segments.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()));
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('High Spending Customers');
    });

    it('submits createSegment, updateSegment, and deleteSegment with correct endpoints', async () => {
      vi.spyOn(api, 'post').mockResolvedValue({ data: { _id: 'new-seg', name: 'New Segment' } });
      vi.spyOn(api, 'put').mockResolvedValue({ data: { _id: 'edit-seg', name: 'Updated Segment' } });
      vi.spyOn(api, 'delete').mockResolvedValue({ data: { message: 'Deleted' } });

      const created = await createSegment({ name: 'New Segment', type: 'dynamic' });
      expect(api.post).toHaveBeenCalledWith('/api/segments', { name: 'New Segment', type: 'dynamic' });
      expect(created._id).toBe('new-seg');

      const updated = await updateSegment('edit-seg', { name: 'Updated Segment' });
      expect(api.put).toHaveBeenCalledWith('/api/segments/edit-seg', { name: 'Updated Segment' });
      expect(updated.name).toBe('Updated Segment');

      const deleted = await deleteSegment('del-seg');
      expect(api.delete).toHaveBeenCalledWith('/api/segments/del-seg');
      expect(deleted.message).toBe('Deleted');
    });
  });

  describe('2. Campaigns API, Validation & Audience Preview', () => {
    it('calculates audience preview size correctly', async () => {
      vi.spyOn(api, 'post').mockResolvedValue({
        data: { totalAudience: 100, audienceSize: 42, percentage: '42.0' },
      });

      const rules = {
        operator: 'AND',
        conditions: [{ type: 'spend', operator: '>', value: '5000' }],
      };

      const result = await previewAudienceSize(rules);
      expect(api.post).toHaveBeenCalledWith('/api/campaigns/audience-preview', { segmentRules: rules });
      expect(result.audienceSize).toBe(42);
      expect(result.percentage).toBe('42.0');
    });

    it('calls getCampaigns, createCampaign, and deleteCampaign', async () => {
      vi.spyOn(api, 'get').mockResolvedValue({
        data: [{ _id: 'camp-1', name: 'Summer Campaign', status: 'active' }],
      });
      vi.spyOn(api, 'post').mockResolvedValue({
        data: { _id: 'camp-new', name: 'Winter Warmup', status: 'draft' },
      });
      vi.spyOn(api, 'delete').mockResolvedValue({
        data: { message: 'Campaign deleted' },
      });

      const campaigns = await getCampaigns();
      expect(api.get).toHaveBeenCalledWith('/api/campaigns');
      expect(campaigns[0].name).toBe('Summer Campaign');

      const newCampaign = await createCampaign({ name: 'Winter Warmup' });
      expect(api.post).toHaveBeenCalledWith('/api/campaigns', { name: 'Winter Warmup' });
      expect(newCampaign.name).toBe('Winter Warmup');

      const delResult = await deleteCampaign('camp-1');
      expect(api.delete).toHaveBeenCalledWith('/api/campaigns/camp-1');
      expect(delResult.message).toBe('Campaign deleted');
    });
  });

  describe('3. Campaign History & Delivery Stats Calculations', () => {
    it('calls getCampaignHistory and maps history endpoint', async () => {
      vi.spyOn(api, 'get').mockResolvedValue({
        data: [{ _id: 'camp-h1', name: 'Past Flash Sale', status: 'completed' }],
      });

      const history = await getCampaignHistory();
      expect(api.get).toHaveBeenCalledWith('/api/campaigns/history');
      expect(history[0].name).toBe('Past Flash Sale');
    });

    it('calculates delivery summary rates accurately without NaN or division by zero', () => {
      const calculateStats = (metrics) => {
        const sent = metrics?.sent || 0;
        const delivered = metrics?.delivered || 0;
        const bounced = metrics?.bounced || 0;
        const opened = metrics?.opened || 0;
        const clicked = metrics?.clicked || 0;

        const deliveryRate = sent > 0 ? Math.round((delivered / sent) * 100) : 0;
        const failureRate = sent > 0 ? Math.round((bounced / sent) * 100) : 0;
        const openRate = delivered > 0 ? Math.round((opened / delivered) * 100) : 0;
        const clickRate = opened > 0 ? Math.round((clicked / opened) * 100) : 0;

        return { deliveryRate, failureRate, openRate, clickRate };
      };

      // Scenario 1: Zero metrics
      const zeroStats = calculateStats({ sent: 0, delivered: 0, bounced: 0, opened: 0, clicked: 0 });
      expect(zeroStats.deliveryRate).toBe(0);
      expect(zeroStats.failureRate).toBe(0);
      expect(zeroStats.openRate).toBe(0);
      expect(zeroStats.clickRate).toBe(0);

      // Scenario 2: Active campaign metrics
      const activeStats = calculateStats({ sent: 100, delivered: 90, bounced: 10, opened: 45, clicked: 15 });
      expect(activeStats.deliveryRate).toBe(90);
      expect(activeStats.failureRate).toBe(10);
      expect(activeStats.openRate).toBe(50);
      expect(activeStats.clickRate).toBe(33);
    });

    it('fetches communication logs and log stats for a campaign', async () => {
      vi.spyOn(api, 'get').mockImplementation((url) => {
        if (url.includes('communication-logs')) {
          return Promise.resolve({
            data: { total: 1, logs: [{ _id: 'log-1', status: 'delivered' }] },
          });
        }
        if (url.includes('log-stats')) {
          return Promise.resolve({
            data: { campaignId: 'c1', stats: { delivered: 10, failed: 1, total: 11 } },
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      const logs = await getCampaignCommunicationLogs('c1');
      expect(logs.total).toBe(1);
      expect(logs.logs[0].status).toBe('delivered');

      const stats = await getCommunicationLogStats('c1');
      expect(stats.stats.delivered).toBe(10);
      expect(stats.stats.total).toBe(11);
    });
  });

  describe('4. Dashboard Metrics Aggregation', () => {
    it('aggregates total segments, active campaigns, and average engagement rate', () => {
      const mockSegments = [
        { _id: '1', name: 'High Spenders' },
        { _id: '2', name: 'Recent Visitors' },
        { _id: '3', name: 'Cart Abandoners' },
      ];

      const mockCampaigns = [
        { _id: 'c1', name: 'Camp 1', status: 'active', metrics: { sent: 100, opened: 40 } },
        { _id: 'c2', name: 'Camp 2', status: 'active', metrics: { sent: 200, opened: 60 } },
        { _id: 'c3', name: 'Camp 3', status: 'draft', metrics: { sent: 0, opened: 0 } },
      ];

      const totalSegments = mockSegments.length;
      const activeCampaigns = mockCampaigns.filter((c) => c.status === 'active').length;

      const totalEngagement = mockCampaigns.reduce((sum, campaign) => {
        const { opened, sent } = campaign.metrics || { opened: 0, sent: 0 };
        return sum + (sent > 0 ? (opened / sent) * 100 : 0);
      }, 0);
      const avgEngagement = mockCampaigns.length > 0
        ? (totalEngagement / mockCampaigns.length).toFixed(1)
        : '0.0';

      expect(totalSegments).toBe(3);
      expect(activeCampaigns).toBe(2);
      // (40% + 30% + 0%) / 3 = 70 / 3 = 23.333% -> '23.3'
      expect(avgEngagement).toBe('23.3');
    });
  });
});
