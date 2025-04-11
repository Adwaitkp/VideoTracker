import React from 'react';

const VideoCard = ({ video, isSelected, onSelect }) => (
  <div
    onClick={onSelect}
    className={`cursor-pointer border rounded-md overflow-hidden shadow-sm hover:shadow-md transition ${
      isSelected ? 'border-blue-500' : 'border-gray-200'
    }`}
  >
    <img
      src={video.thumbnail}
      alt={video.title}
      className="w-full h-40 object-cover"
    />
    <div className="p-4">
      <h3 className="font-semibold text-lg">{video.title}</h3>
      <p className="text-sm text-gray-500 mb-1">{video.description}</p>
      <p className="text-xs text-gray-400">
        Duration: {Math.floor(video.duration / 60)}:
        {String(video.duration % 60).padStart(2, '0')}
      </p>
    </div>
  </div>
);

export default VideoCard;
