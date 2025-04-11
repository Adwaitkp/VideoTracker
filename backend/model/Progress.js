const mongoose = require('mongoose');

const ProgressSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  videoId: {
    type: String,
    required: true,
  },
  watchedIntervals: {
    type: [{
      start: Number,
      end: Number
    }],
    default: []
  },
  lastPosition: {
    type: Number,
    default: 0
  },
  percentageWatched: {
    type: Number,
    default: 0
  },
  videoDuration: {
    type: Number,
    required: true
  }
}, { timestamps: true });

// Create a compound index for userId and videoId
ProgressSchema.index({ userId: 1, videoId: 1 }, { unique: true });

module.exports = mongoose.model('Progress', ProgressSchema);