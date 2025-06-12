// Debug script to test frontend leaderboard
async function debugLeaderboardFrontend() {
  try {
    console.log('Testing frontend leaderboard...');
    
    // Test the fetchAPI function
    const API_URL = 'https://bithead.onrender.com';
    
    const response = await fetch(`${API_URL}/api/leaderboard`);
    const data = await response.json();
    
    console.log('Frontend API Response:', data);
    
    if (data.success && data.leaderboard) {
      console.log(`Frontend found ${data.leaderboard.length} entries:`);
      data.leaderboard.forEach((entry, index) => {
        console.log(`${index + 1}. ${entry.display_name} (@${entry.twitter_handle}) - Score: ${entry.score}`);
      });
      
      // Test the data transformation that the frontend does
      const transformedData = data.leaderboard.map((entry, i) => ({
        displayName: entry.display_name,
        twitterHandle: entry.twitter_handle,
        profilePic: entry.profile_pic,
        score: entry.score
      }));
      
      console.log('Transformed data for frontend:', transformedData);
      
    } else {
      console.log('No leaderboard data in frontend response');
    }
    
  } catch (error) {
    console.error('Error testing frontend leaderboard:', error);
  }
}

// Run the debug
debugLeaderboardFrontend(); 