const fs = require("fs");
const path = require("path");

const metadataDir = path.join(__dirname, "build", "metadata");
const imageCID = "bafybeihabc123..."; // Replace with your actual CID from NFT.Storage

fs.readdirSync(metadataDir).forEach((file) => {
  if (file.endsWith(".json")) {
    const filePath = path.join(metadataDir, file);
    const metadata = JSON.parse(fs.readFileSync(filePath, "utf8"));

    metadata.image = `ipfs://${imageCID}/${file.replace(".json", ".png")}`;
    fs.writeFileSync(filePath, JSON.stringify(metadata, null, 2));
  }
});

console.log("✅ All metadata updated successfully!");
