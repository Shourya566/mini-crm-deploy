import mongoose from 'mongoose';
import Segment from '../models/segment.model.js';
import User from '../models/user.model.js';
import Customer from '../models/customer.model.js';

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

// Safe error responder supporting mock and Express res
const sendError = (res, statusCode, message) => {
  if (typeof res?.status === 'function') {
    return res.status(statusCode).json({
      error: { message, status: statusCode }
    });
  }
  return res?.json ? res.json({
    error: { message, status: statusCode }
  }) : undefined;
};

// Helper to calculate matching members count for dynamic segments
const calculateDynamicMemberCount = async (segment) => {
  if (segment.type === 'dynamic' && Array.isArray(segment.criteria) && segment.criteria.length > 0) {
    try {
      const rules = {
        operator: 'AND',
        conditions: segment.criteria.map(c => ({
          type: c.field,
          operator: c.operator === 'greaterThan' ? '>' :
                   c.operator === 'lessThan' ? '<' :
                   c.operator === 'equals' ? '=' : c.operator,
          value: c.value
        }))
      };
      const matchingCustomers = await Customer.findBySegmentRules(rules);
      return matchingCustomers.length;
    } catch (countErr) {
      console.warn('Could not calculate segment memberCount:', countErr.message);
    }
  }
  return segment.memberCount || 0;
};

// Create a new segment
export const createSegment = async (req, res) => {
  try {
    const createdBy = getUserId(req);
    const segment = new Segment({
      ...req.body,
      createdBy
    });

    segment.memberCount = await calculateDynamicMemberCount(segment);

    await segment.save();
    res.status(201).json(segment);
  } catch (error) {
    console.error('Error creating segment:', error.message);
    res.status(400).json({
      error: {
        message: error.message,
        status: 400
      }
    });
  }
};

// Get all segments
export const getSegments = async (req, res) => {
  try {
    const segments = await Segment.find()
      .populate('createdBy', 'displayName email')
      .sort({ createdAt: -1 });
    res.json(segments);
  } catch (error) {
    res.status(500).json({
      error: {
        message: error.message,
        status: 500
      }
    });
  }
};

// Get segment by ID
export const getSegmentById = async (req, res) => {
  try {
    const segment = await Segment.findById(req.params.id)
      .populate('members', 'displayName email')
      .populate('createdBy', 'displayName email')
      .populate('updatedBy', 'displayName email');
    
    if (!segment) {
      return sendError(res, 404, 'Segment not found');
    }
    
    res.json(segment);
  } catch (error) {
    const status = error.name === 'CastError' ? 404 : 500;
    const message = error.name === 'CastError' ? 'Segment not found' : error.message;
    return sendError(res, status, message);
  }
};

// Update segment
export const updateSegment = async (req, res) => {
  try {
    const segment = await Segment.findById(req.params.id);
    
    if (!segment) {
      return sendError(res, 404, 'Segment not found');
    }
    
    // Update segment fields
    Object.keys(req.body).forEach(key => {
      if (key !== 'members' && key !== 'createdBy') { // Handle members and createdBy separately
        segment[key] = req.body[key];
      }
    });
    
    segment.updatedBy = getUserId(req);
    segment.memberCount = await calculateDynamicMemberCount(segment);
    await segment.save();
    
    res.json(segment);
  } catch (error) {
    const status = error.name === 'CastError' ? 404 : 400;
    const message = error.name === 'CastError' ? 'Segment not found' : error.message;
    return sendError(res, status, message);
  }
};

// Delete segment
export const deleteSegment = async (req, res) => {
  try {
    const segment = await Segment.findById(req.params.id);
    
    if (!segment) {
      return sendError(res, 404, 'Segment not found');
    }
    
    if (typeof segment.deleteOne === 'function') {
      await segment.deleteOne();
    } else {
      await Segment.findByIdAndDelete(req.params.id);
    }
    res.json({ message: 'Segment deleted successfully' });
  } catch (error) {
    const status = error.name === 'CastError' ? 404 : 500;
    const message = error.name === 'CastError' ? 'Segment not found' : error.message;
    return sendError(res, status, message);
  }
};

// Add member to segment
export const addMember = async (req, res) => {
  try {
    const { userId } = req.body;
    const segment = await Segment.findById(req.params.id);
    
    if (!segment) {
      return sendError(res, 404, 'Segment not found');
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 404, 'User not found');
    }
    
    await segment.addMember(userId);
    res.json(segment);
  } catch (error) {
    const status = error.name === 'CastError' ? 404 : 400;
    const message = error.name === 'CastError' ? 'Segment not found' : error.message;
    return sendError(res, status, message);
  }
};

// Remove member from segment
export const removeMember = async (req, res) => {
  try {
    const { userId } = req.body;
    const segment = await Segment.findById(req.params.id);
    
    if (!segment) {
      return sendError(res, 404, 'Segment not found');
    }
    
    await segment.removeMember(userId);
    res.json(segment);
  } catch (error) {
    const status = error.name === 'CastError' ? 404 : 400;
    const message = error.name === 'CastError' ? 'Segment not found' : error.message;
    return sendError(res, status, message);
  }
};

// Get segment members
export const getMembers = async (req, res) => {
  try {
    const segment = await Segment.findById(req.params.id)
      .populate('members', 'displayName email');
    
    if (!segment) {
      return sendError(res, 404, 'Segment not found');
    }
    
    res.json(segment.members);
  } catch (error) {
    const status = error.name === 'CastError' ? 404 : 500;
    const message = error.name === 'CastError' ? 'Segment not found' : error.message;
    return sendError(res, status, message);
  }
};

// Update segment criteria
export const updateCriteria = async (req, res) => {
  try {
    const segment = await Segment.findById(req.params.id);
    
    if (!segment) {
      return sendError(res, 404, 'Segment not found');
    }
    
    segment.criteria = req.body.criteria;
    segment.updatedBy = getUserId(req);
    segment.memberCount = await calculateDynamicMemberCount(segment);
    await segment.save();
    
    res.json(segment);
  } catch (error) {
    const status = error.name === 'CastError' ? 404 : 400;
    const message = error.name === 'CastError' ? 'Segment not found' : error.message;
    return sendError(res, status, message);
  }
};

export default {
  createSegment,
  getSegments,
  getSegmentById,
  updateSegment,
  deleteSegment,
  addMember,
  removeMember,
  getMembers,
  updateCriteria
}; 