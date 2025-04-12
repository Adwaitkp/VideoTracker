This project is a React-based video player that tracks and saves a user's video watching progress. It allows users to play, pause, and seek through a video, and it automatically records the parts they've watched.
These time intervals are saved to a backend server using API calls, so when the user comes back, the video resumes from where they left off. The system also calculates the total percentage of the video watched. 
It handles user interactions like skipping forward/backward and seeking manually, and it avoids sending too many requests by batching updates intelligently. 
The UI is styled using Tailwind CSS, and Axios is used for making API requests. This setup is useful for platforms that need to remember video progress, such as e-learning apps or training portals.

