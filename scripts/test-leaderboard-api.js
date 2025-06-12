// Test script to check leaderboard API
async function testLeaderboardAPI() {
  try {
    console.log('Testing leaderboard API...');
    
    // Test the GET endpoint
    const response = await fetch('https://bithead.onrender.com/api/leaderboard');
    const data = await response.json();
    
    console.log('API Response Status:', response.status);
    console.log('API Response:', JSON.stringify(data, null, 2));
    
    if (data.success && data.leaderboard) {
      console.log(`Found ${data.leaderboard.length} leaderboard entries:`);
      data.leaderboard.forEach((entry, index) => {
        console.log(`${index + 1}. ${entry.display_name} (@${entry.twitter_handle}) - Score: ${entry.score}`);
      });
    } else {
      console.log('No leaderboard data or API error');
    }
    
  } catch (error) {
    console.error('Error testing leaderboard API:', error);
  }
}

// Run the test
testLeaderboardAPI(); 