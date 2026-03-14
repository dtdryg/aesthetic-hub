export function getIPFSGateway(cidOrUri) {
  return `https://ipfs.io/ipfs/${cidOrUri.replace('ipfs://','')}`;
}

export async function putFile(file, token) {
  console.warn('Web3Storage removed. Use Supabase storage instead.');
  return '';
}

export async function putJSON(obj, token, name = 'data.json') {
  console.warn('Web3Storage removed. Use Supabase storage instead.');
  return '';
}