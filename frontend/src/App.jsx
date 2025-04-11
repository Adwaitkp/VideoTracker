import React, { useState, useEffect } from 'react';
import axios from 'axios';
import VideoPlayer from './component/VideoPlayer';
import VideoCard from './component/VideoCard';

const App = () => {
  const userId = "user123";
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const apiUrl ='https://videotracker-1.onrender.com/api';

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const { data } = await axios.get(`${apiUrl}/videos`);
        setVideos(data);
        setSelectedVideo(data[0]);
      } catch (err) {
        setError("Could not load videos.");
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <header className="bg-white shadow p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">🎥 Video Tracker</h1>
        <span className="text-sm">User: {userId}</span>
      </header>

      <main className="p-6 max-w-6xl mx-auto">
        {loading ? (
          <div className="text-center py-20">Loading...</div>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : (
          <>
            {selectedVideo && (
              <VideoPlayer
                videoId={selectedVideo._id}
                userId={userId}
                videoUrl={selectedVideo.url}
                videoDuration={selectedVideo.duration}
                videoTitle={selectedVideo.title}
              />
            )}

            <h2 className="text-xl font-semibold mt-10 mb-4">Available Videos</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {videos.map(video => (
                <VideoCard
                  key={video._id}
                  video={video}
                  isSelected={selectedVideo?._id === video._id}
                  onSelect={() => setSelectedVideo(video)}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default App;
