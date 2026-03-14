// src/api/upload.js
import axios from "axios";

/**
 * Upload a file to your backend.
 * @param {File} file - the file from <input type="file">
 * @param {string} username - (optional) current username to associate
 * @param {(pct:number)=>void} onProgress - (optional) progress callback 0..100
 * @returns {Promise<{ok:boolean, web2Url?:string, web3Cid?:string, web3Url?:string}>}
 */
export async function uploadFile(file, username, onProgress) {
  const fd = new FormData();
  fd.append("file", file);
  if (username) fd.append("username", username);

  const res = await axios.post("http://localhost:4000/api/upload", fd, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: e => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    }
  });

  return res.data; // { ok, web2Url, web3Cid, web3Url }
}

// Optional default export (so either import style works)
export default uploadFile;
