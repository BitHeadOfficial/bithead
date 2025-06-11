/**
 * searchTraits.js - Command-line tool to search NFT metadata for specific traits
 *
 * Usage:
 *   node searchTraits.js "Head" "RoyalGold"
 *   node searchTraits.js "Background" "Galaxy_Blue"
 */

const fs = require("fs");
const path = require("path");

// 1) Grab traitType and traitValue from command line arguments
const traitType = process.argv[2];
const traitValue = process.argv[3];

// If user didn't provide enough arguments, show usage info
if (!traitType || !traitValue) {
  console.log("Usage: node searchTraits.js <traitType> <traitValue>");
  console.log('Example: node searchTraits.js "Head" "RoyalGold"');
  process.exit(1);
}

// 2) The path to your metadata folder
const metadataDir = path.join(__dirname, "build", "metadata");

// 3) Read all .json files from the metadata directory
const allMetadataFiles = fs
  .readdirSync(metadataDir)
  .filter((f) => f.endsWith(".json"));

// 4) A helper function to check if a metadata file has the desired trait
function hasDesiredTrait(jsonFilePath, traitType, traitValue) {
  const content = JSON.parse(fs.readFileSync(jsonFilePath, "utf8"));
  // content.attributes is an array of objects: { trait_type, value }
  return content.attributes.some(
    (attr) => attr.trait_type === traitType && attr.value === traitValue
  );
}

// 5) Search through each file
const matches = [];
for (const file of allMetadataFiles) {
  const filePath = path.join(metadataDir, file);
  if (hasDesiredTrait(filePath, traitType, traitValue)) {
    // If it matches, push some identifying info (NFT name, file name, etc.)
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    matches.push({ name: data.name, file });
  }
}

// 6) Print results
if (matches.length === 0) {
  console.log(
    `No NFTs found with trait_type='${traitType}' and value='${traitValue}'.`
  );
} else {
  console.log(
    `Found ${matches.length} NFT(s) with ${traitType}='${traitValue}':\n`
  );
  matches.forEach((m) => {
    console.log(`- ${m.name} (metadata file: ${m.file})`);
  });
}
