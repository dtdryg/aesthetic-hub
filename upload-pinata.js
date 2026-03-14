import fs from "fs";
import path from "path";
import axios from "axios";
import FormData from "form-data";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY;
const FOLDER_PATH = path.join(__dirname, "dist");

// Recursively gather all files
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  }
  return arrayOfFiles;
}

async function uploadFolderToPinata() {
  try {
    console.log("📦 Preparing folder for upload…");

    const allFiles = getAllFiles(FOLDER_PATH);
    const formData = new FormData();

    for (const filePath of allFiles) {
      const relativePath = path.relative(FOLDER_PATH, filePath).replace(/\\/g, "/");
      formData.append("file", fs.createReadStream(filePath), {
        filepath: `dist/${relativePath}`,
      });
    }

    console.log("🚀 Uploading to Pinata…");

    const response = await axios.post(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      formData,
      {
        maxBodyLength: Infinity,
        headers: {
          ...formData.getHeaders(),
          pinata_api_key: PINATA_API_KEY,
          pinata_secret_api_key: PINATA_SECRET_API_KEY,
        },
      }
    );

    const cid = response.data.IpfsHash;
    console.log("\n✅ Upload complete!");
    console.log("📁 Folder CID:", cid);
    console.log("🌐 View site:", `https://gateway.pinata.cloud/ipfs/${cid}/index.html`);
  } catch (err) {
    console.error("❌ Upload failed:", err.response?.data || err.message);
  }
}

uploadFolderToPinata();
