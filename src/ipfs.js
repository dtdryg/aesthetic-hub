import { Web3Storage } from "web3.storage";

export function getIPFSGateway(cidOrUri) {
  return `https://ipfs.io/ipfs/${cidOrUri.replace('ipfs://','')}`;
}

function getClient(token) {
  if (!token) throw new Error("Missing VITE_WEB3_STORAGE_TOKEN");
  return new Web3Storage({ token });
}

export async function putFile(file, token) {
  const client = getClient(token);
  const cid = await client.put([file], { wrapWithDirectory: false });
  return `ipfs://${cid}`;
}

export async function putJSON(obj, token, name = 'data.json') {
  const blob = new Blob([JSON.stringify(obj)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  const client = getClient(token);
  const cid = await client.put([file], { wrapWithDirectory: false });
  return `ipfs://${cid}`;
}
