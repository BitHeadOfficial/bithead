# BitHeadzArtEngine

A free NFT generator tool for creating unique NFT collections with layer-based composition, rarity controls, and metadata generation.

## Features

- **Layer-based Composition**: Upload PNG layers and automatically compose unique NFTs
- **Rarity Controls**: Bell-curve, random, or equal distribution for trait rarity
- **Optional Layers**: Configure which layers are optional (like accessories, gear, etc.)
- **Metadata Generation**: Automatic JSON metadata generation for each NFT
- **Batch Processing**: Generate collections of up to 10,000 NFTs
- **Progress Tracking**: Real-time progress updates during generation
- **Download Package**: Get a complete ZIP file with images and metadata

## Layer Organization

Organize your PNG layers with numeric prefixes to define the composition order:

```
00_Background/
  - blue.png
  - red.png
  - green.png

01_Body/
  - skinny.png
  - muscular.png
  - slim.png

02_Head/
  - round.png
  - square.png
  - oval.png

03_Eyes/
  - blue.png
  - brown.png
  - green.png

04_Mouth/
  - smile.png
  - frown.png
  - neutral.png

05_Gear/ (optional)
  - hat.png
  - glasses.png
  - necklace.png

06_Nose/
  - small.png
  - large.png
  - medium.png

07_Buttons/ (optional)
  - gold.png
  - silver.png
  - bronze.png
```

## Usage

1. **Prepare Your Layers**: Create PNG files for each trait category
2. **Organize with Prefixes**: Use 00_, 01_, 02_, etc. to define layer order
3. **Upload Layers**: Drag & drop or browse to upload your PNG files
4. **Configure Settings**: Set collection name, size, description, and rarity
5. **Generate**: Click generate and wait for processing
6. **Download**: Get your complete collection as a ZIP file

## Rarity Modes

- **Bell Curve (Recommended)**: Traits near the middle of the sorted array appear more often
- **Random**: Completely random selection of traits
- **Equal Distribution**: Each trait has equal probability

## File Requirements

- **Format**: PNG files only
- **Size**: Maximum 10MB per file
- **Count**: Maximum 100 files per upload
- **Dimensions**: All images should have the same dimensions (recommended: 1000x1000)

## Output

The generator creates:
- **Images**: PNG files named `{CollectionName}_{Number}.png`
- **Metadata**: JSON files with attributes and metadata
- **Download**: ZIP archive containing both images and metadata folders

## API Endpoints

- `POST /api/nft-generator/generate` - Start generation
- `GET /api/nft-generator/status/:generationId` - Check progress
- `GET /api/nft-generator/download/:generationId` - Download collection

## Security

- All uploaded files are processed in temporary directories
- Files are automatically cleaned up after download
- No user data is stored permanently
- Maximum file size and count limits are enforced

## Support

For questions or issues, please contact the BitHead team.

---

**Note**: This tool is designed for NFT collection founders and artists. Please ensure you have the rights to use all uploaded images. 