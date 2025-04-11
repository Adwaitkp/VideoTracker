const express = require('express');
const router = express.Router();
const Progress = require('../model/Progress');

// 🧠 Helper: Merge overlapping intervals
function mergeIntervals(intervals) {
  if (intervals.length <= 1) return intervals;

  intervals.sort((a, b) => a.start - b.start);
  const merged = [intervals[0]];

  for (let i = 1; i < intervals.length; i++) {
    const current = intervals[i];
    const last = merged[merged.length - 1];

    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push(current);
    }
  }

  return merged;
}

// 🧮 Helper: Total watched time in seconds
function calculateTotalWatched(intervals) {
  return intervals.reduce((sum, { start, end }) => sum + (end - start), 0);
}

// 📥 GET progress for specific user/video
router.get('/:userId/:videoId', async (req, res) => {
  try {
    const { userId, videoId } = req.params;

    const progress = await Progress.findOne({ userId, videoId });

    if (!progress) {
      return res.status(200).json({
        watchedIntervals: [],
        lastPosition: 0,
        percentageWatched: 0
      });
    }

    res.status(200).json(progress);
  } catch (error) {
    console.error('GET error:', error);
    res.status(500).json({ message: 'Error fetching progress', error });
  }
});

// 📝 POST (or update) progress
router.post('/', async (req, res) => {
  try {
    const { userId, videoId, interval, videoDuration } = req.body;

    if (!interval || typeof interval.start !== 'number' || typeof interval.end !== 'number') {
      return res.status(400).json({ message: 'Invalid interval format' });
    }

    let progress = await Progress.findOne({ userId, videoId });

    if (!progress) {
      // No progress exists, create new
      progress = new Progress({
        userId,
        videoId,
        videoDuration,
        watchedIntervals: [interval],
        lastPosition: interval.end
      });
    } else {
      // Add new interval and update last position
      progress.watchedIntervals.push(interval);
      progress.watchedIntervals = mergeIntervals(progress.watchedIntervals);
      progress.lastPosition = interval.end;
    }

    // Update percentage watched
    const totalWatched = calculateTotalWatched(progress.watchedIntervals);
    progress.percentageWatched = Math.min(100, (totalWatched / videoDuration) * 100);

    await progress.save();

    // Return consistent response format
    res.status(201).json({
      watchedIntervals: progress.watchedIntervals,
      lastPosition: progress.lastPosition,
      percentageWatched: progress.percentageWatched
    });
  } catch (error) {
    console.error('POST error:', error);
    res.status(500).json({ message: 'Error updating progress', error });
  }
});

module.exports = router;