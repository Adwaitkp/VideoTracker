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
  const [currentTime, setCurrentTime] = useState(0);
  
  // Get API URL from environment or use default
  const apiUrl = 'https://videotracker-82g4.onrender.com/api/progress';
  
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
            setCurrentTime(data.lastPosition);
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
      if (saveQueue.current.length > 0) {
        saveTimeoutRef.current = setTimeout(processSaveQueue, 1000);
      }
    }
  }, [userId, videoId, videoDuration, apiUrl, isSaving]);

  // Queue an interval to be saved
  const queueSaveProgress = useCallback((interval) => {
    if (!interval || !userId || !videoId || interval.end - interval.start < 2) return;
    
    saveQueue.current.push(interval);
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(processSaveQueue, 1000);
  }, [processSaveQueue, userId, videoId]);

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
  }, [isPlaying]);

  // Handle play event
  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    const start = Math.floor(videoRef.current?.currentTime || 0);
    setCurrentTime(start);
    setCurrentInterval({ start, end: start });
  }, []);

  // Handle pause event
  const handlePause = useCallback(() => {
    setIsPlaying(false);
    if (currentInterval) {
      const end = Math.floor(videoRef.current?.currentTime || 0);
      setCurrentTime(end);
      if (end > currentInterval.start) {
        queueSaveProgress({ ...currentInterval, end });
      }
      setCurrentInterval(null);
    }
  }, [currentInterval, queueSaveProgress]);

  // Handle time updates during playback
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    
    const current = Math.floor(videoRef.current.currentTime);
    setCurrentTime(current);
    
    if (!isPlaying) return;
    
    if (currentInterval) {
      if (current > currentInterval.end + 5 || current < currentInterval.start) {
        queueSaveProgress({ ...currentInterval, end: currentInterval.end });
        setCurrentInterval({ start: current, end: current });
      } else {
        setCurrentInterval(prev => ({ ...prev, end: current }));
      }
    }
  }, [isPlaying, currentInterval, queueSaveProgress]);

  // Handle seeking of video
  const handleSeeked = useCallback(() => {
    if (!videoRef.current) return;
    
    const current = Math.floor(videoRef.current.currentTime);
    setCurrentTime(current);
    
    if (isPlaying) {
      if (currentInterval && current !== currentInterval.end) {
        queueSaveProgress({ ...currentInterval, end: currentInterval.end });
        setCurrentInterval({ start: current, end: current });
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
    setCurrentTime(videoDuration);
  }, [currentInterval, queueSaveProgress, videoDuration]);

  // Update current interval periodically when playing
  useEffect(() => {
    let timer;
    if (isPlaying && currentInterval && videoRef.current) {
      timer = setInterval(() => {
        const current = Math.floor(videoRef.current.currentTime);
        setCurrentTime(current);
        
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
      const newTime = Math.max(0, videoRef.current.currentTime - 10);
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }, []);

  const skipForward = useCallback(() => {
    if (videoRef.current) {
      const newTime = Math.min(videoDuration, videoRef.current.currentTime + 10);
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }, [videoDuration]);

  // Handle click on progress track to seek
  const handleTrackClick = useCallback((e) => {
    if (!progressBarRef.current || !videoRef.current) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    const seekTime = videoDuration * clickPosition;
    
    if (isPlaying && currentInterval) {
      queueSaveProgress({ ...currentInterval, end: Math.floor(videoRef.current.currentTime) });
    }
    
    videoRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
    
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
    
    if (isPlaying && currentInterval) {
      queueSaveProgress({ ...currentInterval, end: Math.floor(videoRef.current.currentTime) });
    }
    
    videoRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
    
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
        {/* Video element with controls removed */}
        <video
          ref={videoRef}
          className="w-full bg-black cursor-pointer"
          onClick={togglePlayPause}
          onPlay={handlePlay}
          onPause={handlePause}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onSeeked={handleSeeked}
        >
          <source src={videoUrl} type="video/mp4" />
          Your browser does not support HTML5 video.
        </video>
        
        {/* Play/pause button overlay */}
        <div 
          className="absolute inset-0 flex items-center justify-center"
          style={{ pointerEvents: 'none' }}
        >
          {!isPlaying && (
            <div className="bg-black bg-opacity-40 rounded-full p-4">
              <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" fillRule="evenodd"></path>
              </svg>
            </div>
          )}
        </div>
        
        {/* Custom video controls */}
        <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent px-4 py-3 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          {/* Progress bar */}
          <div 
            ref={progressBarRef}
            className="w-full bg-gray-500 bg-opacity-50 h-2 rounded-full overflow-hidden cursor-pointer hover:h-3 transition-all duration-200 mb-3"
            onClick={handleTrackClick}
          >
            <div
              className="bg-blue-600 h-full transition-all duration-300"
              style={{ width: `${(currentTime / videoDuration) * 100}%` }}
            ></div>
          </div>
          
          {/* Controls row */}
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center space-x-4">
              <button 
                onClick={skipBackward}
                className="p-1 hover:bg-gray-700 hover:bg-opacity-50 rounded-full focus:outline-none"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l-4-4m0 0l4-4m-4 4h8"></path>
                </svg>
              </button>
              
              <button 
                onClick={togglePlayPause}
                className="p-2 hover:bg-gray-700 hover:bg-opacity-50 rounded-full focus:outline-none"
              >
                {isPlaying ? (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                )}
              </button>
              
              <button 
                onClick={skipForward}
                className="p-1 hover:bg-gray-700 hover:bg-opacity-50 rounded-full focus:outline-none"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10l4 4m0 0l-4 4m4-4H4"></path>
                </svg>
              </button>
              
              <div className="flex items-center space-x-2">
                <span className="text-sm">{formatTime(currentTime)}</span>
                <span className="text-xs text-gray-300">/</span>
                <span className="text-sm">{formatTime(videoDuration)}</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <button className="p-1 hover:bg-gray-700 hover:bg-opacity-50 rounded-full focus:outline-none">
                  {volume === 0 ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd"></path>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"></path>
                    </svg>
                  ) : volume < 0.5 ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd"></path>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M15.536 8.464a5 5 0 010 7.072"></path>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd"></path>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M17.07 8.93a10 10 0 010 6.14M15.54 7.46a7 7 0 010 9.08"></path>
                    </svg>
                  )}
                </button>
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
          </div>
        </div>
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
          {/* Percentage display below the segments bar */}
          <div className="flex justify-between text-sm text-gray-600 mt-2">
            <span className="font-medium">{progress.percentageWatched.toFixed(1)}% watched</span>
            <span>{formatTime(currentTime)} / {formatTime(videoDuration)}</span>
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