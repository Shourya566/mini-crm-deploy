import mongoose from 'mongoose';
const { Schema } = mongoose;

const communicationLogSchema = new Schema({
  campaignId: {
    type: Schema.Types.ObjectId,
    ref: 'Campaign',
    required: true,
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['email', 'sms', 'push', 'social', 'Email', 'SMS', 'Push', 'Social'],
    required: true
  },
  content: {
    subject: String,
    body: String,
    template: String
  },
  status: {
    type: String,
    enum: ['queued', 'sent', 'delivered', 'failed', 'opened', 'clicked'],
    default: 'queued',
    index: true
  },
  metadata: {
    vendor: String,
    vendorMessageId: String,
    failureReason: String,
    deliveryTimestamp: Date,
    ipAddress: String,
    userAgent: String
  },
  batchId: {
    type: String,
    index: true
  }
}, {
  timestamps: true
});

// Indexes for query optimization
communicationLogSchema.index({ campaignId: 1, status: 1 });
communicationLogSchema.index({ campaignId: 1, userId: 1 });
communicationLogSchema.index({ createdAt: 1 });

// Instance methods
communicationLogSchema.methods.markAs = async function(status, metadata = {}) {
  this.status = status;
  if (status === 'delivered') {
    this.metadata.deliveryTimestamp = new Date();
  }
  if (metadata) {
    this.metadata = { ...this.metadata, ...metadata };
  }
  return this.save();
};

const CommunicationLog = mongoose.model('CommunicationLog', communicationLogSchema);

export default CommunicationLog; 