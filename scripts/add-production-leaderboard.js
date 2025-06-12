import db from '../db/index.js';

// Add leaderboard entries to production database
async function addProductionLeaderboardEntries() {
  return new Promise((resolve, reject) => {
    console.log('Adding leaderboard entries to production database...');
    
    // First, check if entries already exist
    db.all('SELECT * FROM leaderboard WHERE twitter_handle IN (?, ?)', ['@BitHeadOfficial', '@smokometa'], (err, existingRows) => {
      if (err) {
        console.error('Error checking existing entries:', err);
        reject(err);
        return;
      }
      
      console.log(`Found ${existingRows.length} existing entries`);
      
      // Add BitHead entry if it doesn't exist
      const bitHeadExists = existingRows.some(row => row.twitter_handle === '@BitHeadOfficial');
      if (!bitHeadExists) {
        db.run(
          'INSERT INTO leaderboard (display_name, twitter_handle, profile_pic, score) VALUES (?, ?, ?, ?)',
          ['BitHead', '@BitHeadOfficial', null, 3],
          function(err) {
            if (err) {
              console.error('Error adding BitHead entry:', err);
              reject(err);
              return;
            }
            console.log('Added BitHead entry with ID:', this.lastID);
            addSmokoEntry();
          }
        );
      } else {
        console.log('BitHead entry already exists, skipping...');
        addSmokoEntry();
      }
      
      function addSmokoEntry() {
        // Add smoko entry if it doesn't exist
        const smokoExists = existingRows.some(row => row.twitter_handle === '@smokometa');
        if (!smokoExists) {
          db.run(
            'INSERT INTO leaderboard (display_name, twitter_handle, profile_pic, score) VALUES (?, ?, ?, ?)',
            ['smoko', '@smokometa', null, 0],
            function(err) {
              if (err) {
                console.error('Error adding smoko entry:', err);
                reject(err);
                return;
              }
              console.log('Added smoko entry with ID:', this.lastID);
              verifyEntries();
            }
          );
        } else {
          console.log('smoko entry already exists, skipping...');
          verifyEntries();
        }
      }
      
      function verifyEntries() {
        // Verify entries were added
        db.all('SELECT * FROM leaderboard ORDER BY score DESC', [], (err, rows) => {
          if (err) {
            console.error('Error fetching leaderboard:', err);
            reject(err);
            return;
          }
          console.log('Current production leaderboard entries:');
          rows.forEach((row, index) => {
            console.log(`${index + 1}. ${row.display_name} (@${row.twitter_handle}) - Score: ${row.score}`);
          });
          resolve();
        });
      }
    });
  });
}

// Run the script
addProductionLeaderboardEntries()
  .then(() => {
    console.log('Production leaderboard entries added successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to add production leaderboard entries:', error);
    process.exit(1);
  }); 