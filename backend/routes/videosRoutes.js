const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Create a Video schema if you don't have one
const VideoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: ''
  },
  url: {
    type: String,
    required: true,
  },
  duration: {
    type: Number,
    required: true
  },
  thumbnail: {
    type: String,
    default: ''
  }
}, { timestamps: true });

const Video = mongoose.models.Video || mongoose.model('Video', VideoSchema);

// GET all videos
router.get('/', async (req, res) => {
  try {
    const videos = await Video.find();
    
    // If no videos exist yet, return sample data
    if (videos.length === 0) {
      return res.status(200).json([
        {
          _id: "video456",
          title: "Big Buck Bunny",
          description: "Big Buck Bunny tells the story of a giant rabbit with a heart bigger than himself.",
          url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
          duration: 596, // in seconds
          thumbnail: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg"
        },
        {
          _id: "video457",
          title: "Elephants Dream",
          description: "The first Blender Open Movie from 2006",
          url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
          duration: 653, // in seconds
          thumbnail: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg"
        },
        {
          _id: "video458",
          title: "Sintel",
          description: "Third Blender Open Movie from 2010",
          url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
          duration: 888, // in seconds
          thumbnail: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/Sintel.jpg"
        }
      ]);
    }
    
    res.status(200).json(videos);
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({ message: 'Error fetching videos', error });
  }
});

// GET single video by ID


module.exports = router;