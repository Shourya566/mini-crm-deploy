import mongoose from 'mongoose';
const { Schema } = mongoose;

const customerSchema = new Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    index: true
  },
  phone: {
    type: String,
    trim: true
  },
  location: {
    city: String,
    state: String,
    country: String
  },
  stats: {
    totalSpend: {
      type: Number,
      default: 0
    },
    visits: {
      type: Number,
      default: 0
    },
    purchases: {
      type: Number,
      default: 0
    },
    lastActive: {
      type: Date,
      default: Date.now
    }
  },
  preferences: {
    marketingConsent: {
      type: Boolean,
      default: true
    },
    channels: {
      email: {
        type: Boolean,
        default: true
      },
      sms: {
        type: Boolean,
        default: false
      },
      push: {
        type: Boolean,
        default: false
      }
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for querying
customerSchema.index({ 'stats.totalSpend': 1 });
customerSchema.index({ 'stats.visits': 1 });
customerSchema.index({ 'stats.purchases': 1 });
customerSchema.index({ 'stats.lastActive': 1 });
customerSchema.index({ 'location.country': 1, 'location.state': 1, 'location.city': 1 });

// Get full name
customerSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Calculate inactivity duration in days
customerSchema.methods.getInactiveDays = function() {
  const now = new Date();
  const lastActive = this.stats.lastActive || this.createdAt;
  const diffTime = Math.abs(now - lastActive);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Static method to find customers by segment rules
customerSchema.statics.findBySegmentRules = async function(rules) {
  // This is a simplified implementation
  // In a real-world scenario, this would be more complex to handle nested conditions
  
  let query = {};
  
  if (rules && rules.conditions && rules.conditions.length > 0) {
    const conditions = [];
    
    for (const condition of rules.conditions) {
      // Handle nested rule groups recursively
      if (condition.operator && condition.conditions) {
        const nestedResults = await this.findBySegmentRules(condition);
        // In a real implementation, we would handle the nested query differently
        continue;
      }
      
      // Simple conditions
      let conditionQuery = {};
      
      switch (condition.type) {
        case 'spend':
          conditionQuery = { 'stats.totalSpend': {} };
          if (condition.operator === '>' || condition.operator === 'greaterThan') conditionQuery['stats.totalSpend'].$gt = parseFloat(condition.value);
          else if (condition.operator === '<' || condition.operator === 'lessThan') conditionQuery['stats.totalSpend'].$lt = parseFloat(condition.value);
          else if (condition.operator === '=' || condition.operator === 'equals') conditionQuery['stats.totalSpend'] = parseFloat(condition.value);
          else if (condition.operator === '>=') conditionQuery['stats.totalSpend'].$gte = parseFloat(condition.value);
          else if (condition.operator === '<=') conditionQuery['stats.totalSpend'].$lte = parseFloat(condition.value);
          break;
          
        case 'visits':
          conditionQuery = { 'stats.visits': {} };
          if (condition.operator === '>' || condition.operator === 'greaterThan') conditionQuery['stats.visits'].$gt = parseInt(condition.value);
          else if (condition.operator === '<' || condition.operator === 'lessThan') conditionQuery['stats.visits'].$lt = parseInt(condition.value);
          else if (condition.operator === '=' || condition.operator === 'equals') conditionQuery['stats.visits'] = parseInt(condition.value);
          else if (condition.operator === '>=') conditionQuery['stats.visits'].$gte = parseInt(condition.value);
          else if (condition.operator === '<=') conditionQuery['stats.visits'].$lte = parseInt(condition.value);
          break;
          
        case 'purchases':
          conditionQuery = { 'stats.purchases': {} };
          if (condition.operator === '>' || condition.operator === 'greaterThan') conditionQuery['stats.purchases'].$gt = parseInt(condition.value);
          else if (condition.operator === '<' || condition.operator === 'lessThan') conditionQuery['stats.purchases'].$lt = parseInt(condition.value);
          else if (condition.operator === '=' || condition.operator === 'equals') conditionQuery['stats.purchases'] = parseInt(condition.value);
          else if (condition.operator === '>=') conditionQuery['stats.purchases'].$gte = parseInt(condition.value);
          else if (condition.operator === '<=') conditionQuery['stats.purchases'].$lte = parseInt(condition.value);
          break;
          
        case 'inactive':
          // This is trickier as we need to calculate days since last activity
          const inactiveDays = parseInt(condition.value);
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);
          
          if (condition.operator === '>' || condition.operator === 'greaterThan') conditionQuery['stats.lastActive'] = { $lt: cutoffDate };
          else if (condition.operator === '<' || condition.operator === 'lessThan') conditionQuery['stats.lastActive'] = { $gt: cutoffDate };
          else if (condition.operator === '=' || condition.operator === 'equals') {
            const startDate = new Date(cutoffDate);
            const endDate = new Date(cutoffDate);
            startDate.setDate(startDate.getDate() - 1);
            endDate.setDate(endDate.getDate() + 1);
            conditionQuery['stats.lastActive'] = { $gte: startDate, $lt: endDate };
          }
          break;
          
        case 'location':
          if (condition.operator === 'contains' || condition.operator === '=' || condition.operator === 'equals') {
            conditionQuery.$or = [
              { 'location.country': { $regex: condition.value, $options: 'i' } },
              { 'location.state': { $regex: condition.value, $options: 'i' } },
              { 'location.city': { $regex: condition.value, $options: 'i' } }
            ];
          }
          break;
      }
      
      if (Object.keys(conditionQuery).length > 0) {
        conditions.push(conditionQuery);
      }
    }
    
    // Combine conditions based on operator
    if (conditions.length > 0) {
      query = rules.operator === 'AND' ? { $and: conditions } : { $or: conditions };
    }
  }
  
  return this.find(query);
};

const Customer = mongoose.model('Customer', customerSchema);

export default Customer; 