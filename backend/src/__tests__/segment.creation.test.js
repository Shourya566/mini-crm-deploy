import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import Segment from '../models/segment.model.js';
import Customer from '../models/customer.model.js';
import { createSegment, getSegments, getSegmentById, updateSegment, deleteSegment, updateCriteria } from '../controllers/segment.controller.js';

describe('Segment Controller and Validation Test Suite', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Model Schema Validation', () => {
    it('validates a correct dynamic segment matching user specifications', () => {
      const segment = new Segment({
        name: 'High Spending Customers',
        description: 'Customers with total spend over 5000',
        type: 'dynamic',
        criteria: [
          {
            field: 'spend',
            operator: 'greaterThan',
            value: 5000
          }
        ],
        createdBy: new mongoose.Types.ObjectId('645a1d7c16f68e412f82f231')
      });

      const validationError = segment.validateSync();
      expect(validationError).toBeUndefined();
      expect(segment.name).toBe('High Spending Customers');
      expect(segment.criteria[0].field).toBe('spend');
      expect(segment.criteria[0].operator).toBe('greaterThan');
      expect(segment.criteria[0].value).toBe(5000);
    });

    it('fails validation when name is missing', () => {
      const segment = new Segment({
        description: 'No name',
        type: 'dynamic',
        criteria: [{ field: 'spend', operator: 'greaterThan', value: 5000 }],
        createdBy: new mongoose.Types.ObjectId('645a1d7c16f68e412f82f231')
      });

      const validationError = segment.validateSync();
      expect(validationError).toBeDefined();
      expect(validationError.errors.name).toBeDefined();
    });

    it('fails validation when operator is not in allowed enum', () => {
      const segment = new Segment({
        name: 'Invalid Operator',
        type: 'dynamic',
        criteria: [{ field: 'spend', operator: 'INVALID_OP', value: 5000 }],
        createdBy: new mongoose.Types.ObjectId('645a1d7c16f68e412f82f231')
      });

      const validationError = segment.validateSync();
      expect(validationError).toBeDefined();
      expect(validationError.errors['criteria.0.operator']).toBeDefined();
    });

    it('fails validation when createdBy is missing', () => {
      const segment = new Segment({
        name: 'Missing CreatedBy',
        type: 'dynamic',
        criteria: [{ field: 'spend', operator: 'greaterThan', value: 5000 }]
      });

      const validationError = segment.validateSync();
      expect(validationError).toBeDefined();
      expect(validationError.errors.createdBy).toBeDefined();
    });
  });

  describe('createSegment Controller', () => {
    it('successfully creates a segment with dev bypass user (fallback to valid ObjectId)', async () => {
      const mockSaved = {
        _id: new mongoose.Types.ObjectId('645a1d7c16f68e412f82f231'),
        name: 'High Spending Customers',
        type: 'dynamic',
        criteria: [{ field: 'spend', operator: 'greaterThan', value: 5000 }],
        createdBy: new mongoose.Types.ObjectId('645a1d7c16f68e412f82f231'),
        memberCount: 5
      };

      jest.spyOn(Customer, 'findBySegmentRules').mockResolvedValue([{}, {}, {}, {}, {}]);
      jest.spyOn(Segment.prototype, 'save').mockImplementation(function() {
        return Promise.resolve(this);
      });

      const req = {
        body: {
          name: 'High Spending Customers',
          description: '',
          type: 'dynamic',
          criteria: [{ field: 'spend', operator: 'greaterThan', value: 5000 }],
          createdBy: '645a1d7c16f68e412f82f231'
        },
        user: {
          id: 'dev-user-123',
          email: 'dev@example.com',
          role: 'admin'
        }
      };

      let statusCode = null;
      let jsonResult = null;

      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          jsonResult = data;
          return this;
        }
      };

      await createSegment(req, res);

      expect(statusCode).toBe(201);
      expect(jsonResult).toBeDefined();
      expect(jsonResult.name).toBe('High Spending Customers');
      expect(jsonResult.type).toBe('dynamic');
      expect(jsonResult.memberCount).toBe(5);
      expect(jsonResult.createdBy.toString()).toBe('645a1d7c16f68e412f82f231');
    });

    it('returns HTTP 400 with message when Segment.prototype.save rejects', async () => {
      jest.spyOn(Customer, 'findBySegmentRules').mockResolvedValue([]);
      jest.spyOn(Segment.prototype, 'save').mockRejectedValue(new Error('Segment validation failed: name: Path `name` is required.'));

      const req = {
        body: { type: 'dynamic', criteria: [] },
        user: { _id: '645a1d7c16f68e412f82f231' }
      };

      let statusCode = null;
      let jsonResult = null;

      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          jsonResult = data;
          return this;
        }
      };

      await createSegment(req, res);

      expect(statusCode).toBe(400);
      expect(jsonResult.error).toBeDefined();
      expect(jsonResult.error.message).toContain('name');
    });
  });

  describe('getSegments and getSegmentById Controllers', () => {
    it('returns segments list via getSegments', async () => {
      const mockSegments = [
        { _id: '1', name: 'High Spending Customers', memberCount: 10 },
        { _id: '2', name: 'Inactive Users', memberCount: 20 }
      ];

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockSegments)
      };
      jest.spyOn(Segment, 'find').mockReturnValue(mockQuery);

      const req = {};
      let jsonResult = null;
      const res = {
        json(data) {
          jsonResult = data;
          return this;
        }
      };

      await getSegments(req, res);

      expect(Array.isArray(jsonResult)).toBe(true);
      expect(jsonResult).toHaveLength(2);
      expect(jsonResult[0].name).toBe('High Spending Customers');
    });

    it('returns a single segment via getSegmentById', async () => {
      const mockSegment = { _id: 'seg-1', name: 'High Spending Customers' };
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        then: undefined
      };
      // Chain 3 populates
      mockQuery.populate.mockReturnValueOnce(mockQuery)
        .mockReturnValueOnce(mockQuery)
        .mockResolvedValueOnce(mockSegment);

      jest.spyOn(Segment, 'findById').mockReturnValue(mockQuery);

      const req = { params: { id: 'seg-1' } };
      let jsonResult = null;
      const res = {
        json(data) {
          jsonResult = data;
          return this;
        }
      };

      await getSegmentById(req, res);
      expect(jsonResult).toBeDefined();
      expect(jsonResult.name).toBe('High Spending Customers');
    });

    it('returns 404 when segment is not found by ID', async () => {
      const mockQuery = {
        populate: jest.fn().mockReturnThis()
      };
      mockQuery.populate.mockReturnValueOnce(mockQuery)
        .mockReturnValueOnce(mockQuery)
        .mockResolvedValueOnce(null);

      jest.spyOn(Segment, 'findById').mockReturnValue(mockQuery);

      const req = { params: { id: 'nonexistent-id' } };
      let statusCode = null;
      let jsonResult = null;
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          jsonResult = data;
          return this;
        }
      };

      await getSegmentById(req, res);
      expect(statusCode).toBe(404);
      expect(jsonResult.error.message).toBe('Segment not found');
    });
  });

  describe('updateSegment and deleteSegment Controllers', () => {
    it('updates segment and recalculates memberCount', async () => {
      const mockDoc = {
        _id: 'seg-1',
        name: 'Old Name',
        type: 'dynamic',
        criteria: [{ field: 'spend', operator: 'greaterThan', value: 10000 }],
        memberCount: 2,
        save: jest.fn().mockResolvedValue(true)
      };

      jest.spyOn(Segment, 'findById').mockResolvedValue(mockDoc);
      jest.spyOn(Customer, 'findBySegmentRules').mockResolvedValue([{}, {}]);

      const req = {
        params: { id: 'seg-1' },
        body: { name: 'New Name' },
        user: { _id: '645a1d7c16f68e412f82f231' }
      };

      let jsonResult = null;
      const res = {
        json(data) {
          jsonResult = data;
          return this;
        }
      };

      await updateSegment(req, res);

      expect(mockDoc.name).toBe('New Name');
      expect(mockDoc.save).toHaveBeenCalled();
      expect(jsonResult.name).toBe('New Name');
    });

    it('deletes segment using deleteOne without crashing', async () => {
      const mockDoc = {
        _id: 'seg-1',
        deleteOne: jest.fn().mockResolvedValue(true)
      };

      jest.spyOn(Segment, 'findById').mockResolvedValue(mockDoc);

      const req = { params: { id: 'seg-1' } };
      let jsonResult = null;
      const res = {
        json(data) {
          jsonResult = data;
          return this;
        }
      };

      await deleteSegment(req, res);

      expect(mockDoc.deleteOne).toHaveBeenCalled();
      expect(jsonResult.message).toBe('Segment deleted successfully');
    });
  });

  describe('Customer.findBySegmentRules operator compatibility', () => {
    it('generates correct Mongo query for totalSpend with greaterThan', async () => {
      const querySpy = jest.spyOn(Customer, 'find').mockReturnValue({
        select: jest.fn().mockResolvedValue([])
      });

      await Customer.findBySegmentRules({
        operator: 'AND',
        conditions: [{ type: 'spend', operator: 'greaterThan', value: 5000 }]
      });

      expect(querySpy).toHaveBeenCalledWith({
        $and: [{ 'stats.totalSpend': { $gt: 5000 } }]
      });
    });

    it('generates correct Mongo query for totalSpend with symbol >', async () => {
      const querySpy = jest.spyOn(Customer, 'find').mockReturnValue({
        select: jest.fn().mockResolvedValue([])
      });

      await Customer.findBySegmentRules({
        operator: 'AND',
        conditions: [{ type: 'spend', operator: '>', value: 5000 }]
      });

      expect(querySpy).toHaveBeenCalledWith({
        $and: [{ 'stats.totalSpend': { $gt: 5000 } }]
      });
    });
  });
});
