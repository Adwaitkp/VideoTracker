import React, { useEffect, useRef, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';

const VideoPlayer = ({ videoId, userId, videoUrl, videoDuration, videoTitle }) => {
  const videoRef = useRef(null);
  const progressBarRef = useRef(null);
  const [progress, setProgress] = useState({
    watchedIntervals: [],
    percentageWatched: 0,
    lastPosition: 0
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentInterval, setCurrentInterval] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resumedMessage, setResumedMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(false);
  
  // Get API URL from environment or use default
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/progress';
  
  // Queue for batching save operations
  const saveQueue = useRef([]);
  const saveTimeoutRef = useRef(null);

  // Format seconds to MM:SS
  const formatTime = (s) => {
    if (!s && s !== 0) return '0:00';
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  // Fetch progress data on component mount
  useEffect(() => {
    let isMounted = true;
    
    const fetchProgress = async () => {
      if (!userId || !videoId) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const { data } = await axios.get(`${apiUrl}/${userId}/${videoId}`);
        
        if (isMounted) {
          setProgress(data);
          if (videoRef.current && data.lastPosition) {
            videoRef.current.currentTime = data.lastPosition;
            setResumedMessage(`Resumed from ${formatTime(data.lastPosition)}`);
            setTimeout(() => {
              if (isMounted) setResumedMessage('');
            }, 3000);
          }
        }
      } catch (err) {
        if (err.response?.status !== 404 && isMounted) {
          setError('Unable to load progress.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    
    fetchProgress();
    
    return () => {
      isMounted = false;
      // Clear any pending timeout when unmounting
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [userId, videoId, apiUrl]);

  // Process the save queue
  const processSaveQueue = useCallback(async () => {
    if (saveQueue.current.length === 0 || isSaving) return;
    
    setIsSaving(true);
    const currentBatch = [...saveQueue.current];
    saveQueue.current = [];
    
    // Merge intervals in the batch before sending to server
    let mergedInterval = { ...currentBatch[0] };
    for (let i = 1; i < currentBatch.length; i++) {
      const interval = currentBatch[i];
      mergedInterval.end = Math.max(mergedInterval.end, interval.end);
    }
    
    try {
      const { data } = await axios.post(apiUrl, {
        userId,
        videoId,
        interval: mergedInterval,
        videoDuration
      });
      setProgress(data);
    } catch (err) {
      console.error('Progress save failed', err);
      setError('Progress could not be saved.');
      setTimeout(() => setError(null), 4000);
    } finally {
      setIsSaving(false);
      // Check if new intervals were added during this process
      if (saveQueue.current.length > 0) {
        saveTimeoutRef.current = setTimeout(processSaveQueue, 1000);
      }
    }
  }, [userId, videoId, videoDuration, apiUrl, isSaving]);

  // Queue an interval to be saved
  const queueSaveProgress = useCallback((interval) => {
    if (!interval || !userId || !videoId || interval.end - interval.start < 2) return;
    
    saveQueue.current.push(interval);
    
    // Clear existing timeout to avoid multiple simultaneous saves
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Batch save with a small delay
    saveTimeoutRef.current = setTimeout(processSaveQueue, 1000);
  }, [processSaveQueue, userId, videoId]);

  // Handle play event
  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    const start = Math.floor(videoRef.current?.currentTime || 0);
    setCurrentInterval({ start, end: start });
  }, []);

  // Handle pause event
  const handlePause = useCallback(() => {
    setIsPlaying(false);
    if (currentInterval) {
      const end = Math.floor(videoRef.current?.currentTime || 0);
      if (end > currentInterval.start) {
        queueSaveProgress({ ...currentInterval, end });
      }
      setCurrentInterval(null);
    }
  }, [currentInterval, queueSaveProgress]);

  // Fix: Handle seeking during playback properly
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current || !isPlaying) return;
    
    const current = Math.floor(videoRef.current.currentTime);
    
    if (currentInterval) {
      // If there's a large gap between current time and end of interval,
      // it indicates a skip/seek has occurred
      if (current > currentInterval.end + 5 || current < currentInterval.start) {
        // Save the previous interval before starting a new one
        queueSaveProgress({ ...currentInterval, end: currentInterval.end });
        // Start a new interval
        setCurrentInterval({ start: current, end: current });
      } else {
        // Regular update
        setCurrentInterval(prev => ({ ...prev, end: current }));
      }
    }
  }, [isPlaying, currentInterval, queueSaveProgress]);

  // Handle end of video
  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    if (currentInterval) {
      queueSaveProgress({ ...currentInterval, end: videoDuration });
      setCurrentInterval(null);
    }
  }, [currentInterval, queueSaveProgress, videoDuration]);

  // Update current interval periodically when playing
  useEffect(() => {
    let timer;
    if (isPlaying && currentInterval && videoRef.current) {
      timer = setInterval(() => {
        const current = Math.floor(videoRef.current.currentTime);
        
        // Only update if current time has changed significantly
        if (Math.abs(current - currentInterval.end) > 1) {
          setCurrentInterval(prev => {
            return { ...prev, end: current };
          });
        }
      }, 1000);
    }
    
    return () => clearInterval(timer);
  }, [isPlaying, currentInterval]);

  // Handle volume change
  const handleVolumeChange = useCallback((e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  }, []);

  // Quick skip functions
  const skipBackward = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
    }
  }, []);

  const skipForward = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.min(videoDuration, videoRef.current.currentTime + 10);
    }
  }, [videoDuration]);

  // New: Handle click on progress track to seek
  const handleTrackClick = useCallback((e) => {
    if (!progressBarRef.current || !videoRef.current) return;
    
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    const seekTime = videoDuration * clickPosition;
    
    // Pause existing interval if playing
    if (isPlaying && currentInterval) {
      queueSaveProgress({ ...currentInterval, end: Math.floor(videoRef.current.currentTime) });
    }
    
    // Set new video position
    videoRef.current.currentTime = seekTime;
    
    // Start a new interval if playing
    if (isPlaying) {
      setCurrentInterval({ start: Math.floor(seekTime), end: Math.floor(seekTime) });
    }
  }, [videoDuration, isPlaying, currentInterval, queueSaveProgress]);

  // Handle segments track click
  const handleSegmentsTrackClick = useCallback((e) => {
    if (!videoRef.current) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    const seekTime = videoDuration * clickPosition;
    
    // Pause existing interval if playing
    if (isPlaying && currentInterval) {
      queueSaveProgress({ ...currentInterval, end: Math.floor(videoRef.current.currentTime) });
    }
    
    // Set new video position
    videoRef.current.currentTime = seekTime;
    
    // Start a new interval if playing
    if (isPlaying) {
      setCurrentInterval({ start: Math.floor(seekTime), end: Math.floor(seekTime) });
    }
  }, [videoDuration, isPlaying, currentInterval, queueSaveProgress]);

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500 animate-pulse">
        <div className="w-16 h-16 mx-auto mb-3 border-4 border-t-blue-600 border-gray-200 rounded-full animate-spin"></div>
        <p>Loading video progress...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden mb-10">
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white px-6 py-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-wide truncate max-w-sm">{videoTitle}</h2>
        <div className="flex items-center space-x-2">
          {isSaving && (
            <span className="text-xs bg-blue-500 px-3 py-1 rounded-full shadow flex items-center">
              <svg className="animate-spin h-3 w-3 mr-1" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving
            </span>
          )}
          {resumedMessage && (
            <span className="text-xs bg-green-500 px-3 py-1 rounded-full shadow flex items-center">
              <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
              {resumedMessage}
            </span>
          )}
        </div>
      </div>

      <div 
        className="relative"
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
      >
        <video
          ref={videoRef}
          className="w-full bg-black"
          controls
          onPlay={handlePlay}
          onPause={handlePause}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
        >
          <source src={videoUrl} type="video/mp4" />
          Your browser does not support HTML5 video.
        </video>
        
        {showControls && (
          <div className="absolute bottom-16 left-0 right-0 flex justify-center space-x-4 p-2 bg-black bg-opacity-60 text-white transition-opacity duration-300">
            <button 
              onClick={skipBackward}
              className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded-full focus:outline-none flex items-center"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"></path>
              </svg>
              10s
            </button>
            <button 
              onClick={skipForward}
              className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded-full focus:outline-none flex items-center"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"></path>
              </svg>
              10s
            </button>
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 010-7.072m12.728 0l-3.536 3.536M6.414 8.464l3.536 3.536"></path>
              </svg>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={handleVolumeChange}
                className="w-20 accent-blue-500"
              />
            </div>
          </div>
        )}
      </div>

      <div className="p-6 space-y-4">
        {error && (
          <div className="bg-red-100 text-red-700 px-4 py-2 rounded-md text-sm flex items-center justify-between">
            <span>{error}</span>
            <button 
              onClick={() => setError(null)}
              className="text-red-700 hover:text-red-900"
            >
              ×
            </button>
          </div>
        )}

        <div>
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span className="font-medium">{progress.percentageWatched.toFixed(1)}% watched</span>
            <span>{formatTime(progress.lastPosition)} / {formatTime(videoDuration)}</span>
          </div>
          <div 
            ref={progressBarRef}
            className="w-full bg-gray-200 h-3 rounded-full overflow-hidden cursor-pointer hover:bg-gray-300 transition-colors duration-200"
            onClick={handleTrackClick}
          >
            <div
              className="bg-blue-600 h-full transition-all duration-300"
              style={{ width: `${progress.percentageWatched}%` }}
            ></div>
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-xs text-gray-500 flex justify-between">
            <span>Watched segments:</span>
            <span className="text-blue-600 font-medium">{progress.watchedIntervals.length} segments</span>
          </div>
          <div 
            className="relative bg-gray-800 h-6 rounded-full overflow-hidden cursor-pointer hover:bg-gray-700 transition-colors duration-200"
            onClick={handleSegmentsTrackClick}
          >
            {progress.watchedIntervals.map((interval, i) => (
              <div
                key={i}
                className="absolute bg-green-400 h-full opacity-70 hover:opacity-90 transition-opacity duration-200 flex items-center justify-center"
                title={`${formatTime(interval.start)} - ${formatTime(interval.end)}`}
                style={{
                  left: `${(interval.start / videoDuration) * 100}%`,
                  width: `${((interval.end - interval.start) / videoDuration) * 100}%`
                }}
              >
                {((interval.end - interval.start) / videoDuration) > 0.1 && (
                  <span className="text-xs text-gray-800 font-bold px-1 truncate">
                    {formatTime(interval.end - interval.start)}
                  </span>
                )}
              </div>
            ))}
            {currentInterval && isPlaying && (
              <div
                className="absolute bg-blue-500 h-full opacity-60 animate-pulse"
                title="Currently watching"
                style={{
                  left: `${(currentInterval.start / videoDuration) * 100}%`,
                  width: `${((currentInterval.end - currentInterval.start) / videoDuration) * 100}%`
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

VideoPlayer.propTypes = {
  videoId: PropTypes.string.isRequired,
  userId: PropTypes.string.isRequired,
  videoUrl: PropTypes.string.isRequired,
  videoDuration: PropTypes.number.isRequired,
  videoTitle: PropTypes.string
};

VideoPlayer.defaultProps = {
  videoTitle: 'Untitled Video'
};

export default React.memo(VideoPlayer);